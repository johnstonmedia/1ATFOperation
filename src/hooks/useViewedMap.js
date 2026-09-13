import { useCallback, useEffect, useState } from 'react'
import { PRIMARY_MAP_ID, isKnownMap } from '../lib/maps'

// Which map THIS VISITOR is looking at on the Home page.
//
// RHQ sets the DEFAULT (the `activeMap` slice, from Ops Centre → Map:
// Territory). This hook layers a per-visitor override on top: the map switch
// under the map picks another one without touching anything RHQ published, and
// without any login or write.
//
// SESSION storage, not local, and that is the whole design. If the override
// persisted forever, RHQ's default would stop meaning anything on that device
// the moment a cadet looked at the other map once — "default" has to reassert
// itself. Session storage keeps the choice while they click between Home,
// Intel and Briefings, and lets the next visit start on RHQ's map again.
//
// Every read is guarded: storage throws in some private-browsing modes, and a
// stored id can name a map that no longer exists (a map is code — one can be
// removed in a deploy while a session is still open). Either way it falls back
// to the default rather than rendering nothing.
const KEY = '1atf-viewed-map'

const stored = () => {
  try {
    const v = sessionStorage.getItem(KEY)
    return v && isKnownMap(v) ? v : null
  } catch {
    return null
  }
}

export default function useViewedMap(defaultId) {
  const fallback = isKnownMap(defaultId) ? defaultId : PRIMARY_MAP_ID
  const [override, setOverride] = useState(stored)

  // RHQ can change the default while a session is open. If the visitor hasn't
  // chosen anything, that new default should simply take effect.
  const viewing = override && isKnownMap(override) ? override : fallback

  const view = useCallback((id) => {
    if (!isKnownMap(id)) return
    // Choosing the default again clears the override rather than pinning it,
    // so the visitor goes back to "whatever RHQ says" instead of freezing on
    // today's answer.
    const next = id === fallback ? null : id
    setOverride(next)
    try {
      if (next) sessionStorage.setItem(KEY, next)
      else sessionStorage.removeItem(KEY)
    } catch { /* private mode — the choice just won't outlive this page */ }
  }, [fallback])

  // If the stored map disappeared in a deploy, drop it rather than keep
  // resolving it to the default on every render.
  useEffect(() => {
    if (override && !isKnownMap(override)) setOverride(null)
  }, [override])

  return [viewing, view, viewing !== fallback]
}
