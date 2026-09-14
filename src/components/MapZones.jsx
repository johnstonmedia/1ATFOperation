import { ZONE_STYLE } from '../lib/mapZones'
import { ASSURE_BLUE, SCU_LABEL } from '../lib/territory'
import { COMPANIES } from '../firebase/seed'

const COMPANY_COLOR = COMPANIES.reduce((a, c) => ({ ...a, [c.letter]: c.accent }), {})

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

// `progress` (optional) is the Map from lib/campPlan.js zoneProgress(). When
// present a zone shows how far through its plan it is: the outline fills as
// companies pass through, and the name carries the percentage and the letters
// of whoever has been. Without it zones are plain outlines, which is what the
// map looked like before there was a camp plan and what any map without one
// still gets.
export default function MapZones({ map, zones, zoom = 1, progress = null }) {
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
        const p = progress?.get(z.id)
        // Untouched ground stays at the base wash; a zone fills as its
        // companies pass through, so "how far along is camp" is readable from
        // the map itself without reading a single number.
        const fill = p ? s.fill + (p.pct / 100) * 0.34 : s.fill
        return (
          <polygon
            key={z.id}
            points={z.cells.map(([x, y]) => `${x},${y}`).join(' ')}
            fill={s.color}
            fillOpacity={fill}
            stroke={p?.done ? ASSURE_BLUE : s.color}
            strokeWidth={p?.done ? 2.4 : 1.4}
            strokeOpacity={p && p.pct === 0 ? 0.55 : 1}
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
            {/* Second line: the percentage, then WHO. While companies are
                still working through it, that is a letter each in their own
                colour, so the map answers "who" as well as "how much" without
                a legend. At 100% the zone has stopped being any one company's
                — every company booked onto it has been through, so it is
                1ATF's, and it says so on the unit map and on all six company
                maps alike. */}
            {progress?.get(z.id) && (!tiny || zoom >= DETAIL_LABEL_ZOOM) && (
              <text
                x={z.label[0]}
                y={z.label[1] + fontSize * 0.75}
                textAnchor="middle"
                fontSize={fontSize * 0.88}
                stroke="rgba(4,8,16,0.85)"
                strokeWidth={fontSize * 0.2}
                paintOrder="stroke"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}
              >
                <tspan fill={progress.get(z.id).done ? ASSURE_BLUE : '#d7e2f4'}>
                  {progress.get(z.id).pct}%
                </tspan>
                {progress.get(z.id).done ? (
                  <tspan fill={ASSURE_BLUE} dx={fontSize * 0.3}>{SCU_LABEL}</tspan>
                ) : progress.get(z.id).visited.map((c) => (
                  <tspan key={c} fill={COMPANY_COLOR[c] || '#d7e2f4'} dx={fontSize * 0.3}>{c}</tspan>
                ))}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
