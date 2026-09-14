import { mapLines } from '../lib/mapLines'

// Boundary overlay for a map that declares vector lines (see lib/mapLines.js).
//
// SVG rather than another canvas: the lines have to stay hairline-thin at every
// zoom level, and `vector-effect: non-scaling-stroke` gives that for free
// inside PixelMap's scale transform. A canvas would need re-rasterising on
// every zoom step to avoid a 40px smear, for no gain.
//
// `preserveAspectRatio="none"` is deliberate — the viewBox is the territory
// GRID, so the polylines are in the same cell coordinates as everything else
// on the map and stretch with it exactly.
export default function MapLines({ map }) {
  const lines = mapLines(map)
  if (!lines.length) return null
  return (
    <svg
      viewBox={`0 0 ${map.cols} ${map.rows}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      {/* Casings first, all of them, so one line's bright core is never cut
          by the next line's dark casing where the two meet. */}
      {['casing', 'core'].map((pass) =>
        lines.map(({ key, points, style }) => (
          <polyline
            key={pass + key}
            points={points.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none"
            stroke={pass === 'casing' ? style.casing : style.color}
            strokeWidth={pass === 'casing' ? style.casingWidth : style.width}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )),
      )}
    </svg>
  )
}
