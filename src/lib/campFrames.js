// Build the campaign replay from the camp plan.
//
// One frame per camp day, painted from the schedule — so the public replay
// animates camp day by day with no hand painting at all. This is only possible
// because the plan is settled in advance (see campPlan.js); it is generation,
// not recording.
//
// GROUND IS TAKEN A VISIT AT A TIME, IN PIXELS.
//
// A zone is not an on/off thing and it is not a gradient either: it is taken
// CELL BY CELL, in proportion to the visits the plan schedules into it. NAVEX
// is visited 13 times across camp, so after 2 of those visits 2/13 of NAVEX's
// cells are painted — in the colour of the company that made each of those
// visits — and the rest is still open ground. That is the percentage made out
// of the same pixels the rest of the map is made of, which is why it replaced
// a colour ramp: the map already has a language for "held", and a zone half
// taken should look half taken rather than a different hue.
//
// Cells are allocated in CONQUEST ORDER (zoneCellsOrdered — outward from the
// zone's label), so ground grows from the middle instead of flickering about
// between frames, and visit i owns a contiguous slice of that order.
//
//   PART TAKEN   each completed visit's slice is painted in LIGHT 1ATF —
//                the grid's existing "newly gained / loosely held" variant.
//
//   TAKEN        on the LAST scheduled visit the whole zone flips to solid
//                1ATF.
//
// ⚠️ NO COMPANY EVER OWNS AN ACTIVITY AREA. The ground is the task force's
// from the first pixel: an area is a PERCENTAGE TAKEOVER, not a prize one
// company holds until another arrives. Painting each visit in its own
// company's colour (which this did briefly) made a busy area a patchwork that
// read as six companies competing for the same ground, and made "who holds
// the ropes course" a question with a misleading answer. Companies still do
// the conquering — the plan says who is where, the visit counts come from it,
// and RHQ can still paint company ground by hand anywhere else on the map —
// but what the area shows is how much of it 1ATF has taken.
//
// There is ONE map, and it is the unit's. A per-company cut of the board
// existed briefly and was removed: six versions of the same camp is six things
// to keep straight, and showing a cadet only their own company's ground
// undercut the thing the 1ATF stage is there to say — the task force takes the
// training area together.
import { zonesFor } from './mapZones'
import { campDays, planFor, zoneProgress } from './campPlan'
import { zoneCellsOrdered, visitSlice } from './zoneRaster'
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

  return [0, ...days.map((d) => d.n)].map((day, i) => {
    const cells = base.split('')
    const progress = zoneProgress(mapId, day)
    for (const [zoneId, p] of progress) {
      if (!p.done) continue
      const zone = zones.get(zoneId)
      if (!zone) continue
      const ordered = zoneCellsOrdered(zone, cols, rows)
      // RHQ ground is never overpainted — it is the one fixed thing on the
      // board, and S COY NL sits right on top of it.
      const paint = (idx, mark) => {
        if (cells[idx] !== 'R' && cells[idx] !== 'r') cells[idx] = mark
      }
      if (p.complete) {
        // The last scheduled visit finishes it: solid, fully held.
        for (const idx of ordered) paint(idx, TASKFORCE_CODE)
        continue
      }
      // Otherwise the completed visits' share of the ground is taken but not
      // yet consolidated — light 1ATF, the same "newly gained" variant the
      // rest of the map uses.
      const [, to] = visitSlice(ordered.length, p.done - 1, p.total)
      const mark = TASKFORCE_CODE.toLowerCase()
      for (let k = 0; k < to; k++) paint(ordered[k], mark)
    }
    return { order: i, day, label: campFrameLabel(day, days), cells: cells.join('') }
  })
}
