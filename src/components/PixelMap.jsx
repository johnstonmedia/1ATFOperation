import { useRef, useEffect, useState, useCallback } from 'react'
import { MAP_IMAGE, MAP_ASPECT, colorOf, isRHQCode } from '../lib/territory'

const CELL = 8 // internal canvas pixels per grid cell (for crisp outlines)

// Pixel-grid territory map over the NSW image. Read-only by default; pass
// `edit` + `brush` + `onPaint` to enable the pixel brush, and `onMovePlace`
// to drag place labels. Never smooths the image (image-rendering: pixelated).
export default function PixelMap({
  territory,
  height = 460,
  edit = false,
  brush = '.',
  brushSize = 1,
  onPaint,
  onMovePlace,
}) {
  const { cols, rows, cells, showRHQ } = territory
  const places = territory.places || []
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const painting = useRef(false)
  const dragging = useRef(null)

  // Draw tints + solid boundary edges whenever the grid changes.
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    ctx.clearRect(0, 0, cv.width, cv.height)
    const vis = (c) => (isRHQCode(c) && !showRHQ ? '.' : c)
    const at = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows ? '.' : vis(cells[y * cols + x]))

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const code = at(x, y)
        const col = colorOf(code)
        if (!col) continue
        ctx.globalAlpha = 0.4
        ctx.fillStyle = col
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
      }
    }
    ctx.globalAlpha = 1
    ctx.lineWidth = 2
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const code = at(x, y)
        const col = colorOf(code)
        if (!col) continue
        ctx.strokeStyle = col
        ctx.beginPath()
        const px = x * CELL, py = y * CELL
        if (at(x - 1, y) !== code) { ctx.moveTo(px, py); ctx.lineTo(px, py + CELL) }
        if (at(x + 1, y) !== code) { ctx.moveTo(px + CELL, py); ctx.lineTo(px + CELL, py + CELL) }
        if (at(x, y - 1) !== code) { ctx.moveTo(px, py); ctx.lineTo(px + CELL, py) }
        if (at(x, y + 1) !== code) { ctx.moveTo(px, py + CELL); ctx.lineTo(px + CELL, py + CELL) }
        ctx.stroke()
      }
    }
  }, [cells, cols, rows, showRHQ])

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
    if (edit) { painting.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); paintAt(e) }
  }
  const onPointerMove = (e) => {
    if (dragging.current && onMovePlace) {
      const c = cellFromEvent(e)
      if (c) onMovePlace(dragging.current, c.x, c.y)
      return
    }
    if (painting.current) paintAt(e)
  }
  const endPaint = () => { painting.current = false; dragging.current = null }

  return (
    <div style={{ position: 'relative', border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden', background: '#0a0f1a' }}>
      <div style={{ width: '100%', height, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPaint}
          onPointerLeave={endPaint}
          style={{
            position: 'relative',
            width: `${zoom * 100}%`,
            aspectRatio: String(MAP_ASPECT),
            flex: '0 0 auto',
            cursor: edit ? 'crosshair' : 'default',
            touchAction: 'none',
          }}
        >
          <img src={MAP_IMAGE} alt="NSW operational map" draggable={false}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated', userSelect: 'none' }} />
          <canvas ref={canvasRef} width={cols * CELL} height={rows * CELL}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated', pointerEvents: 'none' }} />
          {places.map((p) => (
            <div key={p.id}
              onPointerDown={onMovePlace ? (e) => { e.stopPropagation(); dragging.current = p.id } : undefined}
              style={{ position: 'absolute', left: `${(p.x / cols) * 100}%`, top: `${(p.y / rows) * 100}%`, transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', pointerEvents: onMovePlace ? 'auto' : 'none', cursor: onMovePlace ? 'move' : 'default' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', boxShadow: '0 0 5px #fff', display: 'inline-block' }} />
              <span style={{ color: '#dff', font: "600 11px 'JetBrains Mono',monospace", textShadow: '0 1px 3px #000' }}>{p.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', right: 8, bottom: 8, display: 'flex', gap: 6 }}>
        <button className="ghost" onClick={() => setZoom((z) => Math.min(6, +(z + 0.5).toFixed(1)))} aria-label="Zoom in" style={{ padding: '2px 10px' }}>+</button>
        <button className="ghost" onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))} aria-label="Zoom out" style={{ padding: '2px 10px' }}>−</button>
      </div>
    </div>
  )
}
