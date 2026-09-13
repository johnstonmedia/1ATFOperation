import { ZONE_STYLE } from '../lib/mapZones'

// Zone overlay: outlines + names, between the map art and the territory hatch.
//
// UNDER the hatch on purpose. A zone says "this is the ropes course"; the
// hatch says "Alpha holds this ground". When a company takes a zone you want
// to see their colour ON it, not the zone outline fighting through the top.
//
// One SVG in GRID coordinates, like MapLines — so zone vertices are the same
// cell coordinates as everything else on the map and need no conversion.
// `zoom` scales the stroke and type back down so a zone name stays the same
// size on screen at 8x as at 1x, the same rule beacons and company labels
// follow.
// Sub-cell ground (the eating areas, the field kitchen) sits inside RHQ, a
// few tens of metres apart. At 1x their names land on top of each other and on
// RHQ's own, which is worse than not drawing them. They declutter by zoom, the
// way a paper map does: the dot is always there, the name appears once there is
// room for it. RHQ can also hide them outright from Map: Territory.
const DETAIL_LABEL_ZOOM = 2.5

export default function MapZones({ map, zones, zoom = 1 }) {
  if (!map || !zones?.length) return null
  const fontSize = 2.4 / Math.max(zoom, 1)
  return (
    <svg
      viewBox={`0 0 ${map.cols} ${map.rows}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      {zones.filter((z) => z.cells?.length >= 3).map((z) => {
        const s = ZONE_STYLE[z.kind] || ZONE_STYLE.activity
        return (
          <polygon
            key={z.id}
            points={z.cells.map(([x, y]) => `${x},${y}`).join(' ')}
            fill={s.color}
            fillOpacity={s.fill}
            stroke={s.color}
            strokeWidth={1.4}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
      {zones.map((z) => {
        const s = ZONE_STYLE[z.kind] || ZONE_STYLE.activity
        const tiny = !z.cells?.length
        return (
          <g key={`t-${z.id}`}>
            {/* Ground smaller than one grid cell has no outline to draw, so it
                gets a dot instead — the map can still say where it is. */}
            {tiny && <circle cx={z.label[0]} cy={z.label[1]} r={fontSize * 0.32} fill={s.color} />}
            {(!tiny || zoom >= DETAIL_LABEL_ZOOM) && (
            <text
              x={z.label[0]}
              y={z.label[1] - fontSize * 0.55}
              textAnchor="middle"
              fontSize={fontSize}
              fill={s.color}
              stroke="rgba(4,8,16,0.85)"
              strokeWidth={fontSize * 0.22}
              paintOrder="stroke"
              style={{ fontFamily: 'Orbitron, monospace', fontWeight: 700, letterSpacing: fontSize * 0.06 }}
            >
              {z.name.toUpperCase()}
            </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
