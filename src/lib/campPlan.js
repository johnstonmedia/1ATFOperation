// The camp plan: who is at which zone, when.
//
// Parsed from the unit's plan workbook by tools/map/xlsx-to-schedule.py into
// src/data/singleton-schedule.json, and committed — the plan is settled before
// camp starts, so this is reference data, not something edited live.
//
// WHAT IT IS FOR. A zone is the unit of progress, and this says who is meant to
// pass through each one. Everything the map shows about progress is DERIVED
// from here plus one number — how far through camp we are — rather than being
// recorded by hand session by session. The plan is the plan; the map just reads
// it at a point in time.
import schedule from '../data/singleton-schedule.json'

const PLANS = { singleton: schedule }

export const planFor = (mapId) => PLANS[mapId] || null
export const campDays = (mapId) => planFor(mapId)?.days || []
export const campSessions = (mapId) => planFor(mapId)?.sessions || []
export const hasCampPlan = (mapId) => !!planFor(mapId)

// Day 0 is the blank board — camp hasn't started, nobody has been anywhere.
// Day N means "everything up to and including the end of day N has happened".
export const LAST_DAY = (mapId) => campDays(mapId).reduce((n, d) => Math.max(n, d.n), 0)

/**
 * Per-zone progress as at the end of `throughDay`.
 *
 * Returns a Map of zoneId -> {
 *   scheduled  every company the plan sends there, ever
 *   visited    those who have been, as at throughDay
 *   pending    those still to come
 *   pct        visited / scheduled, 0..100, rounded
 *   done       pct === 100 — 1ATF has conquered it
 * }
 *
 * ⚠️ THERE IS ONE MAP AND IT IS THE UNIT'S. A zone is not conquered until
 * EVERY company the plan sends there has been through it: three companies are
 * booked onto the ropes course, so one company through reads 33%, and at 100%
 * the ground is 1ATF's rather than any one company's. A per-company cut of
 * this existed briefly and was removed — six versions of the same camp is six
 * things to keep straight, and it undercut the point that the task force takes
 * ground together.
 */
export function zoneProgress(mapId, throughDay) {
  const plan = planFor(mapId)
  const out = new Map()
  if (!plan) return out
  for (const v of plan.visits) {
    let z = out.get(v.zone)
    if (!z) out.set(v.zone, (z = { scheduled: new Set(), visited: new Set() }))
    z.scheduled.add(v.company)
    if (v.day <= throughDay) z.visited.add(v.company)
  }
  for (const [, z] of out) {
    z.scheduled = [...z.scheduled].sort()
    z.visited = [...z.visited].sort()
    z.pending = z.scheduled.filter((c) => !z.visited.includes(c))
    z.pct = z.scheduled.length ? Math.round((z.visited.length / z.scheduled.length) * 100) : 0
    z.done = z.pct === 100
  }
  return out
}

// Roll-up for a headline: how much of the whole plan has happened.
export function overallProgress(mapId, throughDay) {
  const plan = planFor(mapId)
  if (!plan) return { done: 0, total: 0, pct: 0 }
  const visits = plan.visits
  const done = visits.filter((v) => v.day <= throughDay).length
  return { done, total: visits.length, pct: visits.length ? Math.round((done / visits.length) * 100) : 0 }
}

// Which companies are at a zone on one specific day — what a day's poster or
// caption wants to name, as opposed to the cumulative picture above.
export function visitsOnDay(mapId, day, zoneId = null) {
  const plan = planFor(mapId)
  if (!plan) return []
  return plan.visits.filter((v) => v.day === day && (!zoneId || v.zone === zoneId))
}
