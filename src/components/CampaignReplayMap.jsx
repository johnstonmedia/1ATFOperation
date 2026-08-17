import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import PixelMap from './PixelMap'
import MapLegend from './MapLegend'
import { framesValid, frameCells, frameCaptions, sortFrames, transitionPlan, transitionDuration } from '../lib/campaign'
import { renderWaveLayer } from '../lib/terrainRender'

// Campaign replay wrapper around PixelMap. On load it auto-plays the
// campaign history — from RHQ's chosen default start frame (or the earliest
// one) through to the LAST RECORDED FRAME — as an animated conquest wave,
// then rests there.
//
// The transport is a TIMELINE RAIL: one bubble per recorded frame on a single
// line, filling left-to-right as the replay advances. Hovering a bubble names
// that frame ("Week 5"); clicking one cuts straight to it — an instant swap of
// the map, never an animated replay of everything in between, because
// browsing history should be immediate. Playback itself has no pause: ▶ PLAY
// runs from RHQ's default start frame through to the last frame, and clicking
// any bubble mid-play simply snaps there and stops. Frames before the default
// start stay on the rail and stay clickable; they're just skipped by the
// automatic playback.
//
// Falls back to the plain static map when no campaign has been recorded.
//
// The live `territory` is NOT part of this replay once any frames exist —
// only `+ Add Frame from Live Map` (in Map: Territory) puts a change on the
// rail. See the comment on `frames` below for why.
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

const playBtnStyle = {
  padding: '5px 14px',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 2,
  flex: '0 0 auto',
  display: 'flex',
  alignItems: 'center',
  gap: 7,
}

export default function CampaignReplayMap({ territory, frames: campaignFrames, defaultStartId, maxWidth }) {
  const { cols, rows } = territory

  // Frames: one per recorded frame, sorted by order — ONLY real, saved
  // frames. Once a campaign replay exists, it is the sole source of truth
  // for what the public map shows at rest; a live "Save map" that isn't also
  // captured via "+ Add Frame from Live Map" simply won't appear here until
  // it is. (A previous version synthesised the live territory as an
  // unlabelled final frame so the replay never looked stale — that made the
  // live map masquerade as a frame nobody could see, edit or manage from the
  // Map: Territory editor. Removed in favour of an explicit nudge in that
  // editor when the live map has drifted from the last recorded frame.)
  const frames = useMemo(() => {
    if (!framesValid(campaignFrames, cols, rows)) return null
    const f = frameCells(campaignFrames)
    return f.length >= 2 ? f : null
  }, [campaignFrames, cols, rows])

  // Captions per transition (transition k plays into frame k+1).
  const captions = useMemo(
    () => (framesValid(campaignFrames, cols, rows) ? frameCaptions(campaignFrames) : []),
    [campaignFrames, cols, rows],
  )

  // Per-frame id + label for the manual picker — includes frame 0's own
  // label (frameCaptions deliberately drops it, since it has no TRANSITION
  // caption). Index i here lines up 1:1 with frames[i].
  const frameMeta = useMemo(
    () => (framesValid(campaignFrames, cols, rows) ? sortFrames(campaignFrames).map((f) => ({ id: f.id, label: f.label || '' })) : []),
    [campaignFrames, cols, rows],
  )

  // Where the auto-play begins. RHQ's chosen default frame, or the earliest
  // one if unset or since-deleted — earlier frames stay archived and
  // reachable through the picker either way, they're just skipped by the
  // automatic replay.
  const startIdx = useMemo(() => {
    if (!defaultStartId) return 0
    const i = frameMeta.findIndex((f) => f.id === defaultStartId)
    return i < 0 ? 0 : i
  }, [frameMeta, defaultStartId])

  if (!frames) {
    return (
      <div className="col" style={{ gap: 10 }}>
        <PixelMap territory={territory} maxWidth={maxWidth} showCompanyLabels />
        <MapLegend showRHQ={territory.showRHQ} />
      </div>
    )
  }
  return (
    <Replay
      territory={territory}
      frames={frames}
      captions={captions}
      frameMeta={frameMeta}
      startIdx={startIdx}
      maxWidth={maxWidth}
    />
  )
}

function Replay({ territory, frames, captions, frameMeta, startIdx, maxWidth }) {
  const { cols, rows } = territory
  const transitions = frames.length - 1
  const perMs = useMemo(() => transitionDuration(transitions), [transitions])

  const [committed, setCommitted] = useState(frames[frames.length - 1])
  const [playing, setPlaying] = useState(false)
  const [labels, setLabels] = useState([]) // conquest name flashes
  const [moveIdx, setMoveIdx] = useState(-1) // transition being played (-1 = at rest)
  // Which bubble is lit: the frame being shown at rest, or (while playing) the
  // frame the current transition is moving OUT of.
  const [activeIdx, setActiveIdx] = useState(frames.length - 1)
  // Rail fill, 0..1 across the WHOLE timeline (not just the played range) —
  // the bubbles before the default start are real history, so the rail should
  // read as already behind us when playback opens partway along.
  const [rail, setRail] = useState(1)

  const overlayRef = useRef(null)
  // Mutable engine state, outside React so the rAF loop never re-renders.
  const eng = useRef({ k: startIdx, t: 0, raf: 0, last: 0, plan: null, committedIdx: frames.length - 1 })

  const clearOverlay = () => {
    const cv = overlayRef.current
    if (cv) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height)
  }

  const commitFrame = useCallback((idx) => {
    eng.current.committedIdx = idx
    setCommitted(frames[idx])
  }, [frames])

  // Rest on a specific frame index — an instant cut, no animation. This is
  // what a bubble click does, and where playback lands when it finishes.
  const restOn = useCallback((idx) => {
    const e = eng.current
    e.k = idx
    e.t = 0
    e.plan = null
    clearOverlay()
    setLabels([])
    setMoveIdx(-1)
    commitFrame(idx)
    setPlaying(false)
    setActiveIdx(idx)
    setRail(transitions ? idx / transitions : 1)
  }, [commitFrame, transitions])

  // PLAY resumes from whichever frame is on screen, so clicking a bubble and
  // then PLAY continues the campaign from there rather than throwing the
  // visitor back to the beginning. The one exception is pressing PLAY while
  // already at the end (the live state), where "continue" would mean nothing —
  // that restarts from RHQ's default start frame.
  const playFrom = useCallback((idx) => {
    const e = eng.current
    e.k = idx
    e.t = 0
    e.plan = null
    clearOverlay()
    setLabels([])
    setMoveIdx(-1)
    commitFrame(idx)
    setActiveIdx(idx)
    setRail(transitions ? idx / transitions : 0)
    setPlaying(true)
  }, [commitFrame, transitions])

  const play = useCallback(() => {
    playFrom(activeIdx >= transitions ? startIdx : activeIdx)
  }, [playFrom, activeIdx, transitions, startIdx])

  // On mount the map is resting on the live state, so this starts from the
  // default start frame by the rule above.
  const startReplay = useCallback(() => playFrom(startIdx), [playFrom, startIdx])

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
        setRail(1)
        setActiveIdx(transitions)
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
        setActiveIdx(e.k)
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
      setRail(transitions ? (e.k + waveT) / transitions : 1)

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

  // Name for every bubble on the rail. Indices line up 1:1 with `frames`.
  // RHQ's own label wins wherever they set one.
  const frameName = useCallback((i) => {
    return frameMeta[i]?.label || (i === 0 ? 'Campaign baseline' : `Frame ${i + 1}`)
  }, [frameMeta])

  const caption = moveIdx >= 0 ? (captions[moveIdx] || '') : ''
  // At rest anywhere other than the live state, name the frame on screen so a
  // visitor who clicked a bubble knows what they're looking at.
  const restingLabel = playing || activeIdx >= frames.length - 1 ? null : frameName(activeIdx)

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
      {/* RHQ's caption for the move currently playing back, or the name of
          whatever historical frame a visitor has clicked to. */}
      {caption && <div key={`c${moveIdx}`} className="replay-caption">{caption}</div>}
      {!caption && restingLabel && <div key={`v${activeIdx}`} className="replay-caption">VIEWING: {restingLabel}</div>}
    </>
  )

  return (
    <div className="col" style={{ gap: 10 }}>
      <PixelMap
        territory={{ ...territory, cells: committed }}
        maxWidth={maxWidth}
        overlay={overlay}
        showCompanyLabels
      />

      {/* Transport: ▶ PLAY, then the timeline rail — one bubble per frame. */}
      <div className="row center wrap" style={{ gap: 12 }}>
        <button
          className="ghost"
          style={playBtnStyle}
          onClick={play}
          title={activeIdx >= transitions
            ? 'Replay the campaign from the start through to the current state'
            : 'Play on from this frame through to the current state'}
        >
          <span aria-hidden="true" style={{ fontSize: 13 }}>▶</span> PLAY
        </button>
        <FrameRail
          count={frames.length}
          activeIdx={activeIdx}
          rail={rail}
          nameAt={frameName}
          onPick={restOn}
        />
      </div>

      <MapLegend showRHQ={territory.showRHQ} />
    </div>
  )
}

// The "train line": one bubble per frame, evenly spaced along a single rail
// that fills up to wherever playback has reached. Bubbles are real buttons —
// hover or keyboard focus names the frame, click cuts straight to it.
//
// The first and last bubbles are inset by half a bubble so neither hangs off
// the end of the rail, and the fill is drawn between those same insets so it
// lands exactly on a bubble rather than short of it.
function FrameRail({ count, activeIdx, rail, nameAt, onPick }) {
  const INSET = 9 // px — half a bubble plus its ring
  const fracOf = (i) => (count > 1 ? i / (count - 1) : 0)
  const posOf = (i) => `calc(${INSET}px + (100% - ${INSET * 2}px) * ${fracOf(i)})`

  return (
    <div className="replay-rail" role="group" aria-label="Campaign timeline">
      <div className="replay-rail-line" style={{ left: INSET, right: INSET }} />
      <div
        className="replay-rail-fill"
        style={{ left: INSET, width: `calc((100% - ${INSET * 2}px) * ${Math.max(0, Math.min(1, rail))})` }}
      />
      {Array.from({ length: count }, (_, i) => {
        const name = nameAt(i)
        return (
          <button
            key={i}
            type="button"
            className={`replay-bubble${i < activeIdx ? ' is-played' : ''}${i === activeIdx ? ' is-current' : ''}`}
            // --tip-p anchors the hover tip so the end bubbles' tips stay
            // inside the rail instead of overflowing the page. See the
            // .replay-bubble-tip rule in index.css.
            style={{ left: posOf(i), '--tip-p': fracOf(i) }}
            onClick={() => onPick(i)}
            aria-label={`Show ${name}`}
            aria-current={i === activeIdx ? 'true' : undefined}
          >
            <span className="replay-bubble-tip">{name}</span>
          </button>
        )
      })}
    </div>
  )
}
