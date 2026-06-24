// Unified data store. Presents one async API regardless of whether Firebase
// is configured. In LOCAL MODE everything is persisted to localStorage; with
// Firebase enabled the same calls read/write Firestore documents.

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

const DEFAULT_STATE = {
  narrative: DEFAULT_NARRATIVE,
  zones: DEFAULT_ZONES,
  classified: DEFAULT_CLASSIFIED,
  branding: DEFAULT_BRANDING,
  companyPages: DEFAULT_COMPANY_PAGES,
  roster: DEMO_ROSTER, // pre-provisioned users (from spreadsheet import)
  tasks: [], // distributed digital activities
  activity: DEFAULT_ACTIVITY,
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
// Each top-level slice is stored as a single document under content/{slice}
// (except roster/tasks which are collections). This keeps the store simple
// and the Operations Centre edits transactional.

async function loadFirebase() {
  const { doc, getDoc, collection, getDocs } = await import('firebase/firestore')
  const out = structuredClone(DEFAULT_STATE)
  const singles = ['narrative', 'zones', 'classified', 'branding', 'companyPages']
  await Promise.all(
    singles.map(async (slice) => {
      const snap = await getDoc(doc(db, 'content', slice))
      if (snap.exists()) out[slice] = snap.data().value
    }),
  )
  // roster/tasks reads require auth (see firestore.rules); a signed-out public
  // visitor will be denied — that's fine, just skip the collection.
  for (const coll of ['roster', 'tasks', 'activity']) {
    try {
      const snap = await getDocs(collection(db, coll))
      if (!snap.empty) out[coll] = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    } catch {
      /* permission denied for signed-out visitor — leave default */
    }
  }
  return out
}

async function saveFirebaseSlice(slice, value) {
  const { doc, setDoc } = await import('firebase/firestore')
  await setDoc(doc(db, 'content', slice), { value })
}

/* ------------------------------ PUBLIC API ----------------------------- */

export async function loadState() {
  return FIREBASE_ENABLED ? loadFirebase() : loadLocal()
}

// Persist a single slice. `state` is the full in-memory state for local mode.
export async function persistSlice(state, slice) {
  if (FIREBASE_ENABLED) {
    await saveFirebaseSlice(slice, state[slice])
  } else {
    saveLocal(state)
  }
}

// Roster / collection helpers (work in both modes).
export async function upsertRoster(state, rows) {
  if (FIREBASE_ENABLED) {
    const { doc, writeBatch, collection } = await import('firebase/firestore')
    const batch = writeBatch(db)
    rows.forEach((r) => {
      const id = String(r.idNumber || r.email || crypto.randomUUID())
      batch.set(doc(collection(db, 'roster'), id), r)
    })
    await batch.commit()
  } else {
    saveLocal(state)
  }
}

export function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())
}
