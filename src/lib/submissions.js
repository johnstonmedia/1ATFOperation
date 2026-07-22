// Intel submission queue — the draft/pending layer that sits in front of the
// published `intel` content slice.
//
// A Company Commander creates a submission for THEIR company's intel. It is not
// live until RHQ approves it (RHQ may edit it first). Approval writes the
// fragment into the published `intel` slice; the submission is then removed.
//
// Storage: a Firestore collection `intelSubmissions` (see firestore.rules — a
// commander may only touch their own company's docs; RHQ sees all). In LOCAL
// MODE everything is kept in localStorage so the flow works without Firebase.

import { FIREBASE_ENABLED, db } from '../firebase/config'
import { makeId } from './store'

const LS_KEY = '1atf-intel-submissions'

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]')
  } catch {
    return []
  }
}
function writeLocal(rows) {
  localStorage.setItem(LS_KEY, JSON.stringify(rows))
}

// A submission wraps the intel fragment plus who/when. `op` is 'upsert' (create
// or edit a fragment) or 'delete' (retire a live fragment) — both need approval.
export function newSubmission({ company, fragment, op = 'upsert', by }) {
  return {
    id: makeId(),
    company,
    op,
    fragment,
    status: 'pending',
    submittedByName: by?.name || '',
    submittedById: by?.idNumber || '',
    submittedAt: Date.now(),
  }
}

export async function createSubmission(sub) {
  if (!FIREBASE_ENABLED) {
    const rows = readLocal()
    rows.push(sub)
    writeLocal(rows)
    return sub.id
  }
  const { collection, doc, setDoc } = await import('firebase/firestore')
  await setDoc(doc(collection(db, 'intelSubmissions'), sub.id), sub)
  return sub.id
}

export async function updateSubmission(id, patch) {
  if (!FIREBASE_ENABLED) {
    writeLocal(readLocal().map((s) => (s.id === id ? { ...s, ...patch } : s)))
    return
  }
  const { doc, updateDoc } = await import('firebase/firestore')
  await updateDoc(doc(db, 'intelSubmissions', id), patch)
}

export async function deleteSubmission(id) {
  if (!FIREBASE_ENABLED) {
    writeLocal(readLocal().filter((s) => s.id !== id))
    return
  }
  const { doc, deleteDoc } = await import('firebase/firestore')
  await deleteDoc(doc(db, 'intelSubmissions', id))
}

// List submissions. Pass a company letter to scope to that company (required for
// a commander — the security rules only allow reading own-company docs); omit it
// for RHQ to read the whole queue.
export async function listSubmissions({ company } = {}) {
  if (!FIREBASE_ENABLED) {
    const rows = readLocal()
    return company ? rows.filter((s) => s.company === company) : rows
  }
  const { collection, getDocs, query, where } = await import('firebase/firestore')
  const base = collection(db, 'intelSubmissions')
  const q = company ? query(base, where('company', '==', company)) : base
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
