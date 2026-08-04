import { FIREBASE_ENABLED, db } from '../firebase/config'

// Anonymous decrypt telemetry: how many fragments are actually being solved,
// per company. The public Intel tab has no login, so this is deliberately the
// smallest possible record — a COUNT, keyed by company and fragment:
//
//   intelStats/{company}_{fragmentId} -> { company, fragmentId, solves, lastAt }
//
// Deliberately only four fields, and the security rules pin it to exactly
// those: an unauthenticated writer can create a doc with solves == 1 or add
// exactly 1 to an existing one, and nothing else. There is no firstAt because
// the write is a merge+increment with no prior read, so any "first" stamp sent
// each time would just overwrite itself.
//
// No identity, no device id, no IP, nothing that could single a cadet out. It
// answers "is anyone doing this, and which puzzles land?" and nothing else.
// See the privacy notice (src/pages/Privacy.jsx), which describes it.
//
// Deduping is device-local (lib/intelProgress.js only calls in on a cadet's
// FIRST solve of a fragment), so the count is "devices that cracked it", not
// "times a box was ticked". A determined visitor can still inflate it — this
// is an engagement signal for RHQ, not an auditable score, and it should not
// be presented as one.
//
// Writes must never block or break the puzzle: every failure is swallowed. In
// LOCAL MODE the counts live in localStorage so the Ops Centre view works
// offline.

const LS_KEY = '1atf-intel-stats'
const docIdFor = (company, fragmentId) => `${company || 'NONE'}_${fragmentId}`

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}')
  } catch {
    return {}
  }
}

export async function recordSolve({ fragmentId, company }) {
  if (!fragmentId) return
  const coy = company || 'NONE'
  const id = docIdFor(coy, fragmentId)
  const now = Date.now()

  if (!FIREBASE_ENABLED) {
    try {
      const rows = readLocal()
      rows[id] = {
        company: coy, fragmentId,
        solves: (rows[id]?.solves || 0) + 1,
        lastAt: now,
      }
      localStorage.setItem(LS_KEY, JSON.stringify(rows))
    } catch { /* ignore */ }
    return
  }

  try {
    const { doc, setDoc, increment } = await import('firebase/firestore')
    // Merge so the first solve creates the doc and later ones increment it,
    // without a read first (which the rules don't grant a public visitor).
    await setDoc(doc(db, 'intelStats', id), {
      company: coy,
      fragmentId,
      solves: increment(1),
      lastAt: now,
    }, { merge: true })
  } catch { /* telemetry must never interrupt the puzzle */ }
}

// Every recorded count. RHQ-facing (the rules allow public read of these
// aggregates, but nothing in the public UI displays them).
export async function listStats() {
  if (!FIREBASE_ENABLED) return Object.values(readLocal())
  try {
    const { collection, getDocs } = await import('firebase/firestore')
    const snap = await getDocs(collection(db, 'intelStats'))
    return snap.docs.map((d) => d.data())
  } catch {
    return []
  }
}

// Roll the raw rows up into { byCompany, byFragment, total } for display.
export function summarise(rows, intel) {
  const titleOf = new Map((intel || []).map((f) => [f.id, f.title || 'Untitled fragment']))
  const byCompany = new Map()
  const byFragment = new Map()
  let total = 0

  for (const r of rows || []) {
    const n = Number(r.solves) || 0
    total += n
    byCompany.set(r.company, (byCompany.get(r.company) || 0) + n)
    const cur = byFragment.get(r.fragmentId) || { fragmentId: r.fragmentId, solves: 0, lastAt: 0 }
    cur.solves += n
    cur.lastAt = Math.max(cur.lastAt, Number(r.lastAt) || 0)
    byFragment.set(r.fragmentId, cur)
  }

  return {
    total,
    byCompany: [...byCompany.entries()]
      .map(([company, solves]) => ({ company, solves }))
      .sort((a, b) => b.solves - a.solves),
    byFragment: [...byFragment.values()]
      .map((f) => ({
        ...f,
        // A fragment RHQ has since deleted still has counts worth seeing.
        title: titleOf.get(f.fragmentId) || 'Deleted fragment',
        deleted: !titleOf.has(f.fragmentId),
      }))
      .sort((a, b) => b.solves - a.solves),
  }
}
