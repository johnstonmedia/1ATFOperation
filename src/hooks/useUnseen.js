import { useData } from '../context/DataContext'

// Device-local "have I read this yet?" tracking for public content feeds.
// Every content slice already carries an `updatedAt` stamp (written on RHQ
// save / intel approval); each device remembers the last stamp it viewed in
// localStorage. No auth or per-user server state involved — "read" means
// "this browser opened the page since the content last changed".

const key = (slice) => '1atf-seen-' + slice

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
