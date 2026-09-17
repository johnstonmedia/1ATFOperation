import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useDialog } from '../hooks/useDialog'
import VideoEmbed from './VideoEmbed'
import { formatRemaining, markCriticalSeen, remainingMs, shouldAlert } from '../lib/criticalIntel'

// The one thing in the portal that interrupts: a full-screen CRITICAL INTEL
// message over whatever public tab the visitor opened. See lib/criticalIntel.js
// for the three states and why dismissal is keyed on `publishedAt`.
//
// ⚠️ PORTALLED TO document.body, like LoginModal and ConfirmDialog. This is
// mounted from Layout, and `.app-rail` (sticky) plus the mobile drawer (fixed)
// each create a stacking context — a position:fixed overlay mounted inside the
// shell gets trapped under page content whatever its z-index.
//
// ⚠️ IT DOES NOT FIRE ON /briefings. That tab already shows this item, in its
// permanent home, so popping the same video over the page displaying it is
// noise; opening the tab counts as having seen it (Briefings.jsx marks it) and
// the alert is spent. Every other public route gets the interruption.
//
// Whether the visitor presses ACKNOWLEDGE, hits Escape or clicks the backdrop,
// the item is marked seen. This is a notice, not a consent gate — trapping a
// cadet on a phone behind one button buys nothing.
export default function CriticalIntelAlert() {
  const { state } = useData()
  const { pathname } = useLocation()
  const ci = state.criticalIntel || {}
  const onOwnTab = pathname.toLowerCase().startsWith('/briefings')

  // Decided ONCE, on mount. The store has no live subscription, so re-reading
  // it every render could only flicker the dialog rather than update it — and
  // the Briefings tab marking the item seen must not yank an open dialog out
  // from under whoever is reading it.
  const [open, setOpen] = useState(() => !onOwnTab && shouldAlert(ci))

  const close = () => { markCriticalSeen(ci); setOpen(false) }
  const dialogRef = useDialog(close)

  // A dialog over the page must not leave the page scrolling behind it.
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 980, background: 'rgba(2,4,9,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto',
      }}
    >
      <div
        ref={dialogRef}
        className="panel col"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={ci.title || 'Critical intel'}
        style={{
          width: 760, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', gap: 0,
          border: '1px solid var(--hostile)', boxShadow: '0 0 60px rgba(255,59,70,0.25)',
        }}
      >
        <div
          className="row between center mono wrap"
          style={{
            padding: '10px 16px', gap: 8, background: 'rgba(255,59,70,0.14)',
            borderBottom: '1px solid var(--hostile)', color: 'var(--hostile)',
            fontSize: 11, fontWeight: 700, letterSpacing: 2,
          }}
        >
          <span>◤ PRIORITY TRANSMISSION</span>
          <span className="row center" style={{ gap: 12 }}>
            <Countdown item={ci} />
            <button className="ghost" onClick={close} aria-label="Dismiss" style={{ padding: '2px 10px' }}>✕</button>
          </span>
        </div>

        <div className="col panel-pad" style={{ gap: 14 }}>
          <h2 className="head hostile" style={{ margin: 0, fontSize: 20, letterSpacing: 2 }}>
            {ci.title || 'CRITICAL INTEL'}
          </h2>

          {ci.video?.trim() && <VideoEmbed url={ci.video} />}

          {(ci.body || '').split('\n\n').filter(Boolean).map((p, i) => (
            <p key={i} style={{ margin: 0, lineHeight: 1.6 }}>{p}</p>
          ))}

          {/* The note sits on its own line and the button is right-aligned under
              it: on one row the note is long enough to wrap the button to the
              left, which is where nothing else on the dialog sits. */}
          <div className="col" style={{ gap: 12 }}>
            <span className="mono dim" style={{ fontSize: 10, lineHeight: 1.6 }}>
              The countdown is how long this stays a priority signal — it is on the
              Briefings tab either way.
            </span>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="primary" onClick={close}>ACKNOWLEDGE</button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// How long this stays a priority transmission. It counts down live, because a
// window expressed as an absolute time ("until 17:30") makes the reader do the
// arithmetic, and the thing they actually want to know is whether this is
// urgent now.
//
// ⚠️ It measures the ALERT WINDOW, not the content. Past it the item is still
// on the Briefings tab — so the expired state says the alert stood down, never
// that the video is gone, which would be a lie the reader could act on.
//
// The tick lives here rather than in the dialog so one second's re-render
// touches this line and not the embedded player: re-rendering an <iframe>'s
// parent is cheap, but it is a needless thing to do 3,600 times to someone
// watching a video.
function Countdown({ item }) {
  const until = item?.alertUntil || 0
  const [left, setLeft] = useState(() => remainingMs(item))
  // Seconds are dropped past a day (see formatRemaining), so the tick slows
  // down there: a per-second interval would re-render for a string that cannot
  // have changed.
  const slow = left > 86400e3

  useEffect(() => {
    if (!until) return undefined
    const tick = () => setLeft(Math.max(0, until - Date.now()))
    tick()
    const id = setInterval(tick, slow ? 30000 : 1000)
    return () => clearInterval(id)
    // Keyed on the TIMESTAMP, not the item object — `state.criticalIntel || {}`
    // is a fresh object whenever the slice is missing, and an object dep would
    // tear the interval down and rebuild it on every tick.
  }, [until, slow])

  if (!until) return null
  const text = formatRemaining(left)
  return (
    <span
      className="mono"
      style={{ opacity: text ? 0.9 : 0.6 }}
      title={`This stops interrupting at ${new Date(until).toLocaleString()}. It stays on the Briefings tab afterwards.`}
    >
      {text ? `EXPIRES IN ${text}` : 'ALERT ENDED'}
    </span>
  )
}
