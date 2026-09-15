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
import { COMPANIES } from '../firebase/seed'
import singleton from '../data/singleton-zones.json'

const COMPANY_COLOR = COMPANIES.reduce((a, c) => ({ ...a, [c.letter]: c.accent }), {})

// ⚠️ Zone vertices are CELL COORDINATES, so they only mean anything against
// the grid they were authored in. The JSON records that grid and `zonesFor`
// scales to whatever the map declares now — which is what let the territory
// grid be refined without re-running the KML importer.
const ZONE_DATA = { singleton: { zones: singleton.zones, grid: singleton.grid } }

const scaleCache = new Map()

function scaledZones(mapId, cols, rows) {
  const entry = ZONE_DATA[mapId]
  if (!entry) return []
  const sx = cols / entry.grid.cols
  const sy = rows / entry.grid.rows
  if (sx === 1 && sy === 1) return entry.zones
  const key = `${mapId}:${cols}x${rows}`
  const hit = scaleCache.get(key)
  if (hit) return hit
  const out = entry.zones.map((z) => ({
    ...z,
    cells: (z.cells || []).map(([x, y]) => [x * sx, y * sy]),
    label: z.label ? [z.label[0] * sx, z.label[1] * sy] : z.label,
  }))
  scaleCache.set(key, out)
  return out
}

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

// `map` may be a map record (scaled to its grid) or a bare id (as authored).
export function zonesFor(map) {
  const id = typeof map === 'string' ? map : map?.id
  if (typeof map === 'object' && map?.cols) return scaledZones(id, map.cols, map.rows)
  return ZONE_DATA[id]?.zones || []
}

// A map's zones as RHQ has them configured. `slice` is the stored
// `{ show, hidden }`; a missing slice means everything shows, so a map works
// the moment its zones are committed without RHQ having to opt in.
export function visibleZones(map, slice) {
  const all = zonesFor(map)
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
export function drawMapZones(ctx, zones, { cols, rows, w, h, scale = 1, progress = null, zoneScale = 1, printLabels = false } = {}) {
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

  // PRINT MODE: the area's NAME and WHO HAS BEEN THROUGH IT, on one line.
  //
  // Names were briefly replaced by numbered badges with a lookup table, and
  // that was the wrong trade: a map you have to cross-reference to read is not
  // a map of anywhere. What actually made names unreadable was printing the
  // NAME, the visit count AND a row of company letters at each one as THREE
  // LINES over two dozen areas — it was the stacking that broke it, not the
  // content.
  //
  // So the company letters are back on the ground (2026-09-15), in their own
  // colours, on a SECOND LINE under the name. They earn the room: the painted
  // pixels already say how much of an area is taken, so the fraction is
  // readable off the map, but "has my company done the ropes course yet" is
  // not — and that is the question these sheets actually get asked. The COUNT
  // stays in the bottom band, where it is an exact figure instead of a third
  // thing competing with the name.
  //
  // ⚠️ A SECOND LINE, NOT A LONGER ONE. Appending the letters to the name was
  // tried first and was worse than either: "▲ HIGH ROPES A B C E S" is nearly
  // twice the width of the name, and WIDTH is what the declutter cannot solve
  // — it can only nudge vertically, so in a tight cluster AA MIKE ended up
  // buried under HIGH ROPES. Stacked, the block is only as wide as the name
  // (the letters are always narrower), so horizontal conflicts stay exactly as
  // rare as they were with names alone.
  //
  // Placement is DECLUTTERED rather than trusted: labels are placed biggest
  // area first (the big ones have the strongest claim to their own centre) and
  // any that would overlap one already down is nudged vertically until it is
  // clear. A label that cannot be cleared is still drawn — losing an area's
  // name entirely is worse than a tight fit.
  if (printLabels) {
    const size = (w / cols) * (cols / 90) * zoneScale
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.font = `700 ${size}px Orbitron, sans-serif`
    const placed = []
    // Sub-cell ground (the eating areas, the field kitchen) is skipped, the
    // same rule the screen applies past DETAIL_LABEL_ZOOM: they sit metres
    // apart inside RHQ, so on one sheet their names land on top of each other
    // and on RHQ's. They have no outline to label anyway.
    const order = [...zones].filter((z) => z.cells?.length >= 3)
      .sort((a, b) => (b.cells?.length || 0) - (a.cells?.length || 0))
    const NAME_FONT = `700 ${size}px Orbitron, sans-serif`
    const COY_FONT = `700 ${size * 0.92}px "JetBrains Mono", monospace`
    const gap = size * 0.42
    const LINE2 = size * 0.95          // baseline drop to the company line
    for (const z of order) {
      const st = ZONE_STYLE[z.kind] || ZONE_STYLE.activity
      const tex = ZONE_TEXTURE[z.kind] || ZONE_TEXTURE.activity
      const name = `${tex.glyph} ${z.name.toUpperCase()}`
      // A letter per company through it so far. Attribution WITHOUT ownership:
      // the ground is 1ATF's whoever walked it (an area is a percentage
      // takeover, not a company's prize), but the letters say who did the
      // walking. An area nobody has reached yet simply has no second line.
      const who = progress?.get(z.id)?.visited || []
      ctx.font = NAME_FONT
      const nameW = ctx.measureText(name).width
      ctx.font = COY_FONT
      const coyW = who.length
        ? who.reduce((a, k) => a + ctx.measureText(k).width, 0) + gap * (who.length - 1)
        : 0
      // The block is as wide as its widest line and as tall as it needs; the
      // declutter works on the BLOCK, so a two-line label can't be treated as
      // if it were one line tall.
      const tw = Math.max(nameW, coyW)
      const th = who.length ? size + LINE2 : size
      const bx = z.label[0] * sx
      let by = z.label[1] * sy
      const hits = (yy, xx) => placed.some((r) => Math.abs(r.x - xx) < (r.w + tw) / 2 + size * 0.3
        && Math.abs(r.y - yy) < (r.h + th) / 2 + size * 0.25)
      // ⚠️ THE SEARCH IS 2-D. Nudging only up and down cannot clear a cluster:
      // High Ropes, AA Lima, AA Mike, AA Juliet and NL Romeo all sit within a
      // few hundred metres of each other, and with vertical moves alone the
      // last one placed had nowhere left to go and landed on a neighbour.
      // Candidates are ordered by ring, vertical-first within each ring, so a
      // label only moves sideways when straight up or down is taken.
      const stepY = th * 1.1
      const stepX = size * 2.2
      let bxx = bx
      const cands = [[0, 0]]
      for (let r = 1; r <= 4; r++) for (const dx of [0, -1, 1, -2, 2]) cands.push([dx, -r], [dx, r])
      for (const [dx, dy] of cands) {
        bxx = bx + dx * stepX
        by = z.label[1] * sy + dy * stepY
        if (!hits(by, bxx)) break
      }
      placed.push({ x: bxx, y: by, w: tw, h: th })
      ctx.strokeStyle = 'rgba(4,8,16,0.9)'
      ctx.font = NAME_FONT
      ctx.lineWidth = size * 0.26
      ctx.strokeText(name, bxx, by)
      ctx.fillStyle = st.color
      ctx.fillText(name, bxx, by)
      if (!who.length) continue
      ctx.font = COY_FONT
      ctx.lineWidth = size * 0.24
      ctx.textAlign = 'left'
      let cx = bxx - coyW / 2
      for (const k of who) {
        ctx.strokeText(k, cx, by + LINE2)
        ctx.fillStyle = COMPANY_COLOR[k] || '#d7e2f4'
        ctx.fillText(k, cx, by + LINE2)
        cx += ctx.measureText(k).width + gap
      }
      ctx.textAlign = 'center'
    }
    ctx.restore()
    return
  }

  // Names last, so no polygon drawn after one buries it.
  // Frame-relative, not cell-relative — see the same note in MapZones.jsx.
  // `zoneScale` lets print ask for larger type than the screen wants.
  const size = (w / cols) * (cols / 90) * zoneScale
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
    // Visits done of visits scheduled, then WHO HAS BEEN — a letter per
    // company in its own colour. The ground is 1ATF's either way (an area is a
    // percentage takeover, not a company's prize), but "has my company done the
    // ropes course" is the question a cadet actually asks of these sheets, so
    // the attribution is printed even though the ownership isn't.
    const count = p.complete ? `${p.total}/${p.total}` : `${p.done}/${p.total}`
    const who = p.visited || []
    ctx.font = `700 ${size * 0.88}px "JetBrains Mono", monospace`
    ctx.lineWidth = size * 0.2
    const gap = size * 0.34
    const parts = [{ t: count, c: p.complete ? TASKFORCE_COLOR : '#d7e2f4' },
      ...who.map((k) => ({ t: k, c: COMPANY_COLOR[k] || '#d7e2f4' }))]
    const wTot = parts.reduce((n, q) => n + ctx.measureText(q.t).width, 0) + gap * (parts.length - 1)
    let cx = lx * sx - wTot / 2
    const by = ly * sy + size * 0.8
    ctx.textAlign = 'left'
    for (const q of parts) {
      ctx.strokeText(q.t, cx, by)
      ctx.fillStyle = q.c
      ctx.fillText(q.t, cx, by)
      cx += ctx.measureText(q.t).width + gap
    }
    ctx.textAlign = 'center'
  }
  ctx.restore()
}
