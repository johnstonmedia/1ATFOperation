import { ZONE_STYLE, ZONE_TEXTURE, zoneInk } from '../lib/mapZones'
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
// present, THE ZONE'S COLOUR IS ITS PROGRESS: Meridian red when nobody has
// been, 1ATF blue once every scheduled company has, on an OKLab ramp between
// (see zoneColor in lib/mapZones.js). That replaced a printed percentage — a
// colour is read from across a room and a two-digit number is not.
//
// Colour is therefore spoken for, so KIND is carried by the other channels:
// night locations are dashed and 18% darker, activity areas solid, and each
// name takes a glyph (▲ activity, ☾ night, ◆ headquarters) that survives
// greyscale and colour-blindness. Headquarters stays amber and off the ramp —
// RHQ is not ground the unit has to take.
//
// Without `progress` a zone is a plain outline in its resting kind colour,
// which is what any map with no camp plan gets.
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
        const base = ZONE_STYLE[z.kind] || ZONE_STYLE.activity
        const tex = ZONE_TEXTURE[z.kind] || ZONE_TEXTURE.activity
        const p = progress?.get(z.id)
        const ink = zoneInk(z, progress)
        // The wash deepens as well as shifting hue, so progress is legible
        // even where two zones sit at similar points on the ramp.
        const fill = p ? base.fill + (p.pct / 100) * 0.34 : base.fill
        return (
          <polygon
            key={z.id}
            points={z.cells.map(([x, y]) => `${x},${y}`).join(' ')}
            fill={ink}
            fillOpacity={fill}
            stroke={ink}
            strokeWidth={p?.done ? 2.4 : tex.width}
            strokeDasharray={tex.dash ? tex.dash.join(' ') : undefined}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
      {zones.map((z) => {
        const tex = ZONE_TEXTURE[z.kind] || ZONE_TEXTURE.activity
        const ink = zoneInk(z, progress)
        const tiny = !z.cells?.length
        return (
          <g key={`t-${z.id}`}>
            {/* Ground smaller than one grid cell has no outline to draw, so it
                gets a dot instead — the map can still say where it is. */}
            {tiny && <circle cx={z.label[0]} cy={z.label[1]} r={fontSize * 0.32} fill={ink} />}
            {(!tiny || zoom >= DETAIL_LABEL_ZOOM) && (
            <text
              x={z.label[0]}
              y={z.label[1] - fontSize * 0.55}
              textAnchor="middle"
              fontSize={fontSize}
              fill={ink}
              stroke="rgba(4,8,16,0.85)"
              strokeWidth={fontSize * 0.22}
              paintOrder="stroke"
              style={{ fontFamily: 'Orbitron, monospace', fontWeight: 700, letterSpacing: fontSize * 0.06 }}
            >
              {tex.glyph} {z.name.toUpperCase()}
            </text>
            )}
            {/* Second line: WHO, not how much — the colour carries how much.
                A letter per company that has been, in that company's own
                colour. At 100% the zone has stopped being any one company's:
                every company booked onto it has been through, so it reads
                1ATF, and the outline has reached full assure-blue. */}
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
                {progress.get(z.id).done ? (
                  <tspan fill={ASSURE_BLUE}>{SCU_LABEL}</tspan>
                ) : progress.get(z.id).visited.map((c, i) => (
                  <tspan key={c} fill={COMPANY_COLOR[c] || '#d7e2f4'} dx={i ? fontSize * 0.3 : 0}>{c}</tspan>
                ))}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
