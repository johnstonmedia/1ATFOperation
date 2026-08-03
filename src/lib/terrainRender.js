import { colorOf, isRHQCode } from './territory'

// Shared territory-layer renderer. PixelMap's on-screen canvas and the
// campaign-replay video exporter both draw the same hatch + boundary look
// through this one function, so the exported video matches the live map
// instead of drifting into a second, slightly different implementation.

export const IMAGE_FILTER = 'contrast(140%) sepia(60%) brightness(75%) saturate(92%)'

// Territory fill: diagonal hatch per owner colour (not a flat wash) — a flat
// tint sat over the terrain and washed out detail underneath it, worst under
// Meridian red on a large holding. Hatch keeps the terrain visible through
// the gaps while staying legible at any zoom, including when one side holds
// most of the map. Tuned interactively against the real map art — see
// CHANGELOG for the comparison process.
const HATCH_ANGLE = 45 // degrees
const HATCH_SPACING = 9.6 // px between lines at the target canvas resolution
const HATCH_THICKNESS = 3.1 // px
const HATCH_OPACITY = 0.48
const HATCH_DASH = 0 // 0 = solid lines

// Boundary border: one neutral colour for every edge regardless of which two
// owners meet there — deliberately not per-owner, since two adjacent cells
// each stroking their own colour let whichever side rasterised later
// silently overwrite the other's line.
const BORDER_COLOR = 'rgba(6, 10, 18, 0.6)'
const BORDER_WIDTH = 3

// Full-canvas hatch line patterns don't depend on the cells at all — only on
// the owner colour and the canvas size — so they're cached across draws.
// Without this, every repaint re-stroked hundreds of diagonal lines per owner
// code AND allocated two full-size canvases per code, which is what made the
// map stutter while the brush was dragging (each painted cell triggers a
// redraw). The cache is tiny: one canvas per code per canvas size in use.
const hatchCache = new Map() // `${code}|${w}x${h}` -> canvas
const HATCH_CACHE_MAX = 48

function hatchFor(code, w, h) {
  const key = `${code}|${w}x${h}`
  let cv = hatchCache.get(key)
  if (cv) return cv
  if (hatchCache.size >= HATCH_CACHE_MAX) hatchCache.clear() // e.g. after many resizes
  cv = document.createElement('canvas')
  cv.width = w; cv.height = h
  const lctx = cv.getContext('2d')
  const diag = Math.ceil(Math.sqrt(w * w + h * h))
  lctx.save()
  lctx.translate(w / 2, h / 2)
  lctx.rotate((HATCH_ANGLE * Math.PI) / 180)
  lctx.globalAlpha = HATCH_OPACITY
  lctx.strokeStyle = colorOf(code)
  lctx.lineWidth = HATCH_THICKNESS
  if (HATCH_DASH > 0) lctx.setLineDash([HATCH_DASH, HATCH_DASH])
  lctx.beginPath()
  for (let d = -diag; d <= diag; d += HATCH_SPACING) {
    lctx.moveTo(d, -diag)
    lctx.lineTo(d, diag)
  }
  lctx.stroke()
  lctx.restore()
  hatchCache.set(key, cv)
  return cv
}

// One reusable scratch canvas for masking the hatch down to a code's cells
// (draws are synchronous, so sequential reuse across codes — and across the
// live map / exporter — is safe). Avoids per-draw canvas allocation churn.
//
// Sized to the REGION being drawn, not the whole map. This matters a lot:
// the mask uses `source-in`, which is a global composite — the browser
// reprocesses the entire scratch canvas however small the rect we draw into
// it. With a full-map scratch that made every brush stroke pay for a
// full-resolution composite per owner colour (the dominant cost in a CPU
// profile of painting). Rounded up to a 128px grid so a moving stroke reuses
// one canvas instead of reallocating every frame.
let scratch = null
function scratchFor(w, h) {
  const q = (v) => Math.max(128, Math.ceil(v / 128) * 128)
  const W = q(w), H = q(h)
  // Grow to fit; shrink only when the canvas is far larger than needed, so a
  // full redraw followed by small strokes doesn't keep paying full-size cost.
  if (!scratch || scratch.width < W || scratch.height < H || scratch.width * scratch.height > W * H * 4) {
    scratch = document.createElement('canvas')
    scratch.width = W
    scratch.height = H
  }
  return scratch
}

// Draw hatch fills + a single neutral outline per boundary edge for `cells`
// onto `ctx`, covering a w x h pixel area. Pure draw — the caller owns canvas
// sizing (and clearing, for a full redraw).
//
// `region` ({x0,y0,x1,y1} inclusive CELL bounds) restricts the work to a
// patch of the grid — this is what keeps brush strokes cheap. Painting used
// to re-run the whole-grid loop plus several full-canvas composites on every
// pointer event, which is most of a frame's budget at device resolution; a
// stroke only ever dirties a handful of cells, so PixelMap passes the dirty
// bounds and we redraw just those. The region is cleared and clipped, so
// nothing outside it is touched (the pixels there are already correct) and
// border strokes can't bleed out and double-darken over repeated strokes.
export function renderTerritoryLayer(ctx, { cells, cols, rows, showRHQ, w, h, region }) {
  const vis = (c) => (isRHQCode(c) && !showRHQ ? '.' : c)
  const at = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows ? '.' : vis(cells[y * cols + x]))
  const cell = w / cols

  const x0 = region ? Math.max(0, region.x0) : 0
  const y0 = region ? Math.max(0, region.y0) : 0
  const x1 = region ? Math.min(cols - 1, region.x1) : cols - 1
  const y1 = region ? Math.min(rows - 1, region.y1) : rows - 1
  if (x1 < x0 || y1 < y0) return
  const rx = x0 * cell, ry = y0 * cell
  const rw = (x1 - x0 + 1) * cell, rh = (y1 - y0 + 1) * cell

  if (region) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(rx, ry, rw, rh)
    ctx.clip()
    ctx.clearRect(rx, ry, rw, rh)
  }

  // One pass over the (sub)grid, bucketing each code's cells into a rect list.
  const buckets = new Map() // code -> [x, y, x, y, ...]
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const code = at(x, y)
      if (!colorOf(code)) continue
      let b = buckets.get(code)
      if (!b) { b = []; buckets.set(code, b) }
      b.push(x, y)
    }
  }

  // Hatch each owner's region: fill the code's cells on the scratch canvas,
  // then source-in the cached full-canvas hatch pattern so it survives only
  // inside those cells (not a clip() path built from thousands of unioned
  // per-cell rects — that pathologically complex a clip path produced a
  // rasteriser seam artifact when tested). source-in also clears whatever the
  // scratch held outside the drawn area, so it self-cleans between codes.
  // Scratch works in REGION-local coordinates (cell rects shifted by -rx/-ry);
  // the hatch pattern is still sampled from the full-canvas cache at the
  // region's offset, so the lines stay aligned to the map rather than to the
  // patch being redrawn.
  const sc = scratchFor(rw, rh)
  const sctx = sc.getContext('2d')
  for (const [code, b] of buckets) {
    sctx.globalCompositeOperation = 'source-over'
    sctx.clearRect(0, 0, sc.width, sc.height)
    sctx.fillStyle = '#000'
    for (let i = 0; i < b.length; i += 2) sctx.fillRect(b[i] * cell - rx, b[i + 1] * cell - ry, cell, cell)
    sctx.globalCompositeOperation = 'source-in'
    sctx.drawImage(hatchFor(code, w, h), rx, ry, rw, rh, 0, 0, rw, rh)

    ctx.globalAlpha = 1
    ctx.drawImage(sc, 0, 0, rw, rh, rx, ry, rw, rh)
  }

  ctx.globalAlpha = 1
  ctx.strokeStyle = BORDER_COLOR
  ctx.lineWidth = BORDER_WIDTH
  ctx.beginPath()
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const code = at(x, y)
      if (!colorOf(code)) continue
      const px = x * cell, py = y * cell
      if (at(x - 1, y) !== code) { ctx.moveTo(px, py); ctx.lineTo(px, py + cell) }
      if (at(x + 1, y) !== code) { ctx.moveTo(px + cell, py); ctx.lineTo(px + cell, py + cell) }
      if (at(x, y - 1) !== code) { ctx.moveTo(px, py); ctx.lineTo(px + cell, py) }
      if (at(x, y + 1) !== code) { ctx.moveTo(px, py + cell); ctx.lineTo(px + cell, py + cell) }
    }
  }
  ctx.stroke()

  if (region) ctx.restore()
}

// Draw one animation instant of a transition's conquest wave onto `ctx`
// (flat tints, deliberately cheaper than the hatch layer — the wave redraws
// every animation frame, the hatch only redraws once per timeline commit).
// `plan` comes from transitionPlan(); `t` is 0..1 progress. Cells appear in
// wave-rank order with a bright leading edge; ground lost to nobody sweeps
// dark instead.
export function renderWaveLayer(ctx, plan, t, { cols, rows, w, h }) {
  const cw = w / cols, ch = h / rows
  for (const cl of plan.clusters) {
    const front = t * (cl.maxRank + 1)
    for (const c of cl.cells) {
      if (c.r > front) continue
      const isFront = front - c.r < 1.6
      const px = c.x * cw, py = c.y * ch
      if (cl.color) {
        ctx.globalAlpha = isFront ? 0.95 : 0.78
        ctx.fillStyle = cl.color
        ctx.fillRect(px, py, cw + 0.5, ch + 0.5)
        if (isFront) {
          ctx.globalAlpha = 0.5
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(px, py, cw + 0.5, ch + 0.5)
        }
      } else {
        ctx.globalAlpha = isFront ? 0.9 : 0.55
        ctx.fillStyle = '#060a12'
        ctx.fillRect(px, py, cw + 0.5, ch + 0.5)
      }
    }
  }
  ctx.globalAlpha = 1
}
