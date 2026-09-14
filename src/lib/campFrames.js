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
// There is ONE map, and it is the unit's. A per-company cut of the board
// existed briefly and was removed: six versions of the same camp is six things
// to keep straight, and showing a cadet only their own company's ground
// undercut the thing the 1ATF stage is there to say — the task force takes the
// training area together.
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
