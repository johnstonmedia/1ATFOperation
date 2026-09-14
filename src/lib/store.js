// Unified data store. Presents one async API regardless of whether Firebase is
// configured. In LOCAL MODE everything is persisted to localStorage; with
// Firebase enabled, single-value slices live under content/{slice} and list
// slices (roster/tasks/activity/support/resetRequests) live in collections.

import { FIREBASE_ENABLED, db } from '../firebase/config'
import {
  DEFAULT_NARRATIVE,
  DEFAULT_CLASSIFIED,
  DEFAULT_BRANDING,
  DEFAULT_COMPANY_PAGES,
  DEFAULT_VIDEO,
  DEFAULT_INTEL,
  DEFAULT_INTEL_INTRO,
  DEFAULT_BRIEFINGS,
  DEFAULT_STAFF_ACCESS,
  DEFAULT_TERRITORY,
  DEFAULT_SINGLETON_TERRITORY,
  DEFAULT_ACTIVE_MAP,
  DEMO_ROSTER,
  DEFAULT_ACTIVITY,
} from '../firebase/seed'
import { MAPS, PRIMARY_MAP_ID, mapById, mapSlices, territorySlice, campaignStartSlice, mapReleaseSlice, frameMapId } from './maps'

const LS_KEY = '1atf-state-v1'
const LS_AUTHIDX = '1atf-authindex'
// Every map contributes its own territory + replay-start slice (see
// lib/maps.js) — the primary map's keep the original unsuffixed names, so
// existing Firestore documents are untouched by there being a second map.
// They are plain `content/*` docs, already covered by the existing rules.
const SINGLE_SLICES = ['narrative', 'classified', 'branding', 'companyPages', 'video', 'intel', 'intelIntro', 'briefings', 'staffAccess', 'activeMap', ...mapSlices()]
const COLLECTION_SLICES = ['roster', 'tasks', 'activity', 'support', 'resetRequests', 'audit', 'campaignFrames']

export const isContentSlice = (slice) => SINGLE_SLICES.includes(slice)

// Seed value for each map's territory. A map with no entry here starts empty
// rather than blowing up — adding art to lib/maps.js is enough to get a
// paintable map, and a seed is only a nicety on top.
const TERRITORY_SEED = {
  nsw: DEFAULT_TERRITORY,
  singleton: DEFAULT_SINGLETON_TERRITORY,
}
const blankTerritory = (map) => ({
  map: map.id,
  cols: map.cols,
  rows: map.rows,
  showRHQ: false,
  cells: '.'.repeat(map.cols * map.rows),
  places: [],
})
export const defaultTerritoryFor = (mapId) => {
  const map = mapById(mapId)
  return structuredClone(TERRITORY_SEED[map.id] || blankTerritory(map))
}

const DEFAULT_MAP_STATE = MAPS.reduce((acc, m) => {
  acc[territorySlice(m.id)] = defaultTerritoryFor(m.id)
  // Frame id the public replay's auto-play starts from (null = the earliest
  // frame, i.e. the original behaviour). Earlier frames still exist and
  // remain reachable via the replay's manual frame picker — this only
  // controls where the AUTO-PLAY begins.
  acc[campaignStartSlice(m.id)] = null
  // Not distributed until RHQ says so (see mapReleaseSlice). The map a
  // visitor lands on — `activeMap` — is public whatever this says, so a
  // fresh install is never a portal with no map on it.
  acc[mapReleaseSlice(m.id)] = { released: false }
  return acc
}, {})

const DEFAULT_STATE = {
  narrative: DEFAULT_NARRATIVE,
  ...DEFAULT_MAP_STATE,
  // Which map the public portal shows. Signed-out visitors see this one and
  // no other; RHQ switches it from Map: Territory.
  activeMap: DEFAULT_ACTIVE_MAP,
  classified: DEFAULT_CLASSIFIED,
  branding: DEFAULT_BRANDING,
  companyPages: DEFAULT_COMPANY_PAGES,
  video: DEFAULT_VIDEO,
  intel: DEFAULT_INTEL,
  intelIntro: DEFAULT_INTEL_INTRO,
  briefings: DEFAULT_BRIEFINGS,
  staffAccess: DEFAULT_STAFF_ACCESS,
  roster: FIREBASE_ENABLED ? [] : DEMO_ROSTER,
  tasks: [],
  activity: FIREBASE_ENABLED ? [] : DEFAULT_ACTIVITY,
  support: [],
  resetRequests: [],
  audit: [],
  campaignFrames: [],
  // Per-content-slice metadata, e.g. { zones: { updatedAt } }. Populated from
  // the Firestore docs (or localStorage) so the UI can show "last updated".
  contentMeta: {},
  // What could NOT be read on the last load — see loadFirebase. A denied read
  // silently falls back to the seed, which on a map looks exactly like "the
  // progress is gone" rather than like a permissions problem, so the failures
  // are recorded here and surfaced in the Ops Centre.
  loadErrors: [],
}

/* ----------------------------- LOCAL MODE ------------------------------ */

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) {
      localStorage.setItem(LS_KEY, JSON.stringify(DEFAULT_STATE))
      return structuredClone(DEFAULT_STATE)
    }
    return { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) }
  } catch {
    return structuredClone(DEFAULT_STATE)
  }
}

function saveLocal(state) {
  // strip transient before persisting
  localStorage.setItem(LS_KEY, JSON.stringify(state))
}

/* ---------------------------- FIREBASE MODE ---------------------------- */

async function loadFirebase() {
  const { doc, getDoc, collection, getDocs } = await import('firebase/firestore')
  const out = structuredClone(DEFAULT_STATE)
  // A read that fails still falls back to the seed — the site must render for
  // a signed-out visitor, and several collections are legitimately unreadable
  // to one. But the fallback is indistinguishable from real empty content: a
  // denied `content/territory` read draws the seeded map, which reads as "the
  // campaign progress has vanished" rather than "check the rules". Record what
  // failed so the Ops Centre can say which it is.
  const fail = (scope, e) => {
    out.loadErrors.push({ scope, code: e?.code || 'unknown', message: e?.message || String(e) })
    // Always in the console too, since a public visitor sees no Ops Centre.
    console.warn(`[1atf] could not read ${scope}:`, e?.code || e)
  }
  await Promise.all(
    SINGLE_SLICES.map(async (slice) => {
      try {
        const snap = await getDoc(doc(db, 'content', slice))
        if (snap.exists()) {
          out[slice] = snap.data().value
          out.contentMeta[slice] = { updatedAt: snap.data().updatedAt || null }
        }
      } catch (e) {
        fail(`content/${slice}`, e)
      }
    }),
  )
  for (const coll of COLLECTION_SLICES) {
    try {
      const snap = await getDocs(collection(db, coll))
      out[coll] = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    } catch (e) {
      // Expected for a signed-out / non-RHQ visitor on the RHQ-only
      // collections; a real problem on the world-readable ones.
      fail(coll, e)
    }
  }
  return out
}

async function saveFirebaseSlice(slice, value) {
  const { doc, setDoc } = await import('firebase/firestore')
  await setDoc(doc(db, 'content', slice), { value, updatedAt: Date.now() })
}

// Atomically apply a change to the live `intel` array.
//
// Every other content slice is realistically edited by one RHQ screen at a
// time. `intel` isn't: Approvals, the Intel editor and the Backups fragment
// restore can all add/edit/remove ONE fragment, and RHQ commonly has more
// than one of those open in separate windows/tabs at once (that's the whole
// point of a queue). Each window's copy of `intel` is loaded once and never
// refreshed, so a plain `updateSlice('intel', arrayBuiltFromThatCopy)` blindly
// overwrites the whole document — whichever save lands second wins outright,
// silently discarding any fragment the other window(s) added/changed since
// its own load. `mutate` is handed the array as read FRESH at write time (a
// Firestore transaction; a synchronous localStorage re-read in LOCAL MODE),
// not the caller's stale copy, so two concurrent single-fragment edits merge
// instead of one clobbering the other.
export async function mutateIntel(mutate) {
  if (!FIREBASE_ENABLED) {
    const state = loadLocal()
    const prev = Array.isArray(state.intel) ? state.intel : []
    const next = mutate(prev)
    state.intel = next
    saveLocal(state)
    return { prev, next }
  }
  const { doc, runTransaction } = await import('firebase/firestore')
  const ref = doc(db, 'content', 'intel')
  let prev = []
  let next = []
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const live = snap.exists() ? snap.data().value : []
    prev = Array.isArray(live) ? live : []
    next = mutate(prev)
    tx.set(ref, { value: next, updatedAt: Date.now() })
  })
  return { prev, next }
}

async function persistCollection(coll, rows) {
  const { collection, getDocs, writeBatch, doc } = await import('firebase/firestore')
  const idOf = (r) => String(r._id || r.id)
  const existing = await getDocs(collection(db, coll))
  const keep = new Set(rows.map(idOf))
  const ops = []
  existing.forEach((d) => {
    if (!keep.has(d.id)) ops.push({ type: 'del', id: d.id })
  })
  rows.forEach((r) => ops.push({ type: 'set', id: idOf(r), data: r }))
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db)
    ops.slice(i, i + 400).forEach((op) => {
      const ref = doc(collection(db, coll), op.id)
      if (op.type === 'del') batch.delete(ref)
      else batch.set(ref, op.data)
    })
    await batch.commit()
  }
}

/* ------------------------------ PUBLIC API ----------------------------- */

// A stored territory grid only fits the map art it was authored for — if its
// cols/rows don't match the current grid resolution (e.g. persisted data from
// before a map-image swap), it's not just stale, it's actively unrenderable
// (cells lose square alignment). Fall back to the fresh default rather than
// render a broken grid; RHQ re-saving in the map editor persists the fix.
function normalizeTerritory(state) {
  for (const map of MAPS) {
    const slice = territorySlice(map.id)
    const t = state[slice]
    if (!t || t.cols !== map.cols || t.rows !== map.rows || t.cells?.length !== map.cols * map.rows) {
      state[slice] = defaultTerritoryFor(map.id)
    } else if (t.map !== map.id) {
      // Territory saved before maps were a thing carries no id. Stamp it so
      // everything downstream can ask a territory which art it belongs to.
      state[slice] = { ...t, map: map.id }
    }
  }
  if (!MAPS.some((m) => m.id === state.activeMap)) state.activeMap = PRIMARY_MAP_ID
  return state
}

// Unit policy: outward-facing copy says "threat", never "hostile". The seed
// defaults were reworded, but narrative text saved to Firestore BEFORE that
// change still carries the old word (e.g. "MERIDIAN // HOSTILE"). Rewrite it
// at read time — case-preserving, whole word only — so live copy complies
// without RHQ having to hand-edit every field. Read-time only: nothing is
// written back, and RHQ edits still win for everything else.
const THREAT_WORD = { HOSTILE: 'THREAT', Hostile: 'Threat', hostile: 'threat' }
function dehostile(v) {
  if (typeof v === 'string') return v.replace(/\bhostile\b/gi, (m) => THREAT_WORD[m] || THREAT_WORD[m.toLowerCase()] || 'threat')
  if (Array.isArray(v)) return v.map(dehostile)
  if (v && typeof v === 'object') {
    const out = {}
    for (const k of Object.keys(v)) out[k] = dehostile(v[k])
    return out
  }
  return v
}
function normalizeNarrative(state) {
  if (state.narrative) state.narrative = dehostile(state.narrative)
  return state
}

// Same idea for the campaign replay frames: a frame recorded against a
// different grid resolution can't be replayed over the current art. Drop that
// map's whole set rather than render a broken/mixed-resolution replay — RHQ
// adds a fresh frame from the current map to begin a new history. Judged per
// map, since the collection now holds every map's history together and one
// map's stale frames must not take another map's history down with them.
function normalizeCampaignFrames(state) {
  const frames = Array.isArray(state.campaignFrames) ? state.campaignFrames : []
  const broken = new Set()
  for (const f of frames) {
    const map = mapById(frameMapId(f))
    if (typeof f.cells !== 'string' || f.cells.length !== map.cols * map.rows) broken.add(map.id)
  }
  state.campaignFrames = broken.size ? frames.filter((f) => !broken.has(frameMapId(f))) : frames
  return state
}

export async function loadState() {
  const state = await (FIREBASE_ENABLED ? loadFirebase() : loadLocal())
  return normalizeNarrative(normalizeCampaignFrames(normalizeTerritory(state)))
}

export async function persistSlice(state, slice) {
  if (!FIREBASE_ENABLED) {
    saveLocal(state)
    return
  }
  if (COLLECTION_SLICES.includes(slice)) {
    await persistCollection(slice, state[slice])
    return
  }
  await saveFirebaseSlice(slice, state[slice])
}

// Append a single document to an inbox collection. Used for anonymous
// submissions (support / forgotten-password) which can create but not list.
export async function appendItem(coll, item) {
  if (FIREBASE_ENABLED) {
    const { collection, addDoc } = await import('firebase/firestore')
    const ref = await addDoc(collection(db, coll), item)
    return ref.id
  }
  // local mode
  const state = loadLocal()
  state[coll] = [...(state[coll] || []), { id: makeId(), ...item }]
  saveLocal(state)
  return state[coll][state[coll].length - 1].id
}

/* ----- auth version index (credential epoch, bumped on password reset) ---- */

function readLocalAuthIdx() {
  try {
    return JSON.parse(localStorage.getItem(LS_AUTHIDX) || '{}')
  } catch {
    return {}
  }
}

export async function getAuthVersion(idClean) {
  if (!FIREBASE_ENABLED) return readLocalAuthIdx()[idClean] || 0
  try {
    const { doc, getDoc } = await import('firebase/firestore')
    const snap = await getDoc(doc(db, 'authIndex', idClean))
    return snap.exists() ? snap.data().pwVersion || 0 : 0
  } catch {
    return 0
  }
}

export async function setAuthVersion(idClean, v) {
  if (!FIREBASE_ENABLED) {
    const all = readLocalAuthIdx()
    all[idClean] = v
    localStorage.setItem(LS_AUTHIDX, JSON.stringify(all))
    return
  }
  const { doc, setDoc } = await import('firebase/firestore')
  await setDoc(doc(db, 'authIndex', idClean), { pwVersion: v })
}

/* ----- offline queue for auto-reports raised while the network was down ----- */
const LS_PENDING = '1atf-pending-support'

export function stashPending(item) {
  try {
    const a = JSON.parse(localStorage.getItem(LS_PENDING) || '[]')
    a.push(item)
    localStorage.setItem(LS_PENDING, JSON.stringify(a))
  } catch {
    /* ignore */
  }
}

export async function flushPending() {
  if (!FIREBASE_ENABLED) return
  let a
  try {
    a = JSON.parse(localStorage.getItem(LS_PENDING) || '[]')
  } catch {
    a = []
  }
  if (!a.length) return
  const rest = []
  for (const it of a) {
    try {
      await appendItem('support', it)
    } catch {
      rest.push(it)
    }
  }
  localStorage.setItem(LS_PENDING, JSON.stringify(rest))
}

export function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())
}
