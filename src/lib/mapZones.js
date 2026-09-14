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

/* ----------------------------- progress colour ---------------------------- */
// A zone's colour IS its progress: Meridian red when nobody has been, 1ATF
// assure-blue once every scheduled company has, and a continuous ramp between.
// This replaced a printed percentage — a colour is read across a room, a
// two-digit number is not, and the map already has enough small type on it.
//
// INTERPOLATED IN OKLAB, and the choice of path matters more than the choice
// of space. A constant-chroma sweep (OKLCH, short way round) keeps every step
// vivid but runs red → magenta → violet → blue, straight through Support's
// #c9528a and Delta's #8e54c4 — a half-finished zone would wear a company's
// colour while belonging to no company. A straight OKLab lerp instead passes
// through LOW CHROMA: chroma falls 0.230 → 0.083 at the midpoint and climbs
// back to 0.179. Nothing in the middle of the ramp can be mistaken for a
// company accent, and "contested, drained of allegiance" is the right reading
// for ground half the unit has yet to see. Lightness barely moves (0.657 →
// 0.676), so every step stays equally legible over dark satellite imagery.
//
// ⚠️ That constant lightness means the ramp carries NO information in
// greyscale. On a mono print every state is the same mid grey — which is why
// kind and completeness are also carried by texture and by the label, never by
// hue alone. See ZONE_TEXTURE.
const MERIDIAN_OK = [0.6566, 0.2103, 0.0925]   // #ff3b46
const TASKFORCE_OK = [0.6760, -0.0628, -0.1673] // #1e9bff

// Night locations take the same ramp at 82% lightness. It is one systematic
// move rather than a second palette, so a night location and an activity area
// at the same progress are recognisably the same colour — just after dark.
const NL_LIGHTNESS = 0.82

const srgb = (c) => {
  const v = Math.max(0, Math.min(1, c))
  return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055))
}
const hex2 = (n) => n.toString(16).padStart(2, '0')

// OKLab -> sRGB hex (Björn Ottosson's matrices).
function oklabHex(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  return `#${hex2(srgb(r))}${hex2(srgb(g))}${hex2(srgb(bl))}`
}

/**
 * The colour of a zone at `pct` (0..100) of its companies having been through.
 * `kind` only darkens it: night locations sit at NL_LIGHTNESS of the ramp.
 */
export function zoneColor(pct, kind = 'activity') {
  const p = Math.max(0, Math.min(1, (Number(pct) || 0) / 100))
  const L = MERIDIAN_OK[0] + (TASKFORCE_OK[0] - MERIDIAN_OK[0]) * p
  const a = MERIDIAN_OK[1] + (TASKFORCE_OK[1] - MERIDIAN_OK[1]) * p
  const b = MERIDIAN_OK[2] + (TASKFORCE_OK[2] - MERIDIAN_OK[2]) * p
  return oklabHex(kind === 'nl' ? L * NL_LIGHTNESS : L, a, b)
}

/**
 * How a kind is drawn, now that COLOUR is spoken for by progress.
 *
 * Three orthogonal channels carry "what kind of place is this", so none of
 * them has to fight the ramp:
 *   LIGHTNESS  night locations at 82% L — darker, literally after dark.
 *   OUTLINE    activity areas solid; night locations dashed.
 *   GLYPH      a marker before the name, which survives greyscale, a
 *              colour-blind reader and a bad projector alike.
 * Headquarters is not on the ramp at all: RHQ is not ground the unit has to
 * take, it is where the unit already is, so it keeps its amber and its solid
 * outline whatever the plan says.
 */
export const ZONE_TEXTURE = {
  activity: { dash: null, glyph: '▲', width: 1.4 },
  nl:       { dash: [2.2, 1.6], glyph: '☾', width: 1.3 },
  hq:       { dash: null, glyph: '◆', width: 1.6, fixedColor: '#f39c12' },
}

// The colour a zone should actually be drawn in: the progress ramp where there
// is progress to show, its resting kind colour where there isn't, and amber
// for headquarters either way.
export function zoneInk(zone, progress) {
  const tex = ZONE_TEXTURE[zone.kind] || ZONE_TEXTURE.activity
  if (tex.fixedColor) return tex.fixedColor
  const p = progress?.get(zone.id)
  if (!p) return (ZONE_STYLE[zone.kind] || ZONE_STYLE.activity).color
  return zoneColor(p.pct, zone.kind)
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
    const base = ZONE_STYLE[z.kind] || ZONE_STYLE.activity
    const tex = ZONE_TEXTURE[z.kind] || ZONE_TEXTURE.activity
    const p = progress?.get(z.id)
    const ink = zoneInk(z, progress)
    ctx.beginPath()
    z.cells.forEach(([x, y], i) => (i ? ctx.lineTo(x * sx, y * sy) : ctx.moveTo(x * sx, y * sy)))
    ctx.closePath()
    ctx.globalAlpha = p ? base.fill + (p.pct / 100) * 0.34 : base.fill
    ctx.fillStyle = ink
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = ink
    ctx.setLineDash((tex.dash || []).map((d) => d * scale))
    ctx.lineWidth = (p?.done ? 2.4 : tex.width) * scale * 0.5
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
    const ink = zoneInk(z, progress)
    const [lx, ly] = z.label
    ctx.font = `700 ${size}px Orbitron, monospace`
    ctx.strokeStyle = 'rgba(4,8,16,0.85)'
    ctx.lineWidth = size * 0.22
    const name = `${tex.glyph} ${z.name.toUpperCase()}`
    ctx.strokeText(name, lx * sx, ly * sy - size * 0.55)
    ctx.fillStyle = ink
    ctx.fillText(name, lx * sx, ly * sy - size * 0.55)
    if (!p) continue
    // WHO, not how much — the colour is the percentage now. A letter per
    // company while they are still working through it; 1ATF once they all have.
    const text = p.done ? SCU_LABEL : p.visited.join(' ')
    if (!text) continue
    ctx.font = `700 ${size * 0.88}px "JetBrains Mono", monospace`
    ctx.lineWidth = size * 0.2
    ctx.strokeText(text, lx * sx, ly * sy + size * 0.75)
    ctx.fillStyle = p.done ? TASKFORCE_COLOR : '#d7e2f4'
    ctx.fillText(text, lx * sx, ly * sy + size * 0.75)
  }
  ctx.restore()
}
