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

// Draw hatch fills + a single neutral outline per boundary edge for `cells`
// onto `ctx`, covering a w x h pixel area. Pure draw — the caller owns canvas
// sizing/clearing.
export function renderTerritoryLayer(ctx, { cells, cols, rows, showRHQ, w, h }) {
  const vis = (c) => (isRHQCode(c) && !showRHQ ? '.' : c)
  const at = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows ? '.' : vis(cells[y * cols + x]))
  const cell = w / cols

  // One pass over the grid, bucketing each cell into a per-owner-code
  // mask canvas (not one full grid pass per code).
  const masks = new Map() // code -> { canvas, ctx }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const code = at(x, y)
      if (!colorOf(code)) continue
      let m = masks.get(code)
      if (!m) {
        const c = document.createElement('canvas')
        c.width = w; c.height = h
        const mctx = c.getContext('2d')
        mctx.fillStyle = '#000'
        m = { canvas: c, ctx: mctx }
        masks.set(code, m)
      }
      m.ctx.fillRect(x * cell, y * cell, cell, cell)
    }
  }

  // Hatch each owner's region: draw the line pattern across the whole
  // canvas, then mask it down to just that owner's cells via
  // destination-in (not a clip() path built from thousands of unioned
  // per-cell rects — that pathologically complex a clip path produced a
  // rasteriser seam artifact when tested).
  const diag = Math.ceil(Math.sqrt(w * w + h * h))
  for (const [code, m] of masks) {
    const col = colorOf(code)
    const layer = document.createElement('canvas')
    layer.width = w; layer.height = h
    const lctx = layer.getContext('2d')
    lctx.save()
    lctx.translate(w / 2, h / 2)
    lctx.rotate((HATCH_ANGLE * Math.PI) / 180)
    lctx.globalAlpha = HATCH_OPACITY
    lctx.strokeStyle = col
    lctx.lineWidth = HATCH_THICKNESS
    if (HATCH_DASH > 0) lctx.setLineDash([HATCH_DASH, HATCH_DASH])
    lctx.beginPath()
    for (let d = -diag; d <= diag; d += HATCH_SPACING) {
      lctx.moveTo(d, -diag)
      lctx.lineTo(d, diag)
    }
    lctx.stroke()
    lctx.restore()
    lctx.globalCompositeOperation = 'destination-in'
    lctx.globalAlpha = 1
    lctx.drawImage(m.canvas, 0, 0)

    ctx.globalAlpha = 1
    ctx.drawImage(layer, 0, 0)
  }

  ctx.globalAlpha = 1
  ctx.strokeStyle = BORDER_COLOR
  ctx.lineWidth = BORDER_WIDTH
  ctx.beginPath()
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
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
