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
//   HELD BY THE  the WHOLE AREA OF OPERATIONS starts the camp as MERIDIAN
//   THREAT       ground — not just the activity areas, every cell inside the
//                Sector 8 boundary the map draws. WHATEVER 1ATF DOES NOT HAVE,
//                MERIDIAN HAS: ground is not empty paddock waiting to be
//                coloured in, it is ground somebody else is standing on. That
//                is what makes a part-taken area read as contested rather than
//                merely unfinished, and it is what the whole portal says the
//                camp is for.
//
//   PART TAKEN   each completed visit's slice is painted in THE COMPANY THAT
//                MADE IT, light — the grid's "newly gained / loosely held"
//                variant — over the Meridian fill, so the remainder of the
//                zone is still visibly the threat's. A part-taken area
//                therefore shows who has been through it in colour, not only
//                how much of it has gone. The companies' share is the light
//                variant and Meridian's is solid on purpose: we have just got
//                there, they are dug in.
//
//   TAKEN        on the LAST scheduled visit the whole zone flips to solid
//                1ATF — the last of the red goes with it, and so do the
//                company colours.
//
//   THE FRONT    the ground BETWEEN the areas is taken too, or Wednesday would
//                end with a map still mostly red. It advances outward from RHQ
//                in step with the camp as a whole (overallProgress — visits
//                done over visits scheduled), so by the last visit on Day 4 it
//                has reached the Sector 8 boundary and 1ATF HAS EVERYTHING.
//                Same conquest order as a zone, same light/solid convention.
//
// ⚠️ A PART-TAKEN AREA IS COLOURED BY COMPANY; A FINISHED ONE IS 1ATF'S
// (2026-09-15 — this REVERSES the "no company ever owns an activity area" rule
// from earlier the same day, at the unit's request; read both before changing
// it back). While an area is still being worked through, each visit's slice
// carries the colour of the company that made it, so the map says WHO has been
// where and not merely how much has gone. The known cost is the one that got
// this removed the first time: a busy area becomes a patchwork, and six
// companies' colours inside one outline can read as six companies competing
// for the same ground.
//
// What keeps that in check is the ending. The moment every scheduled visit is
// done the whole zone flips to SOLID 1ATF, company colours and all — so the
// patchwork is a transient state of ground still being taken, never the
// finished picture, and Wednesday still ends with the task force holding
// everything. The interstitial front between the areas stays 1ATF throughout:
// no company owns the connective ground.
//
// There is ONE map, and it is the unit's. A per-company cut of the board
// existed briefly and was removed: six versions of the same camp is six things
// to keep straight, and showing a cadet only their own company's ground
// undercut the thing the 1ATF stage is there to say — the task force takes the
// training area together.
import { zonesFor } from './mapZones'
import { areaOfOperations } from './mapLines'
import { campDays, overallProgress, planFor, zoneProgress } from './campPlan'
import { zoneCellsOrdered, orderOutward, visitSlice } from './zoneRaster'
import { TASKFORCE_CODE, MERIDIAN_CODE } from './territory'

// RHQ is the one thing already on the board at the start, so the base keeps
// whatever RHQ cells the live map has and blanks everything else. The board is
// not empty for long: buildCampFrames lays Meridian across the whole area of
// operations before 1ATF takes any of it back.
export function baseCells(territory) {
  return (territory.cells || '').replace(/[^Rr]/g, '.')
}

// Where the advance starts: the middle of whatever RHQ holds on the live map
// (Ex Admin Area). Taken off the cells rather than the zone list because RHQ is
// the one thing on the board before the plan starts, and the ground should grow
// out from where the task force actually is. Falls back to the centre of the
// area of operations on a map with no RHQ painted.
function originOf(base, ao, cols) {
  let n = 0, sx = 0, sy = 0
  for (let i = 0; i < base.length; i++) {
    if (base[i] !== 'R' && base[i] !== 'r') continue
    sx += (i % cols) + 0.5; sy += Math.floor(i / cols) + 0.5; n += 1
  }
  if (n) return [sx / n, sy / n]
  for (const i of ao) { sx += (i % cols) + 0.5; sy += Math.floor(i / cols) + 0.5; n += 1 }
  return n ? [sx / n, sy / n] : [0, 0]
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
  // Scaled to THIS territory's grid — zone vertices are authored against a
  // coarser one (see zonesFor).
  const zones = new Map(zonesFor({ id: mapId, cols, rows }).map((z) => [z.id, z]))
  const days = campDays(mapId)
  const base = baseCells(territory)

  // ⚠️ THE AREA OF OPERATIONS, NOT THE WHOLE FRAME. "Everything" is the ground
  // inside the Sector 8 boundary — the same yellow shape the map draws (see
  // areaOfOperations in mapLines.js), so the picture and the claim cannot
  // disagree. West of the Commonwealth boundary and east of the sector line is
  // not ground this camp is contesting, and painting it would say it was.
  const ao = areaOfOperations({ id: mapId, cols, rows })
  const [ox, oy] = originOf(base, ao, cols)
  const advance = orderOutward(ao, cols, ox, oy)

  return [0, ...days.map((d) => d.n)].map((day, i) => {
    const cells = base.split('')
    const progress = zoneProgress(mapId, day)
    // RHQ ground is never overpainted — it is the one fixed thing on the
    // board, and S COY NL sits right on top of it.
    const paintCell = (idx, mark) => {
      if (cells[idx] !== 'R' && cells[idx] !== 'r') cells[idx] = mark
    }

    // 1. The threat holds the whole area of operations...
    for (const idx of ao) paintCell(idx, MERIDIAN_CODE)

    // 2. ...1ATF's front pushes out from RHQ with the camp as a whole. Counted
    // over every AO cell, zones included, so the front sits at an honest
    // radius; the zones then repaint themselves on top at step 3, which is what
    // leaves an unvisited area still red inside ground we have swept past.
    const overall = overallProgress(mapId, day)
    if (overall.total) {
      const front = Math.floor((advance.length * overall.done) / overall.total)
      const mark = overall.done === overall.total ? TASKFORCE_CODE : TASKFORCE_CODE.toLowerCase()
      for (let k = 0; k < front; k++) paintCell(advance[k], mark)
    }

    // 3. Areas, a visit at a time.
    for (const [zoneId, p] of progress) {
      const zone = zones.get(zoneId)
      if (!zone) continue
      const ordered = zoneCellsOrdered(zone, cols, rows)
      const paint = paintCell
      if (p.complete) {
        // The last scheduled visit finishes it: solid, fully held, no red left.
        for (const idx of ordered) paint(idx, TASKFORCE_CODE)
        continue
      }
      // The threat holds the area until we take it off them — including where
      // the front has already gone past it, which is the whole reason the zones
      // paint last.
      for (const idx of ordered) paint(idx, MERIDIAN_CODE)
      // Then a slice per completed visit, in that visit's own company colour,
      // light: taken, not yet consolidated. Plan order is schedule order (see
      // campPlan.js), so visits[i] for i < done are exactly the ones that have
      // happened, and a company booked in twice simply paints two slices.
      for (let i = 0; i < p.done; i++) {
        const [from, to] = visitSlice(ordered.length, i, p.total)
        const mark = (p.visits[i]?.company || TASKFORCE_CODE).toLowerCase()
        for (let k = from; k < to; k++) paint(ordered[k], mark)
      }
    }
    return { order: i, day, label: campFrameLabel(day, days), cells: cells.join('') }
  })
}
