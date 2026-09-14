// Build the campaign replay from the camp plan.
//
// One frame per camp day, painted from the schedule — so the public replay
// animates camp day by day with no hand painting at all. This is only possible
// because the plan is settled in advance (see campPlan.js); it is generation,
// not recording.
//
// WHO OWNS A ZONE. The FIRST company scheduled into a zone takes it, and keeps
// it. Later companies pass through without changing hands, because a progress
// map that churns ground between friendly companies reads as confusion rather
// than progress — and "conquered" means taken from the Meridian, which happens
// once.
//
// HOW HELD IT IS uses the grid's existing light/solid convention: a zone whose
// scheduled companies have not all been through yet is painted LOWERCASE
// ("newly gained / loosely held"); once every company on its plan has been, it
// goes UPPERCASE (firmly held). So the map both spreads and consolidates as
// camp runs, without inventing any new cell codes.
import { zonesFor } from './mapZones'
import { campDays, planFor, zoneProgress } from './campPlan'
import { zoneCells } from './zoneRaster'

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
      const code = owner.get(zoneId) || 'A'
      const mark = p.done ? code : code.toLowerCase()
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
 * A company's own view of a painted grid: their ground and RHQ's, nothing else.
 *
 * Used for the COMPANY map, where a cadet should see what THEIR company has
 * taken rather than the whole task force's board. Done by masking at render
 * time rather than by generating a set of frames per company — the plan is the
 * same plan, and six extra copies of every frame in a shared collection would
 * be six more things to keep in step.
 *
 * RHQ survives the mask deliberately: it is the fixed anchor of the board, and
 * a map with a company's scattered holdings and nothing else loses its centre.
 */
export function maskToCompany(cells, company) {
  if (!cells || !company) return cells
  const keep = new Set([company, company.toLowerCase(), 'R', 'r'])
  let out = ''
  for (const ch of cells) out += keep.has(ch) ? ch : '.'
  return out
}
