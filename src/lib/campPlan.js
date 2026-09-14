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
 *   visits     every scheduled visit, in plan order: [{ company, day, session }]
 *   done       how many of them have happened as at throughDay
 *   total      visits.length
 *   pct        done / total, 0..100, rounded
 *   complete   done === total — 1ATF has conquered it
 *   companies  the distinct companies sent there, sorted (for labelling)
 *   visited    the distinct companies that have been, sorted
 * }
 *
 * ⚠️ PROGRESS IS COUNTED IN VISITS, NOT COMPANIES. A company is often booked
 * into the same area more than once — NAVEX takes 13 visits across camp, AA
 * Juliet 8 — and a zone is not finished the first time its last company walks
 * in. Counting distinct companies said the ropes course was a third done after
 * one of three had been, which flattered the first day and stalled the last.
 * Counting visits is simply what the plan schedules, so 2 of NAVEX's 13 done is
 * 2/13 of the ground, and the zone only becomes 1ATF's on the final visit.
 *
 * ⚠️ ONE MAP AND IT IS THE UNIT'S — no per-company cut of this exists. See
 * CHANGELOG 2026-09-14.
 */
export function zoneProgress(mapId, throughDay) {
  const plan = planFor(mapId)
  const out = new Map()
  if (!plan) return out
  for (const v of plan.visits) {
    let z = out.get(v.zone)
    if (!z) out.set(v.zone, (z = { visits: [] }))
    z.visits.push({ company: v.company, day: v.day, session: v.session })
  }
  for (const [, z] of out) {
    // Plan order is schedule order (the converter walks the sheet in time), so
    // the first `done` entries are exactly the visits that have happened.
    z.total = z.visits.length
    z.done = z.visits.filter((v) => v.day <= throughDay).length
    z.pct = z.total ? Math.round((z.done / z.total) * 100) : 0
    z.complete = z.total > 0 && z.done === z.total
    z.companies = [...new Set(z.visits.map((v) => v.company))].sort()
    z.visited = [...new Set(z.visits.filter((v) => v.day <= throughDay).map((v) => v.company))].sort()
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
