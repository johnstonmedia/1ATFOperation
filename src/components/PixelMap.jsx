import { useRef, useEffect, useState, useCallback } from 'react'
import { MAP_IMAGE, MAP_ASPECT, colorOf, isRHQCode } from '../lib/territory'
import { useOceanOverlayUrl } from '../lib/oceanMask'

const CELL = 8 // fallback canvas pixels per grid cell, used only for the very
                // first paint before the draw effect below measures the
                // container and re-sizes the canvas to its actual on-screen
                // resolution (see sizeCanvasToDisplay in the draw effect —
                // without that, the fixed buffer gets rescaled by the browser
                // at a non-integer ratio, which aliases the hatch lines into
                // a denser, uneven wash than the values below actually ask for)
const ZOOM_SCALE = 2.25
const IMAGE_FILTER = 'contrast(140%) sepia(60%) brightness(75%) saturate(92%)'

// Territory fill: diagonal hatch per owner colour (not a flat wash) — a flat
// tint sat over the terrain and washed out detail underneath it, worst under
// Meridian red on a large holding. Hatch keeps the terrain visible through
// the gaps while staying legible at any zoom, including when one side holds
// most of the map. Tuned interactively against the real map art — see
// CHANGELOG for the comparison process.
const HATCH_ANGLE = 45 // degrees
const HATCH_SPACING = 9.6 // px between lines, at the canvas's native (device-pixel) resolution — 20% denser than the original 12px tune
const HATCH_THICKNESS = 3.1 // px
const HATCH_OPACITY = 0.48
const HATCH_DASH = 0 // 0 = solid lines

// Boundary border: one neutral colour for every edge regardless of which two
// owners meet there — deliberately not per-owner, since two adjacent cells
// each stroking their own colour let whichever side rasterised later
// silently overwrite the other's line.
const BORDER_COLOR = 'rgba(6, 10, 18, 0.6)'
const BORDER_WIDTH = 3

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Pixel-grid territory map over the NSW image.
//
// Interaction model (deliberately simple — pinch/wheel zoom fought the page's
// own scroll on both touch and trackpad, so neither exists here anymore):
//  - read-only (no `edit`): a single "+" button zooms to one fixed step
//    (centred); once zoomed, click-and-drag pans. At the default 1x there's
//    nothing to pan, so touch gestures pass through to normal page scroll.
//  - edit mode: no zoom, no pan at all — the full grid always fits the
//    container. One finger/click paints; that's the only gesture.
export default function PixelMap({
  territory,
  edit = false,
  brush = '.',
  brushSize = 1,
  onPaint,
  onMovePlace,
  maxWidth,
}) {
  const { cols, rows, cells, showRHQ } = territory
  const places = territory.places || []
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const stageRef = useRef(null)
  const [zoomed, setZoomed] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragOrigin = useRef(null) // { pointerId, lastX, lastY } | { pointerId, painting: true }
  const dragging = useRef(null) // place-label id being dragged
  const oceanOverlayUrl = useOceanOverlayUrl(edit)

  const scale = edit ? 1 : (zoomed ? ZOOM_SCALE : 1)

  useEffect(() => { setPan({ x: 0, y: 0 }) }, [zoomed, edit])

  // Draw hatch fills + a single neutral outline per boundary edge whenever
  // the grid changes, or the container is resized. The canvas's native pixel
  // buffer is sized to match its actual on-screen resolution (not a fixed
  // cols*CELL multiplier left for the browser to rescale) — a periodic
  // pattern like hatch lines aliases badly under the nearest-neighbour scale
  // `image-rendering: pixelated` otherwise applies at a non-integer ratio.
  useEffect(() => {
    const cv = canvasRef.current
    const container = containerRef.current
    if (!cv || !container) return

    const vis = (c) => (isRHQCode(c) && !showRHQ ? '.' : c)
    const at = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows ? '.' : vis(cells[y * cols + x]))

    function draw() {
      const rect = container.getBoundingClientRect()
      if (!rect.width) return
      const dpr = window.devicePixelRatio || 1
      const cell = (rect.width * dpr) / cols
      const w = Math.max(1, Math.round(cols * cell))
      const h = Math.max(1, Math.round(rows * cell))
      cv.width = w
      cv.height = h
      const ctx = cv.getContext('2d')
      ctx.clearRect(0, 0, w, h)

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

    draw()

    let resizeTimer = null
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(draw, 120)
    })
    ro.observe(container)
    return () => { clearTimeout(resizeTimer); ro.disconnect() }
  }, [cells, cols, rows, showRHQ])

  const clampPan = useCallback((p, s) => {
    const el = containerRef.current
    const W = el?.clientWidth || 1
    const H = el?.clientHeight || 1
    const maxX = (W * (s - 1)) / (2 * s)
    const maxY = (H * (s - 1)) / (2 * s)
    return { x: clamp(p.x, -maxX, maxX), y: clamp(p.y, -maxY, maxY) }
  }, [])

  const cellFromEvent = useCallback((e) => {
    const st = stageRef.current
    if (!st) return null
    const r = st.getBoundingClientRect()
    const x = Math.floor(((e.clientX - r.left) / r.width) * cols)
    const y = Math.floor(((e.clientY - r.top) / r.height) * rows)
    if (x < 0 || y < 0 || x >= cols || y >= rows) return null
    return { x, y }
  }, [cols, rows])

  const paintAt = useCallback((e) => {
    if (!edit || !onPaint) return
    const c = cellFromEvent(e)
    if (!c) return
    onPaint(c.x, c.y, brush, brushSize)
  }, [edit, onPaint, cellFromEvent, brush, brushSize])

  const onPointerDown = (e) => {
    if (dragging.current) return
    if (edit) {
      if (!onPaint) return
      containerRef.current?.setPointerCapture?.(e.pointerId)
      dragOrigin.current = { pointerId: e.pointerId, painting: true }
      paintAt(e)
    } else if (scale > 1) {
      containerRef.current?.setPointerCapture?.(e.pointerId)
      dragOrigin.current = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY }
    }
  }

  const onPointerMove = (e) => {
    if (dragging.current && onMovePlace) {
      const c = cellFromEvent(e)
      if (c) onMovePlace(dragging.current, c.x, c.y)
      return
    }
    const o = dragOrigin.current
    if (!o || o.pointerId !== e.pointerId) return
    if (o.painting) {
      paintAt(e)
    } else {
      const dx = e.clientX - o.lastX, dy = e.clientY - o.lastY
      o.lastX = e.clientX
      o.lastY = e.clientY
      setPan((p) => clampPan({ x: p.x + dx / scale, y: p.y + dy / scale }, scale))
    }
  }

  const endPointer = (e) => {
    if (dragOrigin.current?.pointerId === e.pointerId) dragOrigin.current = null
    dragging.current = null
  }

  // Only trap touch gestures on the map when there's something to drag
  // (painting, or panning while zoomed) — otherwise let normal page-scroll
  // swipes pass straight through instead of getting stuck on the map.
  const capturesTouch = edit || scale > 1

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: maxWidth || 'none' }}>
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: String(MAP_ASPECT),
          overflow: 'hidden',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--line)',
          background: '#0a0f1a',
          touchAction: capturesTouch ? 'none' : 'auto',
          cursor: edit ? 'crosshair' : (scale > 1 ? 'grab' : 'default'),
        }}
      >
        <div
          ref={stageRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            transformOrigin: 'center center',
            transform: `scale(${scale}) translate(${pan.x}px, ${pan.y}px)`,
          }}
        >
          <img src={MAP_IMAGE} alt="NSW operational map" draggable={false}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated', userSelect: 'none', filter: IMAGE_FILTER }} />
          {edit && oceanOverlayUrl && (
            <img src={oceanOverlayUrl} alt="" draggable={false}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated', userSelect: 'none', pointerEvents: 'none' }} />
          )}
          <canvas ref={canvasRef} width={cols * CELL} height={rows * CELL}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated', pointerEvents: 'none' }} />
          {places.map((p) => {
            const hostile = !!p.hostile
            return (
              <div key={p.id}
                onPointerDown={onMovePlace ? (e) => { e.stopPropagation(); dragging.current = p.id } : undefined}
                style={{ position: 'absolute', left: `${(p.x / cols) * 100}%`, top: `${(p.y / rows) * 100}%`, transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', pointerEvents: onMovePlace ? 'auto' : 'none', cursor: onMovePlace ? 'move' : 'default' }}>
                {hostile ? (
                  <span style={{ position: 'relative', width: 16, height: 16, flex: '0 0 auto' }}>
                    <span className="ping-ring" />
                    <span style={{ position: 'absolute', inset: 3, borderRadius: '50%', background: 'var(--hostile)', boxShadow: '0 0 10px var(--hostile), 0 0 18px var(--hostile)' }} />
                  </span>
                ) : (
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#dfe6f2', boxShadow: '0 0 5px #dfe6f2', display: 'inline-block' }} />
                )}
                <span style={{
                  color: '#fff', fontWeight: 700, font: "700 11px 'JetBrains Mono',monospace",
                  ...(hostile
                    ? { background: 'rgba(6,10,18,0.8)', padding: '2px 6px', borderRadius: 3, border: '1px solid var(--hostile)' }
                    : { color: '#d3dced', fontWeight: 600, textShadow: '0 1px 3px #000' }),
                }}>{p.name}</span>
              </div>
            )
          })}
        </div>
      </div>
      {!edit && (
        <button
          className="ghost"
          onClick={() => setZoomed((z) => !z)}
          aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
          style={{ position: 'absolute', right: 8, bottom: 8, padding: '2px 12px', fontSize: 16, lineHeight: 1 }}
        >
          {zoomed ? '−' : '+'}
        </button>
      )}
    </div>
  )
}
