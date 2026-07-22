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

// Hex colour for a cell code (lowercase = lighter, loosely-held variant).
export function colorOf(code) {
  if (!code || code === '.') return null
  const up = code.toUpperCase()
  const base = BASE_COLOR[up]
  if (!base) return null
  return code === up ? base : lighten(base, 0.5)
}
