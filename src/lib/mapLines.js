// Vector lines drawn over a map's art: what the imagery itself cannot show.
//
// On Singleton that is the two administrative boundaries — which ground is
// Defence land, and where Sector 8 ends and Sector 9 begins. Satellite imagery
// shows the highway, the rail corridor and every paddock track perfectly well;
// it cannot show a line that exists only on a title deed.
//
// WHY VECTORS AND NOT BAKED INTO THE ART. They used to be drawn into
// singleton.webp. That stopped working the moment the basemap became live SIX
// Maps tiles, because tiles render OVER that image and would bury them. As
// vectors they also stay hairline-crisp at any zoom instead of becoming a 40px
// smear of yellow, which matters now that the map zooms to street level.
//
// ONE SOURCE, THREE RENDERERS: the SVG overlay on screen (MapLines.jsx), the
// canvas pass in the exporters (drawMapLines below), and the map key under the
// map (LINE_KEY, consumed as `artKey` in lib/maps.js). All three read this
// file, so the key cannot end up describing a colour nothing draws.
import singleton from '../data/singleton-boundaries.json'
import { polygonCells } from './zoneRaster'

// Grid-cell polylines per map id, with the grid they were TRACED IN. Traced
// off the AUSPEC0196 sheet — see tools/map/trace-singleton-boundaries.py.
//
// ⚠️ Vertices are cell coordinates, so they are only meaningful against the
// grid they were authored in. The JSON records it, and everything below scales
// to whatever grid the map declares now — which is what let the territory grid
// be refined without re-tracing a single boundary.
const LINES = { singleton: { lines: singleton.lines, grid: singleton.grid } }

// Draw order is casing-then-core: every line gets a dark casing underneath so
// it stays readable over both sunlit paddock and black shadowed timber, which
// a single stroke on real imagery does not.
// ⚠️ The sector line is YELLOW, not green, and that is not a palette tweak.
// The map is Sector 8's; Sector 9 carries no camp activity and is off the
// default view. So this line stopped being an internal division between two
// halves of one picture and became the EASTERN BORDER of the area shown —
// which is the same thing the Commonwealth boundary is on every other side.
// A border drawn in a second colour reads as a different kind of thing, so it
// takes the boundary's yellow and closes the shape. Its narrower width is what
// still distinguishes it up close.
export const LINE_STYLE = {
  defence: { color: '#ffd23c', casing: '#12100422', width: 2.0, casingWidth: 4.6,
             label: 'Area boundary — Commonwealth land' },
  sector:  { color: '#ffd23c', casing: '#12100422', width: 1.6, casingWidth: 3.8,
             label: 'Area boundary — Sector 8 / 9 line (east edge)' },
}

// Which style each traced line uses. The Defence boundary is two polylines
// because it leaves the sheet on the east side and comes back — it is one
// boundary, so both halves share one key and one legend row.
const LINE_KIND = { defence_n: 'defence', defence_s: 'defence', sector: 'sector' }

export const linesFor = (mapId) => LINES[mapId]?.lines || null

// X of the sector line at a given Y, clamped to its endpoints outside the span
// it was traced over. The sector line is the area's eastern edge, so this is
// "how far east does Sector 8 reach at this latitude".
function sectorXAt(sector, y) {
  if (!sector?.length) return Infinity
  if (y <= sector[0][1]) return sector[0][0]
  if (y >= sector[sector.length - 1][1]) return sector[sector.length - 1][0]
  for (let i = 1; i < sector.length; i++) {
    const [x0, y0] = sector[i - 1]
    const [x1, y1] = sector[i]
    if (y >= y0 && y <= y1) {
      const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0)
      return x0 + (x1 - x0) * t
    }
  }
  return sector[sector.length - 1][0]
}

/**
 * Keep only the part of a boundary that bounds SECTOR 8.
 *
 * The traced Commonwealth boundary wraps the whole sheet — Sector 8 and Sector
 * 9 together — because that is what the survey sheet draws. The map is Sector
 * 8's, so the eastern two-thirds of that line is the boundary of ground this
 * map is not about, and drawing it put a big empty enclosure next to the one
 * that matters. Each run that strays east of the sector line is dropped, and
 * the cut is interpolated ONTO the sector line so the remaining boundary meets
 * it exactly rather than stopping short — Sector 8 stays a closed shape.
 */
function clipToSector(points, sector) {
  const out = []
  let run = []
  const inside = (p) => p[0] <= sectorXAt(sector, p[1])
  const crossing = (a, b) => {
    // Bisect for the point where the polyline segment meets the sector line;
    // the sector line is itself a polyline, so there is no closed form and a
    // dozen halvings is well inside a tenth of a cell.
    let lo = 0, hi = 1
    for (let i = 0; i < 12; i++) {
      const m = (lo + hi) / 2
      const p = [a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m]
      if (inside(p)) lo = m
      else hi = m
    }
    return [a[0] + (b[0] - a[0]) * lo, a[1] + (b[1] - a[1]) * lo]
  }
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    if (inside(p)) {
      if (!run.length && i > 0) run.push(crossing(p, points[i - 1]))
      run.push(p)
    } else {
      if (run.length) { run.push(crossing(run[run.length - 1], p)); out.push(run); run = [] }
    }
  }
  if (run.length) out.push(run)
  return out.filter((r) => r.length >= 2)
}

/**
 * Each polyline as { points, kind, style }, in draw order, in the CURRENT
 * grid's coordinates. Empty for a map that declares none, which is every map
 * but Singleton.
 *
 * `map` may be a map record or just an id; passing the record is what lets the
 * traced vertices be scaled to a grid finer than the one they were traced in.
 */
export function mapLines(map) {
  const id = typeof map === 'string' ? map : map?.id
  const entry = LINES[id]
  if (!entry) return []
  const sx = typeof map === 'object' && map?.cols ? map.cols / entry.grid.cols : 1
  const sy = typeof map === 'object' && map?.rows ? map.rows / entry.grid.rows : 1
  const scale = (pts) => (sx === 1 && sy === 1 ? pts : pts.map(([x, y]) => [x * sx, y * sy]))

  const sector = entry.lines.sector || null
  const out = []
  for (const [key, points] of Object.entries(entry.lines)) {
    const kind = LINE_KIND[key] || 'defence'
    // Sector 9's share of the Commonwealth boundary is not this map's border.
    const runs = kind === 'defence' && sector ? clipToSector(points, sector) : [points]
    runs.forEach((run, i) => out.push({
      key: runs.length > 1 ? `${key}-${i}` : key, kind, points: scale(run), style: LINE_STYLE[kind],
    }))
  }
  return out
}

// Legend rows — one per KIND, not per polyline, so the split Defence boundary
// doesn't list itself twice.
export const LINE_KEY = Object.values(LINE_STYLE).map((s) => ({ color: s.color, label: s.label }))

// Canvas pass for the exporters, so an exported still or video carries the
// same boundaries the page shows. Widths are in the same units as the on-screen
// stroke, scaled by how much bigger the export canvas is than the map art.
export function drawMapLines(ctx, map, W, H) {
  const lines = mapLines(map)
  if (!lines.length) return
  const sx = W / map.cols
  const sy = H / map.rows
  const k = W / map.pixelWidth
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const pass of ['casing', 'core']) {
    for (const { points, style } of lines) {
      ctx.strokeStyle = pass === 'casing' ? style.casing : style.color
      ctx.lineWidth = (pass === 'casing' ? style.casingWidth : style.width) * k
      ctx.beginPath()
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x * sx, y * sy) : ctx.moveTo(x * sx, y * sy)))
      ctx.stroke()
    }
  }
  ctx.restore()
}

/* ----------------------------- area of operations ----------------------------- */

// The AREA OF OPERATIONS as a list of grid cells: inside the Commonwealth land
// boundary AND west of the sector line. That is the same shape the yellow lines
// draw on the map, which is the point — "the ground this map is about" should
// be the ground the map says it is about, not a second definition kept in step
// by hand.
//
// The two traced Defence polylines are one boundary that leaves the sheet on
// the east side and comes back (see LINE_KIND), so `defence_n` followed by
// `defence_s` closes into a ring across the sheet edge with no stitching.
// Clipping to Sector 8 is then just a per-cell test against sectorXAt rather
// than a second polygon, which is why this does not reuse clipToSector: that
// cuts POLYLINES for drawing, and a filled shape wants a predicate.
const aoCache = new Map()

export function areaOfOperations(map) {
  const id = typeof map === 'string' ? map : map?.id
  const entry = LINES[id]
  const cols = typeof map === 'object' ? map?.cols : null
  const rows = typeof map === 'object' ? map?.rows : null
  if (!entry || !cols || !rows) return []
  const key = `${id}:${cols}x${rows}`
  const hit = aoCache.get(key)
  if (hit) return hit

  const sx = cols / entry.grid.cols
  const sy = rows / entry.grid.rows
  const scale = (pts) => pts.map(([x, y]) => [x * sx, y * sy])
  const north = entry.lines.defence_n || []
  const south = entry.lines.defence_s || []
  const ring = scale([...north, ...south])
  const sector = entry.lines.sector ? scale(entry.lines.sector) : null
  const keep = sector ? (cx, cy) => cx <= sectorXAt(sector, cy) : null

  const cells = polygonCells(ring, cols, rows, keep)
  aoCache.set(key, cells)
  return cells
}
