import { useRef, useEffect, useState, useCallback } from 'react'
import { MAP_IMAGE, MAP_ASPECT, beaconStateFor } from '../lib/territory'
import { renderTerritoryLayer, IMAGE_FILTER } from '../lib/terrainRender'
import Beacon from './Beacon'
import { useOceanOverlayUrl } from '../lib/oceanMask'

const CELL = 8 // fallback canvas pixels per grid cell, used only for the very
                // first paint before the draw effect below measures the
                // container and re-sizes the canvas to its actual on-screen
                // resolution (see sizeCanvasToDisplay in the draw effect —
                // without that, the fixed buffer gets rescaled by the browser
                // at a non-integer ratio, which aliases the hatch lines into
                // a denser, uneven wash than the values below actually ask for)
const MAX_SCALE = 4 // gesture-zoom ceiling

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Pixel-grid territory map over the NSW image.
//
// Interaction model — natural gestures, no zoom buttons:
//  - Zoom: mouse wheel / trackpad scroll or pinch (trackpad pinch arrives as a
//    ctrlKey wheel event), and two-finger touch pinch. Zoom is anchored at
//    the cursor / pinch centre. At 1x a wheel that would zoom OUT is passed
//    through untouched so the page still scrolls normally past the map.
//  - Pan: read-only mode — one-finger / mouse drag once zoomed in (at 1x
//    there's nothing to pan, so touch swipes scroll the page). Edit mode —
//    one finger/click always PAINTS, so panning uses a two-finger touch drag
//    or a middle/right mouse drag instead.
export default function PixelMap({
  territory,
  edit = false,
  brush = '.',
  brushSize = 1,
  onPaint, // (points: [{x, y}, ...], brush, brushSize) — one call per stroke
           // segment, points pre-interpolated into a continuous line

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
  // view = continuous zoom + pan. Pan is in pre-scale units: the stage
  // transform is `scale(s) translate(x, y)`, so a rendered point (relative
  // to the container centre) sits at s * (stagePoint + pan).
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const viewRef = useRef(view)
  viewRef.current = view
  const dragOrigin = useRef(null) // { pointerId, lastX, lastY } | { pointerId, painting: true }
  const dragging = useRef(null) // place-label id being dragged
  const touches = useRef(new Map()) // active touch pointers, for pinch
  const pinch = useRef(null) // { d0, c0, s0, t0 } while a two-finger pinch is live
  const oceanOverlayUrl = useOceanOverlayUrl(edit)

  const scale = view.scale

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

    // Coalesce to at most one full redraw per display frame. While painting,
    // pointermove events (and therefore cells-prop changes) can outpace the
    // frame rate — drawing synchronously on every one made brush strokes
    // stutter.
    let raf = requestAnimationFrame(draw)

    let resizeTimer = null
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(draw, 120)
    })
    ro.observe(container)
    return () => { cancelAnimationFrame(raf); clearTimeout(resizeTimer); ro.disconnect() }
  }, [cells, cols, rows, showRHQ])

  const clampPan = useCallback((p, s) => {
    const el = containerRef.current
    const W = el?.clientWidth || 1
    const H = el?.clientHeight || 1
    const maxX = (W * (s - 1)) / (2 * s)
    const maxY = (H * (s - 1)) / (2 * s)
    return { x: clamp(p.x, -maxX, maxX), y: clamp(p.y, -maxY, maxY) }
  }, [])

  // Zoom keeping the container point `c` (relative to the centre) anchored:
  // solve s2*(v + t2) = c for the stage point v that was under c at (s1, t1).
  const zoomAt = useCallback((c, factor) => {
    setView((v) => {
      const s2 = clamp(v.scale * factor, 1, MAX_SCALE)
      if (s2 === v.scale) return v
      if (s2 === 1) return { scale: 1, x: 0, y: 0 }
      const t2 = {
        x: c.x / s2 - c.x / v.scale + v.x,
        y: c.y / s2 - c.y / v.scale + v.y,
      }
      const p = clampPan(t2, s2)
      return { scale: s2, ...p }
    })
  }, [clampPan])

  // Wheel / trackpad zoom. Attached manually (not via React's onWheel) so the
  // listener is non-passive and may preventDefault — but ONLY when it actually
  // zooms: at 1x, a wheel that would zoom out is left alone so the page keeps
  // scrolling normally past the map.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e) => {
      const delta = e.deltaY * (e.deltaMode === 1 ? 33 : 1)
      // Trackpad pinches arrive as ctrlKey wheel events with small deltas —
      // give them a stronger response than plain scrolling.
      const factor = Math.exp(-delta * (e.ctrlKey ? 0.012 : 0.002))
      if (viewRef.current.scale === 1 && factor <= 1) return // pass through to page scroll
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt({ x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 }, factor)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  // Two-finger pinch: zoom anchored at the moving pinch centre (which also
  // gives two-finger panning for free). Any live paint/pan drag is cancelled
  // the moment a second finger lands, so pinching never leaves a stray stroke.
  const pinchUpdate = () => {
    const pts = [...touches.current.values()]
    if (pts.length < 2) return
    const el = containerRef.current
    const r = el.getBoundingClientRect()
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1
    const c = {
      x: (pts[0].x + pts[1].x) / 2 - r.left - r.width / 2,
      y: (pts[0].y + pts[1].y) / 2 - r.top - r.height / 2,
    }
    if (!pinch.current) {
      pinch.current = { d0: d, c0: c, s0: viewRef.current.scale, t0: { x: viewRef.current.x, y: viewRef.current.y } }
      dragOrigin.current = null
      lastPaintCell.current = null
      return
    }
    const { d0, c0, s0, t0 } = pinch.current
    const s2 = clamp(s0 * (d / d0), 1, MAX_SCALE)
    const t2 = s2 === 1
      ? { x: 0, y: 0 }
      : clampPan({ x: c.x / s2 - c0.x / s0 + t0.x, y: c.y / s2 - c0.y / s0 + t0.y }, s2)
    setView({ scale: s2, ...t2 })
  }

  const cellFromEvent = useCallback((e) => {
    const st = stageRef.current
    if (!st) return null
    const r = st.getBoundingClientRect()
    const x = Math.floor(((e.clientX - r.left) / r.width) * cols)
    const y = Math.floor(((e.clientY - r.top) / r.height) * rows)
    if (x < 0 || y < 0 || x >= cols || y >= rows) return null
    return { x, y }
  }, [cols, rows])

  // Painting a stroke: pointer events are SAMPLED, so a fast drag only fires
  // a handful of moves — stamping just at each event painted a dotted line
  // with gaps. Instead we remember the last painted cell and walk a Bresenham
  // line from it to every new sample (including the finer-grained coalesced
  // events browsers batch between frames), so strokes come out continuous no
  // matter how fast the pointer moves.
  const lastPaintCell = useRef(null)

  const strokeTo = useCallback((c, out) => {
    const from = lastPaintCell.current
    if (!from) {
      out.push(c)
      lastPaintCell.current = c
      return
    }
    if (from.x === c.x && from.y === c.y) return
    let { x, y } = from
    const dx = Math.abs(c.x - x), sx = x < c.x ? 1 : -1
    const dy = -Math.abs(c.y - y), sy = y < c.y ? 1 : -1
    let err = dx + dy
    while (x !== c.x || y !== c.y) {
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x += sx }
      if (e2 <= dx) { err += dx; y += sy }
      out.push({ x, y })
    }
    lastPaintCell.current = c
  }, [])

  const paintAt = useCallback((e) => {
    if (!edit || !onPaint) return
    // Coalesced events give the pointer's true path between frames, not just
    // the last position — finer input for the line interpolation above.
    const samples = typeof e.getCoalescedEvents === 'function' && e.getCoalescedEvents().length
      ? e.getCoalescedEvents()
      : [e]
    const pts = [] // whole stroke segment batched into ONE onPaint call
    for (const s of samples) {
      const c = cellFromEvent(s)
      if (c) strokeTo(c, pts)
    }
    if (pts.length) onPaint(pts, brush, brushSize)
  }, [edit, onPaint, cellFromEvent, strokeTo, brush, brushSize])

  const onPointerDown = (e) => {
    if (dragging.current) return
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (touches.current.size >= 2) {
        containerRef.current?.setPointerCapture?.(e.pointerId)
        pinchUpdate() // second finger down: cancel any drag, arm the pinch
        return
      }
    }
    if (edit) {
      if (!onPaint) return
      containerRef.current?.setPointerCapture?.(e.pointerId)
      // Middle/right mouse drag pans the (possibly zoomed) editor; everything
      // else — left button, pen, single finger — paints.
      if (e.pointerType === 'mouse' && e.button !== 0) {
        e.preventDefault() // stop middle-click autoscroll
        dragOrigin.current = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY }
        return
      }
      dragOrigin.current = { pointerId: e.pointerId, painting: true }
      lastPaintCell.current = null
      const c = cellFromEvent(e)
      if (c) { onPaint([c], brush, brushSize); lastPaintCell.current = c }
    } else if (scale > 1) {
      containerRef.current?.setPointerCapture?.(e.pointerId)
      dragOrigin.current = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY }
    }
  }

  const onPointerMove = (e) => {
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (touches.current.size >= 2) {
        pinchUpdate()
        return
      }
    }
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
      setView((v) => ({ scale: v.scale, ...clampPan({ x: v.x + dx / v.scale, y: v.y + dy / v.scale }, v.scale) }))
    }
  }

  const endPointer = (e) => {
    if (e.pointerType === 'touch') {
      touches.current.delete(e.pointerId)
      if (touches.current.size < 2) pinch.current = null
    }
    if (dragOrigin.current?.pointerId === e.pointerId) dragOrigin.current = null
    dragging.current = null
    lastPaintCell.current = null
  }

  // touch-action: while editing (or once zoomed) all touch gestures belong to
  // the map. At rest in read-only mode, allow browser panning so one-finger
  // swipes keep scrolling the page — pinches aren't pans, so the browser
  // leaves those to us and pinch-zoom still works.
  const touchAction = edit || scale > 1 ? 'none' : 'pan-x pan-y'

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
          touchAction,
          cursor: edit ? 'crosshair' : (scale > 1 ? 'grab' : 'default'),
        }}
        onContextMenu={edit ? (e) => e.preventDefault() : undefined}
      >
        <div
          ref={stageRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            transformOrigin: 'center center',
            transform: `scale(${scale}) translate(${view.x}px, ${view.y}px)`,
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
            // Occupier is derived from the CURRENT cells on every render, so
            // the beacon tracks conquests live — including frame-by-frame
            // during a campaign replay, which feeds PixelMap the committed
            // frame's cells.
            const b = beaconStateFor(territory, p, { showRHQ })
            return (
              <div key={p.id}
                onPointerDown={onMovePlace ? (e) => { e.stopPropagation(); dragging.current = p.id } : undefined}
                style={{ position: 'absolute', left: `${(p.x / cols) * 100}%`, top: `${(p.y / rows) * 100}%`, transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', pointerEvents: onMovePlace ? 'auto' : 'none', cursor: onMovePlace ? 'move' : 'default' }}>
                <Beacon
                  color={b.color}
                  pulse={b.pulse}
                  label={p.name}
                  tag={b.tag}
                  variant={b.recaptured ? 'boxed' : 'plain'}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
