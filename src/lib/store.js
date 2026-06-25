// Unified data store. Presents one async API regardless of whether Firebase is
// configured. In LOCAL MODE everything is persisted to localStorage; with
// Firebase enabled, single-value slices live under content/{slice} and list
// slices (roster/tasks/activity) live in their own collections.

import { FIREBASE_ENABLED, db } from '../firebase/config'
import {
  DEFAULT_NARRATIVE,
  DEFAULT_ZONES,
  DEFAULT_CLASSIFIED,
  DEFAULT_BRANDING,
  DEFAULT_COMPANY_PAGES,
  DEMO_ROSTER,
  DEFAULT_ACTIVITY,
} from '../firebase/seed'

const LS_KEY = '1atf-state-v1'
const COLLECTION_SLICES = ['roster', 'tasks', 'activity']

const DEFAULT_STATE = {
  narrative: DEFAULT_NARRATIVE,
  zones: DEFAULT_ZONES,
  classified: DEFAULT_CLASSIFIED,
  branding: DEFAULT_BRANDING,
  companyPages: DEFAULT_COMPANY_PAGES,
  roster: FIREBASE_ENABLED ? [] : DEMO_ROSTER,
  tasks: [],
  activity: FIREBASE_ENABLED ? [] : DEFAULT_ACTIVITY,
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
  localStorage.setItem(LS_KEY, JSON.stringify(state))
}

/* ---------------------------- FIREBASE MODE ---------------------------- */

async function loadFirebase() {
  const { doc, getDoc, collection, getDocs } = await import('firebase/firestore')
  const out = structuredClone(DEFAULT_STATE)
  const singles = ['narrative', 'zones', 'classified', 'branding', 'companyPages']
  await Promise.all(
    singles.map(async (slice) => {
      try {
        const snap = await getDoc(doc(db, 'content', slice))
        if (snap.exists()) out[slice] = snap.data().value
      } catch {
        /* keep default */
      }
    }),
  )
  // roster/tasks/activity reads require auth (see firestore.rules); a signed-out
  // visitor is denied — that's fine, leave the defaults.
  for (const coll of COLLECTION_SLICES) {
    try {
      const snap = await getDocs(collection(db, coll))
      out[coll] = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    } catch {
      /* permission denied for signed-out visitor */
    }
  }
  return out
}

async function saveFirebaseSlice(slice, value) {
  const { doc, setDoc } = await import('firebase/firestore')
  await setDoc(doc(db, 'content', slice), { value })
}

// Sync an array slice into its collection: delete removed docs, write the rest.
// Batched in chunks to respect Firestore's 500-op batch limit.
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

export function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())
}
