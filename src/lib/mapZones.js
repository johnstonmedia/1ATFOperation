// Camp zones — the activity areas, night locations and headquarters a map
// carries, as named polygons over the ground.
//
// These are the things cadets actually go TO, as opposed to territory (ground
// held) and map lines (administrative boundaries). Keeping them a separate
// layer matters because they are the unit of PROGRESS: "Alpha has been through
// the ropes course" is a fact about a zone, not about a cell.
//
// GEOMETRY IS CODE, VISIBILITY IS CONTENT. The outlines come from the BIV26
// Google Earth project via tools/map/kml-to-zones.py and are committed — they
// change once a year when the camp plan does, which is a repo change. Whether
// a zone is SHOWN is RHQ's call at any moment, so that lives in a per-map
// `zones` content slice instead (see zonesSlice() in lib/maps.js).
import { ASSURE_BLUE as TASKFORCE_COLOR, SCU_LABEL } from './territory'
import singleton from '../data/singleton-zones.json'

const ZONES = { singleton: singleton.zones }

// One style per kind. Deliberately outside the company palette: a zone is a
// place, not an owner, and must never be mistaken for held ground. Company
// colours arrive on top as territory hatch.
export const ZONE_STYLE = {
  activity: { color: '#36e0c0', fill: 0.10, label: 'Activity area' },
  nl:       { color: '#4ea8ff', fill: 0.09, label: 'Night location' },
  hq:       { color: '#f39c12', fill: 0.12, label: 'Headquarters' },
}

export const KIND_ORDER = ['hq', 'activity', 'nl']

export const zonesFor = (mapId) => ZONES[mapId] || []

// A map's zones as RHQ has them configured. `slice` is the stored
// `{ show, hidden }`; a missing slice means everything shows, so a map works
// the moment its zones are committed without RHQ having to opt in.
export function visibleZones(mapId, slice) {
  const all = zonesFor(mapId)
  if (!all.length) return []
  if (slice && slice.show === false) return []
  const hidden = new Set((slice && slice.hidden) || [])
  return all.filter((z) => !hidden.has(z.id))
}

export const zoneCount = (mapId) => zonesFor(mapId).length

// Group for the ops list and the map key, in a stable order.
export function zonesByKind(mapId) {
  const all = zonesFor(mapId)
  return KIND_ORDER
    .map((kind) => ({ kind, style: ZONE_STYLE[kind], zones: all.filter((z) => z.kind === kind) }))
    .filter((g) => g.zones.length)
}

/**
 * Canvas twin of MapZones.jsx, for the exporters.
 *
 * The Regional map's whole story is its zones — the hatch says who holds the
 * ground, but only the zone outline and name say the ground IS the ropes
 * course. Without this an exported replay of a camp map is anonymous shapes,
 * which is exactly what a poster can't be.
 *
 * `progress` is the optional zoneProgress() Map (see lib/campPlan.js): a zone
 * fills as its companies pass through, and once 1ATF has conquered it the
 * outline and the readout switch to the task force's colour — the same rule
 * the live overlay follows, so page and export can't tell different stories.
 * Sub-cell ground (the eating areas) is skipped: it has no outline, and at
 * poster scale its name lands on top of RHQ's.
 */
export function drawMapZones(ctx, zones, { cols, rows, w, h, scale = 1, progress = null } = {}) {
  if (!zones?.length || !cols || !rows) return
  const sx = w / cols
  const sy = h / rows
  ctx.save()
  ctx.lineJoin = 'round'
  for (const z of zones) {
    if (!(z.cells?.length >= 3)) continue
    const s = ZONE_STYLE[z.kind] || ZONE_STYLE.activity
    const p = progress?.get(z.id)
    ctx.beginPath()
    z.cells.forEach(([x, y], i) => (i ? ctx.lineTo(x * sx, y * sy) : ctx.moveTo(x * sx, y * sy)))
    ctx.closePath()
    ctx.globalAlpha = p ? s.fill + (p.pct / 100) * 0.34 : s.fill
    ctx.fillStyle = s.color
    ctx.fill()
    ctx.globalAlpha = p && p.pct === 0 ? 0.55 : 1
    ctx.strokeStyle = p?.done ? TASKFORCE_COLOR : s.color
    ctx.lineWidth = (p?.done ? 2.4 : 1.4) * scale * 0.5
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  // Names last, so no polygon drawn after one buries it.
  const size = 2.4 * sx
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.lineJoin = 'round'
  for (const z of zones) {
    if (!(z.cells?.length >= 3)) continue
    const s = ZONE_STYLE[z.kind] || ZONE_STYLE.activity
    const p = progress?.get(z.id)
    const [lx, ly] = z.label
    ctx.font = `700 ${size}px Orbitron, monospace`
    ctx.strokeStyle = 'rgba(4,8,16,0.85)'
    ctx.lineWidth = size * 0.22
    ctx.strokeText(z.name.toUpperCase(), lx * sx, ly * sy - size * 0.55)
    ctx.fillStyle = s.color
    ctx.fillText(z.name.toUpperCase(), lx * sx, ly * sy - size * 0.55)
    if (!p) continue
    // Percentage, then WHO: a letter per company while they are still working
    // through it, or 1ATF once every scheduled company has been.
    const who = p.done ? SCU_LABEL : p.visited.join(' ')
    const text = `${p.pct}%${who ? ` ${who}` : ''}`
    ctx.font = `700 ${size * 0.88}px "JetBrains Mono", monospace`
    ctx.lineWidth = size * 0.2
    ctx.strokeText(text, lx * sx, ly * sy + size * 0.75)
    ctx.fillStyle = p.done ? TASKFORCE_COLOR : '#d7e2f4'
    ctx.fillText(text, lx * sx, ly * sy + size * 0.75)
  }
  ctx.restore()
}
