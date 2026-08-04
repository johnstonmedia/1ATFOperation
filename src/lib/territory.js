import { COMPANIES } from '../firebase/seed'

// Pixel-grid territory system. Territory is a fixed grid overlaid on the NSW
// pixel-art image; each cell holds a single-character colour-state code:
//   '.'            empty
//   A B C D E S    the six companies (solid / firmly held)
//   M              Meridian
//   R              RHQ (optional — only shown when the map's showRHQ is on)
//   lowercase      the "lighter" variant: newly gained / loosely held
//
// Grid is sized so each cell maps to an exact 3x3 block of source-image
// pixels (648x336 / 3 = 216x112) — keeps the colourable grid pixel-aligned
// to the actual map art instead of an arbitrary overlay resolution.
export const TERR_COLS = 216
export const TERR_ROWS = 112
export const MAP_IMAGE = import.meta.env.BASE_URL + 'map/nsw-terrain.png'
export const MAP_ASPECT = 648 / 336 // the base image's aspect ratio
export const MAP_PIXEL_WIDTH = 648
export const MAP_PIXEL_HEIGHT = 336

// Solid ocean fill colour in the source image — cells that sample as
// majority-ocean can't be painted (see lib/oceanMask.js).
export const OCEAN_COLOR = '#3c82b4'

const MERIDIAN_COLOR = '#ff3b46'
const RHQ_COLOR = COMPANIES.find((c) => c.letter === 'R')?.accent || '#f39c12'

// Paint palette on the recruit map = six companies + Meridian.
export const PAINT = [
  ...COMPANIES.filter((c) => c.letter !== 'R').map((c) => ({ code: c.letter, label: c.name, color: c.accent })),
  { code: 'M', label: 'Meridian', color: MERIDIAN_COLOR },
]
export const RHQ_PAINT = { code: 'R', label: 'RHQ', color: RHQ_COLOR }

const BASE_COLOR = {}
;[...PAINT, RHQ_PAINT].forEach((p) => { BASE_COLOR[p.code] = p.color })

export function lighten(hex, amt = 0.5) {
  const n = parseInt(hex.slice(1), 16)
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  r = Math.round(r + (255 - r) * amt)
  g = Math.round(g + (255 - g) * amt)
  b = Math.round(b + (255 - b) * amt)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

export const isRHQCode = (code) => !!code && code.toUpperCase() === 'R'

/* ------------------------------ occupancy ------------------------------ */
// Who holds a given point on the map. Used by the persistent occupier
// beacons on place labels (see components/Beacon.jsx) — the map itself is a
// flat cell grid with no zone entities, so a "zone" here is the named place
// and its occupier is whoever holds the ground around it.

// Colour a stronghold beacon switches to once SCU has retaken it —
// deliberately NOT one of the six company accents, so a recaptured
// stronghold reads as a unit-wide win at a glance. Single source of truth:
// change this one value to restyle every recaptured stronghold.
export const ASSURE_BLUE = '#1e9bff'
export const SCU_LABEL = '1ATF'

export const isMeridianCode = (code) => !!code && code.toUpperCase() === 'M'
// Everything that isn't Meridian or empty belongs to SCU / 1ATF.
export const isSCUCode = (code) => !!code && code !== '.' && !isMeridianCode(code)

// Full display name for an owner code ('a' -> 'Alpha', 'M' -> 'Meridian').
export function labelOf(code) {
  if (!code || code === '.') return null
  const up = code.toUpperCase()
  return [...PAINT, RHQ_PAINT].find((p) => p.code === up)?.label || null
}

// Unit-style short label used on the map: companies read as "A-COY", while
// RHQ and the Meridian threat keep their own names.
export function coyLabelOf(code) {
  if (!code || code === '.') return null
  const up = code.toUpperCase()
  if (isMeridianCode(up)) return 'MERIDIAN'
  if (isRHQCode(up)) return 'RHQ'
  return labelOf(up) ? `${up}-COY` : null
}

// Majority owner of the cells around (x, y). Sampled over a small radius
// rather than read from the single cell under the label, because a place
// marker often sits on a boundary or an unpainted pixel while the ground
// around it is clearly held. Returns the uppercase base code, or null when
// the area is mostly unclaimed. `showRHQ: false` hides RHQ holdings, matching
// how the territory layer itself renders them.
export function occupierAt(territory, x, y, { radius = 3, showRHQ = true } = {}) {
  const { cols, rows, cells } = territory
  if (!cells) return null
  const tally = new Map()
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = Math.round(x) + dx
      const ny = Math.round(y) + dy
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
      const ch = cells[ny * cols + nx]
      if (!ch || ch === '.') continue
      const up = ch.toUpperCase()
      if (isRHQCode(up) && !showRHQ) continue
      tally.set(up, (tally.get(up) || 0) + 1)
    }
  }
  let best = null, bestN = 0
  for (const [code, n] of tally) if (n > bestN) { best = code; bestN = n }
  return best
}


// Everything the UI needs to draw one place's occupier beacon.
// `stronghold` marks a Meridian stronghold (place.hostile) — once SCU holds
// the ground under one, it flips to the assure-blue "1ATF" recaptured state
// (SCU_LABEL — the on-map tag, distinct from the unit's own SCU name).
export function beaconStateFor(territory, place, { showRHQ = true } = {}) {
  const owner = occupierAt(territory, place.x, place.y, { showRHQ })
  const stronghold = !!place.hostile
  const recaptured = stronghold && isSCUCode(owner)
  if (recaptured) {
    return { owner, stronghold, recaptured: true, color: ASSURE_BLUE, tag: SCU_LABEL, pulse: true }
  }
  return {
    owner,
    stronghold,
    recaptured: false,
    // Unheld stronghold keeps the threat-red marker it has always had.
    color: owner ? colorOf(owner) : (stronghold ? MERIDIAN_COLOR : null),
    tag: coyLabelOf(owner),
    pulse: stronghold,
  }
}

// Hex colour for a cell code (lowercase = lighter, loosely-held variant).
export function colorOf(code) {
  if (!code || code === '.') return null
  const up = code.toUpperCase()
  const base = BASE_COLOR[up]
  if (!base) return null
  return code === up ? base : lighten(base, 0.5)
}
