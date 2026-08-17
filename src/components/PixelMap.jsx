import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { MAP_IMAGE, MAP_ASPECT, beaconStateFor } from '../lib/territory'
import { renderTerritoryLayer, IMAGE_FILTER } from '../lib/terrainRender'
import { companyLabelPoints } from '../lib/companyLabels'
import Beacon from './Beacon'
import { useOceanOverlayUrl } from '../lib/oceanMask'

const CELL = 8 // fallback canvas pixels per grid cell, used only for the very
                // first paint before the draw effect below measures the
                // container and re-sizes the canvas to its actual on-screen
                // resolution (see sizeCanvasToDisplay in the draw effect —
                // without that, the fixed buffer gets rescaled by the browser
                // at a non-integer ratio, which aliases the hatch lines into
                // a denser, uneven wash than the values below actually ask for)
const MAX_SCALE = 4 // zoom-button ceiling
const ZOOM_STEP = 1.6 // multiplier per +/- button press

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Pixel-grid territory map over the NSW image.
//
// Interaction model:
//  - Zoom: explicit +/- buttons (bottom-right), centred on the map. No wheel
//    or pinch zoom — those used to fight with page scroll and painting.
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
  onMoveCompanyLabel, // (code, x, y) — when provided, derived company-name
           // labels become draggable (see MapEditor's "Arrange company
           // labels" mode); positions are stored in territory.labelOverrides.
  maxWidth,
  overlay, // optional node rendered inside the zoom/pan stage, above the
           // territory canvas — used by the campaign replay to keep its wave
           // layer and conquest labels aligned with the map under zoom
  showCompanyLabels = false, // derived "A-COY" names on each holding. Off by
           // default, and deliberately left off in the ops map editor — a
           // label sitting over cells you're trying to paint is in the way.
}) {
  const { cols, rows, cells, showRHQ } = territory
  const places = territory.places || []
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const stageRef = useRef(null)
  // Last grid actually rasterised, so the draw effect can redraw just the
  // cells that changed instead of the whole map (see draw()).
  const drawn = useRef({ cells: null, showRHQ: null })
  // view = continuous zoom + pan. Pan is in pre-scale units: the stage
  // transform is `scale(s) translate(x, y)`, so a rendered point (relative
  // to the container centre) sits at s * (stagePoint + pan).
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const viewRef = useRef(view)
  viewRef.current = view
  const dragOrigin = useRef(null) // { pointerId, lastX, lastY } | { pointerId, painting: true }
  const dragging = useRef(null) // { place: id } | { label: code } being dragged
  const oceanOverlayUrl = useOceanOverlayUrl(edit)

  // Company name placements are derived from the cells, so they track the
  // committed replay frame exactly like the beacons do. Memoised on the cell
  // string: the derivation is a few passes over the grid, which is cheap but
  // not free enough to redo on every pan/zoom re-render.
  // `avoid` keeps a company name off a named place: that place's beacon
  // already prints the same owner tag, so overlapping them just says it twice.
  const labelOverrides = territory.labelOverrides || {}
  const companyLabels = useMemo(
    () => (showCompanyLabels ? companyLabelPoints(cells, cols, rows, { showRHQ, avoid: places, overrides: labelOverrides }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showCompanyLabels, cells, cols, rows, showRHQ, places, labelOverrides],
  )

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

      // Redraw only what actually changed. A brush stroke touches a handful
      // of cells, but a full redraw costs a whole-grid pass plus several
      // full-canvas composites — far too much to run on every pointer event.
      // Diff against the last drawn grid and hand the dirty bounds to the
      // renderer; fall back to a full redraw when the canvas resized or the
      // change is large (replay commits, clear-all, first paint).
      const prev = drawn.current
      const reusable = cv.width === w && cv.height === h &&
        prev.cells != null && prev.cells.length === cells.length && prev.showRHQ === showRHQ
      let region = null
      if (reusable) {
        let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1
        for (let i = 0; i < cells.length; i++) {
          if (cells[i] === prev.cells[i]) continue
          const x = i % cols, y = (i / cols) | 0
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
        if (maxX < 0) { drawn.current = { cells, showRHQ }; return } // nothing changed
        // Pad by 2 cells so neighbouring boundary lines are rebuilt correctly.
        const pad = 2
        const area = (maxX - minX + 1 + pad * 2) * (maxY - minY + 1 + pad * 2)
        if (area < cols * rows * 0.25) {
          region = { x0: minX - pad, y0: minY - pad, x1: maxX + pad, y1: maxY + pad }
        }
      }

      const ctx = cv.getContext('2d')
      if (!region) {
        cv.width = w   // resizing also clears
        cv.height = h
        ctx.clearRect(0, 0, w, h)
      }
      renderTerritoryLayer(ctx, { cells, cols, rows, showRHQ, w, h, region })
      drawn.current = { cells, showRHQ }
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

  // +/- buttons: zoom anchored at the map's centre.
  const zoomIn = useCallback(() => zoomAt({ x: 0, y: 0 }, ZOOM_STEP), [zoomAt])
  const zoomOut = useCallback(() => zoomAt({ x: 0, y: 0 }, 1 / ZOOM_STEP), [zoomAt])

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
    if (dragging.current) {
      const c = cellFromEvent(e)
      if (c) {
        if (dragging.current.place != null) onMovePlace?.(dragging.current.place, c.x, c.y)
        else if (dragging.current.label != null) onMoveCompanyLabel?.(dragging.current.label, c.x, c.y)
      }
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
    if (dragOrigin.current?.pointerId === e.pointerId) dragOrigin.current = null
    dragging.current = null
    lastPaintCell.current = null
  }

  // touch-action: while editing (or once zoomed via the +/- buttons) one-finger
  // touch belongs to the map (paint, or drag-to-pan). At rest in read-only
  // mode, allow browser panning so one-finger swipes keep scrolling the page.
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
          {/* Derived company names, under the place beacons — a named place is
              the more specific label, so it wins any overlap. Draggable only
              in MapEditor's "Arrange company labels" mode (onMoveCompanyLabel
              provided); pointer-events stay off otherwise so the label never
              intercepts clicks meant for the map underneath. */}
          {companyLabels.map((l) => (
            <div key={l.code} className="company-label"
              style={{
                left: `${(l.x / cols) * 100}%`, top: `${(l.y / rows) * 100}%`, color: l.color,
                ...(onMoveCompanyLabel ? { pointerEvents: 'auto', cursor: 'grab' } : null),
              }}
              onPointerDown={onMoveCompanyLabel ? (e) => { e.stopPropagation(); dragging.current = { label: l.code } } : undefined}>
              {l.label}
            </div>
          ))}
          {places.map((p) => {
            // Occupier is derived from the CURRENT cells on every render, so
            // the beacon tracks conquests live — including frame-by-frame
            // during a campaign replay, which feeds PixelMap the committed
            // frame's cells.
            const b = beaconStateFor(territory, p, { showRHQ })
            return (
              <Beacon
                key={p.id}
                x={p.x} y={p.y} cols={cols} rows={rows}
                color={b.color}
                pulse={b.pulse}
                label={p.name}
                tag={b.tag}
                variant={b.recaptured ? 'boxed' : 'plain'}
                draggable={!!onMovePlace}
                onPointerDown={onMovePlace ? (e) => { e.stopPropagation(); dragging.current = { place: p.id } } : undefined}
              />
            )
          })}
        </div>

        <ZoomControls scale={scale} onZoomIn={zoomIn} onZoomOut={zoomOut} />
      </div>
    </div>
  )
}

// Turquoise-on-transparent-grey +/- zoom control, anchored bottom-right —
// replaces the old pinch/wheel gesture zoom with an explicit, on-theme
// control that works the same on touch and desktop.
function ZoomControls({ scale, onZoomIn, onZoomOut }) {
  const btn = (disabled) => ({
    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid var(--accent)', borderRadius: 'var(--radius)',
    background: 'rgba(20,26,36,0.65)', backdropFilter: 'blur(6px)',
    color: 'var(--accent)', fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 700,
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
  })
  const stop = (fn) => (e) => { e.stopPropagation(); fn() }
  return (
    <div style={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 5 }}>
      <button type="button" aria-label="Zoom in" disabled={scale >= MAX_SCALE}
        onPointerDown={(e) => e.stopPropagation()} onClick={stop(onZoomIn)} style={btn(scale >= MAX_SCALE)}>+</button>
      <button type="button" aria-label="Zoom out" disabled={scale <= 1}
        onPointerDown={(e) => e.stopPropagation()} onClick={stop(onZoomOut)} style={btn(scale <= 1)}>−</button>
    </div>
  )
}
