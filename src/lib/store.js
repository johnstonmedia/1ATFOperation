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
  DEMO_ROSTER,
  DEFAULT_ACTIVITY,
} from '../firebase/seed'
import { TERR_COLS, TERR_ROWS } from './territory'

const LS_KEY = '1atf-state-v1'
const LS_AUTHIDX = '1atf-authindex'
const SINGLE_SLICES = ['narrative', 'territory', 'classified', 'branding', 'companyPages', 'video', 'intel', 'intelIntro', 'briefings', 'campaignDefaultStart', 'staffAccess']
const COLLECTION_SLICES = ['roster', 'tasks', 'activity', 'support', 'resetRequests', 'audit', 'campaignFrames']

export const isContentSlice = (slice) => SINGLE_SLICES.includes(slice)

const DEFAULT_STATE = {
  narrative: DEFAULT_NARRATIVE,
  territory: DEFAULT_TERRITORY,
  classified: DEFAULT_CLASSIFIED,
  branding: DEFAULT_BRANDING,
  companyPages: DEFAULT_COMPANY_PAGES,
  video: DEFAULT_VIDEO,
  intel: DEFAULT_INTEL,
  intelIntro: DEFAULT_INTEL_INTRO,
  briefings: DEFAULT_BRIEFINGS,
  // Frame id the public replay's auto-play starts from (null = the earliest
  // frame, i.e. the original behaviour). Earlier frames still exist and
  // remain reachable via the replay's manual frame picker — this only
  // controls where the AUTO-PLAY begins.
  campaignDefaultStart: null,
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
  await Promise.all(
    SINGLE_SLICES.map(async (slice) => {
      try {
        const snap = await getDoc(doc(db, 'content', slice))
        if (snap.exists()) {
          out[slice] = snap.data().value
          out.contentMeta[slice] = { updatedAt: snap.data().updatedAt || null }
        }
      } catch {
        /* keep default */
      }
    }),
  )
  for (const coll of COLLECTION_SLICES) {
    try {
      const snap = await getDocs(collection(db, coll))
      out[coll] = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    } catch {
      /* permission denied for signed-out / non-RHQ visitor */
    }
  }
  return out
}

async function saveFirebaseSlice(slice, value) {
  const { doc, setDoc } = await import('firebase/firestore')
  await setDoc(doc(db, 'content', slice), { value, updatedAt: Date.now() })
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
  const t = state.territory
  if (!t || t.cols !== TERR_COLS || t.rows !== TERR_ROWS) {
    state.territory = structuredClone(DEFAULT_TERRITORY)
  }
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
// different grid resolution can't be replayed over the current art. Drop the
// whole set rather than render a broken/mixed-resolution replay — RHQ adds a
// fresh frame from the current map to begin a new history.
function normalizeCampaignFrames(state) {
  const frames = Array.isArray(state.campaignFrames) ? state.campaignFrames : []
  const size = state.territory.cols * state.territory.rows
  state.campaignFrames = frames.every((f) => typeof f.cells === 'string' && f.cells.length === size)
    ? frames
    : []
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
