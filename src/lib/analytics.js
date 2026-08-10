// Google Analytics 4, off by default.
//
// Stays a **silent no-op until `VITE_GA_ID` is set** (same pattern as
// lib/notify.js): no script is loaded, no request is made, no cookie is
// written. There is deliberately NO hard-coded fallback ID — unlike the
// Firebase and EmailJS keys, an analytics property is an account-level thing
// nobody should inherit by accident.
//
// To enable:
//   local  — VITE_GA_ID=G-XXXXXXXXXX in .env.local
//   live   — GitHub → Settings → Secrets and variables → Actions → Variables →
//            New repository variable, name VITE_GA_ID. The deploy workflow
//            passes it through to the build. (It is a *variable*, not a secret:
//            a GA measurement ID is public by design — it ships in the page.)
//
// ⚠️ CONFIGURED FOR AN AUDIENCE OF MINORS. Most of this unit is under 18, and
// [src/pages/Privacy.jsx](../pages/Privacy.jsx) promises no advertising and no
// profiling. The three settings below are what keep that true — do not remove
// them to "get more data":
//   allow_google_signals          false — no cross-device tracking, no
//                                         demographics/interests built from
//                                         Google's ads profile of the visitor
//   allow_ad_personalization_signals false — data can't feed ad targeting
//   send_page_view                false — we send views ourselves (SPA, below)
// Nothing identifying is ever passed: no user id, no member id, no name, and
// query strings are stripped from the path before it is sent.
//
// If you change ANY of this, update the "Site analytics" section of
// Privacy.jsx in the same commit. That notice is repo-versioned precisely so
// it cannot drift away from what the code actually does.

const GA_ID = import.meta.env.VITE_GA_ID || ''

// Honour the browser's Do Not Track signal and opt out entirely. GA does not do
// this by itself; it is a deliberate choice for a youth organisation's site.
// Removing this block is a one-line change if RHQ decides otherwise — but say
// so in the privacy notice if you do.
function doNotTrack() {
  if (typeof navigator === 'undefined') return false
  const v = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack
  return v === '1' || v === 'yes'
}

export const analyticsEnabled = () => Boolean(GA_ID) && !doNotTrack()

let started = false

// Inject gtag.js once and configure it. Safe to call repeatedly.
export function initAnalytics() {
  if (started || !analyticsEnabled() || typeof document === 'undefined') return
  started = true

  window.dataLayer = window.dataLayer || []
  // gtag must push `arguments` itself — a rest-args version breaks the queue,
  // because gtag.js reads the pushed object as an arguments list.
  function gtag() { window.dataLayer.push(arguments) } // eslint-disable-line prefer-rest-params
  window.gtag = gtag

  gtag('js', new Date())
  gtag('config', GA_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  })

  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`
  // A blocker or an offline visitor must not produce a console error or a
  // reported fault — analytics failing is never worth surfacing to a cadet.
  s.onerror = () => { started = false }
  document.head.appendChild(s)
}

// One page view. `path` should already be free of query strings — see
// PageViews in App.jsx, which strips them.
export function trackPageView(path, title) {
  if (!analyticsEnabled() || typeof window.gtag !== 'function') return
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
    page_location: `${window.location.origin}${path}`,
  })
}
