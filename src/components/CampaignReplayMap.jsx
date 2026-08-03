import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import PixelMap from './PixelMap'
import { campaignValid, buildFrames, frameLabels, transitionPlan, transitionDuration } from '../lib/campaign'
import { renderWaveLayer } from '../lib/terrainRender'

// Campaign replay wrapper around PixelMap. On load it replays the campaign
// history — start state, then every saved move in order — as an animated
// conquest wave, then rests on the live territory. Falls back to the plain
// static map when no campaign has been recorded.
//
// Animation architecture (the performance-critical part):
//  - PixelMap renders only the COMMITTED frame (its hatch+border composite is
//    the expensive draw), so it redraws once per timeline entry, not per
//    animation tick.
//  - The in-between conquest wave is drawn on a cheap flat-tint overlay
//    canvas (a few hundred fillRects per tick at a fixed low-res buffer),
//    driven by requestAnimationFrame. When a transition finishes, the frame
//    is committed to PixelMap and the overlay clears — the wave visually
//    "settles" into the normal hatch style.
//  - Wave ordering per transition is precomputed by transitionPlan(): changed
//    cells cluster per conquering owner and ripple outward (BFS rank) from
//    the owner's existing front line.
const OVERLAY_SCALE = 4 // overlay buffer pixels per grid cell
const HOLD_MS = 380 // pause between timeline moves
const START_DELAY_MS = 700 // beat after mount before the auto-replay begins

const btnStyle = { padding: '3px 10px', fontSize: 11 }

export default function CampaignReplayMap({ territory, campaign, maxWidth }) {
  const { cols, rows } = territory

  // Frames: campaign start + one per save. If the live territory has drifted
  // from the last recorded frame (saves made before the campaign existed, or
  // history folded for size), append it as a final synthetic move so the
  // replay always ends exactly on the live map.
  const frames = useMemo(() => {
    if (!campaignValid(campaign, cols, rows)) return null
    const f = buildFrames(campaign)
    if (f[f.length - 1] !== territory.cells) f.push(territory.cells)
    return f.length >= 2 ? f : null
  }, [campaign, territory.cells, cols, rows])

  // Captions per transition (transition k plays timeline[k]); a synthetic
  // final frame from live drift has no label.
  const captions = useMemo(
    () => (campaignValid(campaign, cols, rows) ? frameLabels(campaign) : []),
    [campaign, cols, rows],
  )

  if (!frames) return <PixelMap territory={territory} maxWidth={maxWidth} />
  return <Replay territory={territory} frames={frames} captions={captions} maxWidth={maxWidth} />
}

function Replay({ territory, frames, captions, maxWidth }) {
  const { cols, rows } = territory
  const transitions = frames.length - 1
  const perMs = useMemo(() => transitionDuration(transitions), [transitions])

  const [committed, setCommitted] = useState(frames[frames.length - 1])
  const [playing, setPlaying] = useState(false)
  const [done, setDone] = useState(true)
  const [labels, setLabels] = useState([]) // conquest name flashes
  const [progress, setProgress] = useState(1) // 0..1 across the whole replay
  const [moveIdx, setMoveIdx] = useState(-1) // transition being played (-1 = at rest)

  const overlayRef = useRef(null)
  // Mutable engine state, outside React so the rAF loop never re-renders.
  const eng = useRef({ k: 0, t: 0, raf: 0, last: 0, plan: null, committedIdx: frames.length - 1 })

  const clearOverlay = () => {
    const cv = overlayRef.current
    if (cv) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height)
  }

  const commitFrame = useCallback((idx) => {
    eng.current.committedIdx = idx
    setCommitted(frames[idx])
  }, [frames])

  // Jump straight to the final live state (skip button / reduced motion).
  const skipToEnd = useCallback(() => {
    const e = eng.current
    e.k = transitions
    e.t = 0
    e.plan = null
    clearOverlay()
    setLabels([])
    setMoveIdx(-1)
    commitFrame(transitions)
    setPlaying(false)
    setDone(true)
    setProgress(1)
  }, [transitions, commitFrame])

  const startReplay = useCallback(() => {
    const e = eng.current
    e.k = 0
    e.t = 0
    e.plan = null
    clearOverlay()
    setLabels([])
    setMoveIdx(-1)
    commitFrame(0)
    setDone(false)
    setPlaying(true)
  }, [commitFrame])

  // Auto-play once on mount. Users who ask for reduced motion get the final
  // state immediately (the controls still let them play it manually).
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = setTimeout(startReplay, START_DELAY_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The animation loop. Runs only while playing; each tick advances the
  // current transition's progress, draws the wave overlay, and commits the
  // frame (one PixelMap redraw) when the transition completes.
  useEffect(() => {
    if (!playing) return
    const e = eng.current
    e.last = performance.now()
    let live = true

    const tick = (now) => {
      if (!live) return
      const dt = now - e.last
      e.last = now

      if (e.k >= transitions) {
        setPlaying(false)
        setDone(true)
        setProgress(1)
        setMoveIdx(-1)
        return
      }

      // Lazily build the plan for the transition we're entering, flash the
      // conquering companies' names, and make sure the map shows the frame
      // we're transitioning FROM.
      if (!e.plan) {
        e.plan = transitionPlan(frames[e.k], frames[e.k + 1], cols, rows)
        if (e.committedIdx !== e.k) commitFrame(e.k)
        const flashes = e.plan.clusters
          .filter((c) => c.label && c.size >= 6) // skip tiny touch-up strokes
          .map((c, i) => ({ id: `${e.k}-${i}`, x: c.cx, y: c.cy, text: c.label, color: c.color }))
        setLabels(flashes)
        setMoveIdx(e.k)
      }

      // Progress runs 0..1 over the wave, then holds briefly before the next
      // move so consecutive conquests read as separate events.
      e.t += dt / perMs
      const waveT = Math.min(1, e.t)
      const cv = overlayRef.current
      if (cv) {
        const ctx = cv.getContext('2d')
        ctx.clearRect(0, 0, cv.width, cv.height)
        renderWaveLayer(ctx, e.plan, waveT, { cols, rows, w: cv.width, h: cv.height })
      }
      setProgress((e.k + waveT) / transitions)

      if (e.t >= 1 + HOLD_MS / perMs) {
        commitFrame(e.k + 1)
        clearOverlay()
        setLabels([])
        e.k += 1
        e.t = 0
        e.plan = null
      }
      e.raf = requestAnimationFrame(tick)
    }
    e.raf = requestAnimationFrame(tick)
    return () => { live = false; cancelAnimationFrame(e.raf) }
  }, [playing, frames, transitions, cols, rows, perMs, commitFrame])

  const caption = moveIdx >= 0 ? (captions[moveIdx] || '') : ''

  const overlay = (
    <>
      <canvas
        ref={overlayRef}
        width={cols * OVERLAY_SCALE}
        height={rows * OVERLAY_SCALE}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated', pointerEvents: 'none' }}
      />
      {labels.map((l) => (
        <div key={l.id} className="conquest-label" style={{ left: `${(l.x / cols) * 100}%`, top: `${(l.y / rows) * 100}%`, color: l.color || '#fff' }}>
          {l.text}
        </div>
      ))}
      {/* RHQ's caption for the move currently playing back. */}
      {caption && <div key={moveIdx} className="replay-caption">{caption}</div>}
    </>
  )

  return (
    <div className="col" style={{ gap: 8 }}>
      <PixelMap territory={{ ...territory, cells: committed }} maxWidth={maxWidth} overlay={overlay} />

      {/* Replay transport — play/pause, restart, skip, and a timeline bar. */}
      <div className="row center wrap" style={{ gap: 8 }}>
        <span className="tag" style={{ flex: '0 0 auto' }}>CAMPAIGN REPLAY</span>
        {done ? (
          <button className="ghost" style={btnStyle} onClick={startReplay} title="Replay campaign history">⟲ Replay</button>
        ) : (
          <>
            <button className="ghost" style={btnStyle} onClick={() => setPlaying((p) => !p)}>
              {playing ? '❚❚ Pause' : '▶ Play'}
            </button>
            <button className="ghost" style={btnStyle} onClick={skipToEnd} title="Skip to current state">≫ Skip</button>
          </>
        )}
        <div style={{ flex: '1 1 120px', height: 4, borderRadius: 2, background: 'var(--line)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.round(progress * 100)}%`, height: '100%', background: 'var(--accent)', transition: 'width 120ms linear' }} />
        </div>
        <span className="mono dim" style={{ fontSize: 10, flex: '0 0 auto' }}>
          {done ? 'CURRENT STATE' : `MOVE ${Math.min(transitions, eng.current.k + 1)} / ${transitions}`}
        </span>
      </div>
    </div>
  )
}
