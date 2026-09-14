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
//
// `color` here is only the RESTING look — a map with no camp plan, where a
// zone is just a named place. Where there IS a plan, the colour comes from the
// progress ramp below instead and this palette steps back to texture only.
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

/* ------------------------------ kind textures ----------------------------- */
// ⚠️ COLOUR NO LONGER CARRIES PROGRESS. An OKLab red-to-blue ramp did, briefly
// (2026-09-14); it was replaced the same day by painting the ground itself —
// a zone visited 2 of its 13 scheduled times has 2/13 of its CELLS taken, in
// the territory hatch, exactly like everywhere else on the map. A gradient
// asked the reader to learn a second language for the same idea; pixels say it
// in the one the map already speaks. See lib/campFrames.js.
//
// That frees colour to do what it did originally — say what KIND of place this
// is — with three channels so none of it rests on hue alone:
//   COLOUR   teal activity, blue night location, amber headquarters.
//   OUTLINE  activity solid; night location dashed.
//   GLYPH    ▲ activity, ☾ night, ◆ headquarters — survives greyscale, a
//            colour-blind reader and a bad projector alike.
export const ZONE_TEXTURE = {
  activity: { dash: null, glyph: '▲', width: 1.4 },
  nl:       { dash: [2.2, 1.6], glyph: '☾', width: 1.3 },
  hq:       { dash: null, glyph: '◆', width: 1.6 },
}

// A zone's outline/label colour: its kind, always. The territory hatch drawn
// OVER it is what says how much of it has been taken.
export function zoneInk(zone) {
  return (ZONE_STYLE[zone.kind] || ZONE_STYLE.activity).color
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
    const base = ZONE_STYLE[z.kind] || ZONE_STYLE.activity
    const tex = ZONE_TEXTURE[z.kind] || ZONE_TEXTURE.activity
    const p = progress?.get(z.id)
    const ink = zoneInk(z)
    ctx.beginPath()
    z.cells.forEach(([x, y], i) => (i ? ctx.lineTo(x * sx, y * sy) : ctx.moveTo(x * sx, y * sy)))
    ctx.closePath()
    // A faint wash only — the territory hatch above carries the real state.
    ctx.globalAlpha = base.fill
    ctx.fillStyle = ink
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = ink
    ctx.setLineDash((tex.dash || []).map((d) => d * scale))
    ctx.lineWidth = (p?.complete ? 2.4 : tex.width) * scale * 0.5
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.globalAlpha = 1
  // Names last, so no polygon drawn after one buries it.
  const size = 2.4 * sx
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.lineJoin = 'round'
  for (const z of zones) {
    if (!(z.cells?.length >= 3)) continue
    const tex = ZONE_TEXTURE[z.kind] || ZONE_TEXTURE.activity
    const p = progress?.get(z.id)
    const ink = zoneInk(z)
    const [lx, ly] = z.label
    ctx.font = `700 ${size}px Orbitron, monospace`
    ctx.strokeStyle = 'rgba(4,8,16,0.85)'
    ctx.lineWidth = size * 0.22
    const name = `${tex.glyph} ${z.name.toUpperCase()}`
    ctx.strokeText(name, lx * sx, ly * sy - size * 0.55)
    ctx.fillStyle = ink
    ctx.fillText(name, lx * sx, ly * sy - size * 0.55)
    if (!p) continue
    // Visits done of visits scheduled — the same count the painted cells show,
    // for anyone close enough to read it. 1ATF once the last one lands.
    const text = p.complete ? SCU_LABEL : `${p.done}/${p.total}`
    if (!text) continue
    ctx.font = `700 ${size * 0.88}px "JetBrains Mono", monospace`
    ctx.lineWidth = size * 0.2
    ctx.strokeText(text, lx * sx, ly * sy + size * 0.75)
    ctx.fillStyle = p.complete ? TASKFORCE_COLOR : '#d7e2f4'
    ctx.fillText(text, lx * sx, ly * sy + size * 0.75)
  }
  ctx.restore()
}
