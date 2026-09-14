// Build the campaign replay from the camp plan.
//
// One frame per camp day, painted from the schedule — so the public replay
// animates camp day by day with no hand painting at all. This is only possible
// because the plan is settled in advance (see campPlan.js); it is generation,
// not recording.
//
// WHO OWNS A ZONE, IN TWO STAGES.
//
//   PARTLY THROUGH  The FIRST company scheduled into a zone takes it and holds
//                   it while the rest are still to come — painted LOWERCASE,
//                   the grid's existing "newly gained / loosely held" variant.
//                   Later companies pass through without the ground changing
//                   hands, because a map that churns between friendly
//                   companies reads as confusion rather than progress.
//
//   CONQUERED       Once EVERY company the plan sends there has been through,
//                   the zone is not that first company's any more — it is the
//                   task force's. It goes solid 1ATF (TASKFORCE_CODE). That is
//                   the point of the percentage: the ropes course cannot be
//                   conquered until all three companies booked onto it have
//                   been, and when it is, it belongs to 1ATF rather than to
//                   whoever happened to go first.
//
// The second stage is also what makes a conquered zone appear on EVERY
// company's map: 1ATF ground survives the per-company mask below, so a cadet
// sees everything the unit has taken plus their own company's ground in
// progress, whether or not they were sent there themselves.
import { zonesFor } from './mapZones'
import { campDays, planFor, zoneProgress } from './campPlan'
import { zoneCells } from './zoneRaster'
import { TASKFORCE_CODE } from './territory'

// RHQ is the one thing already on the board at the start, so the base keeps
// whatever RHQ cells the live map has and blanks everything else. Camp starts
// from an empty board.
export function baseCells(territory) {
  return (territory.cells || '').replace(/[^Rr]/g, '.')
}

export function campFrameLabel(day, days) {
  if (day === 0) return 'Camp start'
  const d = days.find((x) => x.n === day)
  return d ? `${d.label} — ${d.date}` : `Day ${day}`
}

/**
 * Frames for every camp day, including Day 0 (the empty board).
 * Returns [{ order, label, cells, day }] — the caller adds ids and map.
 */
export function buildCampFrames(mapId, territory) {
  const plan = planFor(mapId)
  if (!plan) return []
  const { cols, rows } = territory
  const zones = new Map(zonesFor(mapId).map((z) => [z.id, z]))
  const days = campDays(mapId)
  const base = baseCells(territory)

  // The first company into each zone owns it. `plan.visits` is already in
  // session order, so the first entry per zone is the first arrival.
  const owner = new Map()
  for (const v of plan.visits) if (!owner.has(v.zone)) owner.set(v.zone, v.company)

  return [0, ...days.map((d) => d.n)].map((day, i) => {
    const cells = base.split('')
    const progress = zoneProgress(mapId, day)
    for (const [zoneId, p] of progress) {
      if (!p.visited.length) continue
      const zone = zones.get(zoneId)
      if (!zone) continue
      // Conquered ground is 1ATF's; ground still being worked through belongs
      // to whoever got there first, lightly held until the rest have been.
      const code = owner.get(zoneId) || 'A'
      const mark = p.done ? TASKFORCE_CODE : code.toLowerCase()
      for (const idx of zoneCells(zone, cols, rows)) {
        // RHQ ground is never overpainted — it is the one fixed thing on the
        // board, and S COY NL sits right on top of it.
        if (cells[idx] !== 'R' && cells[idx] !== 'r') cells[idx] = mark
      }
    }
    return { order: i, day, label: campFrameLabel(day, days), cells: cells.join('') }
  })
}

/**
 * A company's own view of a painted grid: their ground, 1ATF's and RHQ's.
 *
 * Used for the COMPANY map, where a cadet should see what THEIR company has
 * taken rather than every other company's working. Done by masking at render
 * time rather than by generating a set of frames per company — the plan is the
 * same plan, and six extra copies of every frame in a shared collection would
 * be six more things to keep in step.
 *
 * TWO things survive the mask deliberately. RHQ, because it is the fixed
 * anchor of the board and a map with one company's scattered holdings and
 * nothing else loses its centre. And 1ATF-held ground, because a conquered
 * zone belongs to the whole task force: if two companies are booked onto an
 * area and both have been, it is taken, and it reads as taken on all six
 * companies' maps — including the four who were never sent there.
 */
export function maskToCompany(cells, company) {
  if (!cells || !company) return cells
  const tf = TASKFORCE_CODE
  const keep = new Set([company, company.toLowerCase(), 'R', 'r', tf, tf.toLowerCase()])
  let out = ''
  for (const ch of cells) out += keep.has(ch) ? ch : '.'
  return out
}

/**
 * One company's board for a given camp day: the mask above, plus THEIR OWN
 * progress restored.
 *
 * The mask alone is not enough, and the reason is the first-visitor rule. The
 * unit frames paint a part-finished zone in the colour of whichever company
 * got there FIRST — so a zone Bravo opened and Alpha has since been through is
 * painted `b`, and masking that to Alpha erases ground Alpha has actually
 * covered. Here every zone the plan says this company has visited is repainted
 * in their own colour, and every zone 1ATF has conquered in the task force's,
 * so a cadet's map shows exactly what they have done plus everything the unit
 * holds.
 *
 * Layered over the masked cells rather than built from scratch, so anything
 * RHQ hand-painted outside the zones (and RHQ's own ground) survives. Maps
 * with no camp plan, and hand-painted frames that carry no day, fall through
 * to the plain mask.
 */
export function companyCells(mapId, cells, cols, rows, company, day) {
  const masked = maskToCompany(cells, company)
  if (!planFor(mapId) || typeof day !== 'number' || !company) return masked
  const zones = new Map(zonesFor(mapId).map((z) => [z.id, z]))
  const arr = masked.split('')
  for (const [zoneId, p] of zoneProgress(mapId, day)) {
    const zone = zones.get(zoneId)
    if (!zone) continue
    const mark = p.done ? TASKFORCE_CODE : (p.visited.includes(company) ? company.toLowerCase() : null)
    if (!mark) continue
    for (const idx of zoneCells(zone, cols, rows)) {
      if (arr[idx] !== 'R' && arr[idx] !== 'r') arr[idx] = mark
    }
  }
  return arr.join('')
}
