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

// Grid-cell polylines per map id. Traced off the AUSPEC0196 sheet — see
// tools/map/trace-singleton-boundaries.py.
const LINES = { singleton: singleton.lines }

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

export const linesFor = (mapId) => LINES[mapId] || null

// Each polyline as { points, kind, style }, in draw order. Empty for a map
// that declares none, which is every map but Singleton.
export function mapLines(mapId) {
  const set = linesFor(mapId)
  if (!set) return []
  return Object.entries(set).map(([key, points]) => {
    const kind = LINE_KIND[key] || 'defence'
    return { key, kind, points, style: LINE_STYLE[kind] }
  })
}

// Legend rows — one per KIND, not per polyline, so the split Defence boundary
// doesn't list itself twice.
export const LINE_KEY = Object.values(LINE_STYLE).map((s) => ({ color: s.color, label: s.label }))

// Canvas pass for the exporters, so an exported still or video carries the
// same boundaries the page shows. Widths are in the same units as the on-screen
// stroke, scaled by how much bigger the export canvas is than the map art.
export function drawMapLines(ctx, map, W, H) {
  const lines = mapLines(map?.id)
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
