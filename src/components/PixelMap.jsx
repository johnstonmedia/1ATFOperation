import { useRef, useEffect, useState, useCallback } from 'react'
import { MAP_IMAGE, MAP_ASPECT } from '../lib/territory'
import { renderTerritoryLayer, IMAGE_FILTER } from '../lib/terrainRender'
import { useOceanOverlayUrl } from '../lib/oceanMask'

const CELL = 8 // fallback canvas pixels per grid cell, used only for the very
                // first paint before the draw effect below measures the
                // container and re-sizes the canvas to its actual on-screen
                // resolution (see sizeCanvasToDisplay in the draw effect —
                // without that, the fixed buffer gets rescaled by the browser
                // at a non-integer ratio, which aliases the hatch lines into
                // a denser, uneven wash than the values below actually ask for)
const ZOOM_SCALE = 2.25

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
  overlay, // optional node rendered inside the zoom/pan stage, above the
           // territory canvas — used by the campaign replay to keep its wave
           // layer and conquest labels aligned with the map under zoom
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
      renderTerritoryLayer(ctx, { cells, cols, rows, showRHQ, w, h })
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
          {overlay}
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
