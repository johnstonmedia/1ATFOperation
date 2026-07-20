// Unified data store. Presents one async API regardless of whether Firebase is
// configured. In LOCAL MODE everything is persisted to localStorage; with
// Firebase enabled, single-value slices live under content/{slice} and list
// slices (roster/tasks/activity/support/resetRequests) live in collections.

import { FIREBASE_ENABLED, db } from '../firebase/config'
import {
  DEFAULT_NARRATIVE,
  DEFAULT_ZONES,
  DEFAULT_ARROWS,
  DEFAULT_CLASSIFIED,
  DEFAULT_BRANDING,
  DEFAULT_COMPANY_PAGES,
  DEFAULT_VIDEO,
  DEFAULT_MARKERS,
  DEFAULT_INTEL,
  DEMO_ROSTER,
  DEFAULT_ACTIVITY,
} from '../firebase/seed'

const LS_KEY = '1atf-state-v1'
const LS_AUTHIDX = '1atf-authindex'
const SINGLE_SLICES = ['narrative', 'zones', 'arrows', 'markers', 'classified', 'branding', 'companyPages', 'video', 'intel']
const COLLECTION_SLICES = ['roster', 'tasks', 'activity', 'support', 'resetRequests', 'audit']

export const isContentSlice = (slice) => SINGLE_SLICES.includes(slice)

const DEFAULT_STATE = {
  narrative: DEFAULT_NARRATIVE,
  zones: DEFAULT_ZONES,
  arrows: DEFAULT_ARROWS,
  classified: DEFAULT_CLASSIFIED,
  branding: DEFAULT_BRANDING,
  companyPages: DEFAULT_COMPANY_PAGES,
  video: DEFAULT_VIDEO,
  markers: DEFAULT_MARKERS,
  intel: DEFAULT_INTEL,
  roster: FIREBASE_ENABLED ? [] : DEMO_ROSTER,
  tasks: [],
  activity: FIREBASE_ENABLED ? [] : DEFAULT_ACTIVITY,
  support: [],
  resetRequests: [],
  audit: [],
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

// Firestore does not allow an array element to itself be an array, so zone
// polygons (coords: [[lat,lng], …]) cannot be stored as-is. Encode each point
// as a {lat,lng} map on write and turn it back into a [lat,lng] pair on read.
// Both directions tolerate the opposite shape so old/new data interoperate.
function encodeSlice(slice, value) {
  if (slice !== 'zones' || !Array.isArray(value)) return value
  return value.map((z) => ({
    ...z,
    coords: Array.isArray(z.coords)
      ? z.coords.map((p) => (Array.isArray(p) ? { lat: p[0], lng: p[1] } : p))
      : z.coords,
  }))
}
function decodeSlice(slice, value) {
  if (slice !== 'zones' || !Array.isArray(value)) return value
  return value.map((z) => ({
    ...z,
    coords: Array.isArray(z.coords)
      ? z.coords.map((p) => (Array.isArray(p) ? p : [p.lat, p.lng]))
      : z.coords,
  }))
}

async function loadFirebase() {
  const { doc, getDoc, collection, getDocs } = await import('firebase/firestore')
  const out = structuredClone(DEFAULT_STATE)
  await Promise.all(
    SINGLE_SLICES.map(async (slice) => {
      try {
        const snap = await getDoc(doc(db, 'content', slice))
        if (snap.exists()) {
          out[slice] = decodeSlice(slice, snap.data().value)
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
  await setDoc(doc(db, 'content', slice), { value: encodeSlice(slice, value), updatedAt: Date.now() })
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

export async function loadState() {
  return FIREBASE_ENABLED ? loadFirebase() : loadLocal()
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
