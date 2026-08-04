import { visibleIntel } from '../hooks/useUnseen'
import { recordSolve } from './intelStats'

// "Which fragments have I decrypted?" — device-local, no auth, same posture as
// the unread tracking in hooks/useUnseen.js. A solve is a browser fact, not a
// server one: there are no accounts on the public tabs, so there is nobody to
// attribute it to and nothing to sync.
//
// Solves are stored as a flat id list rather than per-company, because a
// fragment id is already unique across companies and a cadet who switches
// company shouldn't lose their record.

const KEY = '1atf-intel-solved'

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function solvedIds() {
  return new Set(read())
}

export function isSolved(id) {
  return !!id && read().includes(id)
}

// Record a solve. Returns true if this was the FIRST time on this device —
// callers use that to fire the anonymous telemetry exactly once, so a cadet
// re-opening a fragment they already cracked doesn't inflate the count.
export function markSolved(id, { company } = {}) {
  if (!id) return false
  const list = read()
  if (list.includes(id)) return false
  try {
    localStorage.setItem(KEY, JSON.stringify([...list, id]))
  } catch {
    return false // private mode: no record, so no telemetry either (can't dedupe)
  }
  recordSolve({ fragmentId: id, company })
  return true
}

// Decrypt progress over the fragments this visitor can actually see (unit-wide
// plus their own company) — the same visibility rule the unread alert uses, so
// the counter and the alert can never disagree about what "all of it" means.
export function decryptProgress(intel, company) {
  const visible = visibleIntel(intel, company)
  const solved = solvedIds()
  // A fragment with no answer isn't a puzzle — it's a straight notice, so it
  // doesn't count toward a total the cadet can never move.
  const puzzles = visible.filter((f) => String(f.answer || '').trim())
  return {
    total: puzzles.length,
    done: puzzles.filter((f) => solved.has(f.id)).length,
    fragments: puzzles.map((f) => ({ id: f.id, title: f.title, solved: solved.has(f.id) })),
  }
}
