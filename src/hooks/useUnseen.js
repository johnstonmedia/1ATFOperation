import { useData } from '../context/DataContext'

// Device-local "have I read this yet?" tracking for public content feeds.
// No auth or per-user server state — "read" means "this browser opened the
// page since the content last changed".
//
// Two flavours:
//  - useUnseen(slice): whole-slice freshness from the slice's `updatedAt`
//    stamp (used for briefings/taskings).
//  - useUnseenIntel(company): intel is company-scoped, so a slice-wide stamp
//    would light the alert for every cadet whenever ANY company's intel
//    changed. Instead we fingerprint only the fragments this visitor can
//    actually see — unit-wide ('ALL') plus their own company — and compare
//    that against the last fingerprint they viewed. Another company's edits
//    change their fingerprint, not yours.

const key = (slice) => '1atf-seen-' + slice

/* ------------------------------ whole slice ----------------------------- */

// Returns the slice's updatedAt when it has changed since this device last
// viewed it, else 0 (falsy → nothing new).
export function useUnseen(slice) {
  const { state } = useData()
  const updatedAt = state?.contentMeta?.[slice]?.updatedAt || 0
  let seen = 0
  try { seen = Number(localStorage.getItem(key(slice)) || 0) } catch { /* private mode */ }
  return updatedAt > seen ? updatedAt : 0
}

// Record that this device has now seen the slice at `updatedAt`. Storing the
// content's own stamp (not Date.now) keeps the comparison immune to clock
// skew between RHQ's device and the member's.
export function markSeen(slice, updatedAt) {
  try { localStorage.setItem(key(slice), String(updatedAt || Date.now())) } catch { /* ignore */ }
}

/* ------------------------------ intel (per company) --------------------- */

// Fragments a given company's cadets can see: unit-wide plus their own.
export function visibleIntel(intel, company) {
  return (intel || []).filter((f) => f.company === 'ALL' || (company && f.company === company))
}

// Cheap 32-bit string hash — enough to notice any add/remove/edit.
function hash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// Fingerprint of the intel this company sees. Sorted by id so mere reordering
// in the editor doesn't read as "new intel".
export function intelSignature(intel, company) {
  const rel = visibleIntel(intel, company)
    .map((f) => [f.id, f.company, f.title, f.prompt, f.answer, f.reveal, f.docUrl, (f.resources || []).length].join(''))
    .sort()
  return rel.length ? `${rel.length}.${hash(rel.join(''))}` : '0'
}

const intelKey = (company) => `1atf-seen-intel-${company || 'ALL'}`

// True when this company's visible intel differs from what this device last
// viewed. First-ever visit counts as "nothing new" — a cadet arriving for the
// first time shouldn't be told the content they've never seen is "new"; the
// gate/Intel page stamps the baseline on that first load.
export function useUnseenIntel(company) {
  const { state } = useData()
  const sig = intelSignature(state?.intel, company)
  let seen = null
  try { seen = localStorage.getItem(intelKey(company)) } catch { /* private mode */ }
  if (seen === null) return false
  return seen !== sig
}

export function markIntelSeen(intel, company) {
  try { localStorage.setItem(intelKey(company), intelSignature(intel, company)) } catch { /* ignore */ }
}

// Has this device ever recorded a baseline for this company? Used to set the
// baseline silently on the first visit (and after switching company) so the
// alert only ever fires on a genuine change.
export function hasIntelBaseline(company) {
  try { return localStorage.getItem(intelKey(company)) !== null } catch { return true }
}
