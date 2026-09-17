// CRITICAL INTEL — the alert-video slice.
//
// Everything about whether a given device should be interrupted lives here, so
// the popup, the Briefings tab and the Ops Centre editor all read the same
// rules instead of each deciding for itself.
//
// THREE STATES, and the difference between them is the whole feature:
//
//   DRAFT        no publishedAt. RHQ is still filling it in; nothing is on the
//                Briefings tab and nothing interrupts anyone.
//   CRITICAL     published, and now < alertUntil. Pops over whatever public tab
//                the visitor opened, once per device, until they dismiss it.
//   ARCHIVED     published, and now >= alertUntil. Never interrupts again on
//                any device — but it is STILL ON THE BRIEFINGS TAB, beside the
//                ordinary briefing video. "Critical for a while, available
//                afterwards" is the shape the unit asked for.
//
// ⚠️ DISMISSAL IS KEYED ON `publishedAt`, NOT ON THE SLICE'S updatedAt (which
// is what useUnseen.js keys on, and is stamped by every save). That is
// deliberate: RHQ fixing a typo must not re-alert a hundred cadets who already
// watched the thing, while pressing PUBLISH again must. Only publish moves
// publishedAt.

const SEEN_KEY = '1atf-critical-intel-seen'

// Is there anything to show at all? A video OR a body — a critical message
// with no video is still a critical message, and a video that failed to
// resolve still leaves the words worth reading.
export function hasContent(ci) {
  return !!((ci?.video || '').trim() || (ci?.body || '').trim())
}

// Published at all — i.e. on the Briefings tab, critical window or not.
export function isPublished(ci) {
  return hasContent(ci) && !!ci?.publishedAt
}

// Inside its alert window right now. `now` is injectable so the Ops Centre can
// describe the state without waiting for the clock.
export function isCritical(ci, now = Date.now()) {
  return isPublished(ci) && !!ci.alertUntil && now < ci.alertUntil
}

/* --------------------------- device-local dismissal --------------------- */

// The publishedAt stamp this browser last acknowledged. Storing the content's
// own stamp rather than a boolean is what makes a re-publish re-alert, and
// what keeps the comparison immune to clock skew between RHQ's device and a
// cadet's — the same reasoning as markSeen in hooks/useUnseen.js.
export function seenStamp() {
  try { return Number(localStorage.getItem(SEEN_KEY) || 0) } catch { return 0 }
}

export function markCriticalSeen(ci) {
  if (!ci?.publishedAt) return
  try { localStorage.setItem(SEEN_KEY, String(ci.publishedAt)) } catch { /* private mode */ }
}

// Should this device be interrupted? Everything above, plus "has this browser
// already acknowledged THIS publication".
export function shouldAlert(ci, now = Date.now()) {
  return isCritical(ci, now) && seenStamp() !== ci.publishedAt
}

/* --------------------------------- countdown ---------------------------- */

// Milliseconds left in the alert window, or 0 once it has closed.
export function remainingMs(ci, now = Date.now()) {
  if (!isPublished(ci) || !ci.alertUntil) return 0
  return Math.max(0, ci.alertUntil - now)
}

// "2d 04h 13m" / "4h 13m 22s" / "13m 22s" / "22s".
//
// The largest unit is UNPADDED and the ones under it are padded, so the string
// keeps a steady width as it counts down instead of jittering at every
// rollover. SECONDS ARE DROPPED once there are days left: a number that churns
// every second while the real answer is "not for two days" reads as urgency the
// window does not have, and it is the only case where the tick says nothing.
export function formatRemaining(ms) {
  if (!(ms > 0)) return null
  const total = Math.floor(ms / 1000)
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  if (d) return `${d}d ${pad(h)}h ${pad(m)}m`
  if (h) return `${h}h ${pad(m)}m ${pad(s)}s`
  if (m) return `${m}m ${pad(s)}s`
  return `${s}s`
}

/* ------------------------------- for the editor ------------------------- */

// One line describing where a stored item stands, for the Ops Centre panel.
// Kept here rather than in the editor so the words can't disagree with the
// predicates above.
export function statusOf(ci, now = Date.now()) {
  if (!hasContent(ci)) return { tone: 'dim', text: 'Nothing published — add a video or a message below.' }
  if (!isPublished(ci)) return { tone: 'dim', text: 'Draft — saved, but not on the Briefings tab and not alerting anyone. Press Publish alert.' }
  if (isCritical(ci, now)) {
    return { tone: 'hostile', text: `LIVE ALERT — interrupting every visitor until ${new Date(ci.alertUntil).toLocaleString()}.` }
  }
  return { tone: 'accent', text: `Alert finished ${new Date(ci.alertUntil).toLocaleString()} — still on the Briefings tab, no longer interrupting.` }
}
