import { useEffect, useMemo, useRef, useState } from 'react'
import { fixedTiles } from '../lib/maps'

// Satellite imagery for a map that declares a `tiles` source.
//
// ⚠️ THIS IS NOT A SLIPPY MAP, AND THAT IS THE POINT. The obvious design —
// request a deeper tile level every time the user zooms — is what tile maps
// normally do, and here it was the defect: each zoom step swapped the imagery
// on screen, so zooming flickered, and until the new level arrived the map fell
// back to the 10 m static still. Two attempts to smooth that over (hiding tiles
// until decoded, then holding the previous level underneath the incoming one)
// each made it less bad without making it right, because the thing being fixed
// should not have been happening.
//
// What this map actually needs is one swap: replace the low-resolution static
// art with real imagery ONCE, then let the browser scale it with everything
// else under PixelMap's zoom/pan transform — exactly as the static image always
// did. So a single fixed zoom level is chosen from the map (`fixedTiles` in
// lib/maps.js), fetched once, and never re-requested. Zooming magnifies it.
// Nothing re-settles, nothing flickers, and panning costs no requests at all.
//
// WHY NOT LEAFLET. Leaflet would bring its own pan/zoom, coordinate space and
// DOM, and PixelMap's whole territory system — hatch canvas, beacons, derived
// company labels, replay animation, both exporters — is built on ONE flat cell
// grid over ONE rectangle. Making Leaflet the map means rewriting every one of
// those, to get back the level-swapping behaviour this file deliberately does
// not want.
//
// Tiles are positioned as PERCENTAGES of the frame, so they sit in the same
// coordinate space as the cell grid with no conversion, and the static
// `map.image` still renders underneath (PixelMap draws it first). That is the
// floor: it shows before the tiles arrive, and it is all that shows if the
// service is unreachable — no signal on camp, or the endpoint moves. A dead
// tile URL degrades to the old static map, never to a blank one.
//
// ⚠️ The floor is a FALLBACK, never a neighbour. The tile set covers the whole
// frame (see fixedTiles): when it only covered the map's `focus` box, the
// static art showed everywhere else and the join between the two drew a
// hard-edged rectangle across the map in the shape of that box. Don't narrow
// the region again — everything anyone sees here is SIX Maps.

// Give up after this many consecutive failures with nothing successful. The
// static image is already showing, so there is nothing to gain by retrying a
// host that isn't answering.
const FAIL_LIMIT = 8

// ⚠️ THE LAYER REVEALS AS ONE THING, NOT 352 THINGS.
//
// Each tile used to un-hide itself in its own onLoad, which meant the map did
// not swap from the static art to the imagery once — it did it 352 times, in
// whatever order the network happened to answer. What you saw was the low-res
// base, then squares of satellite popping in across it for a second or two.
// That is the same defect the fixed-zoom rule was written for (see the header),
// just at a different scale: the fix is always FEWER swaps, never faster ones.
//
// So the tiles are always visible and the CONTAINER is what fades, once, when
// the set is done. "Done" is every tile settled — each <img> fires exactly one
// of load/error, so the count always gets there — with a timeout as the floor
// in case a request simply hangs, and that only reveals if most of the set
// actually arrived. A half-tiled reveal would be the patchwork again.
const REVEAL_TIMEOUT_MS = 8000
const REVEAL_MIN_FRACTION = 0.6

export default function TileBase({ map }) {
  const failed = useRef(new Set())
  const health = useRef({ ok: 0, bad: 0 })
  const [, bump] = useState(0)
  const [ready, setReady] = useState(false)

  // Computed from the MAP ALONE — not from the view — so it is stable for the
  // life of the component and a pan or zoom can never invalidate it.
  const tiles = useMemo(() => fixedTiles(map), [map])
  const total = tiles?.list.length || 0

  // Reset when the map changes — a different map is a different tile set.
  useEffect(() => {
    failed.current = new Set()
    health.current = { ok: 0, bad: 0 }
    setReady(false)
  }, [tiles])

  // The floor. Without it a single request that never settles would hold the
  // imagery back for the whole session.
  useEffect(() => {
    if (!total || ready) return undefined
    const id = setTimeout(() => {
      if (health.current.ok >= total * REVEAL_MIN_FRACTION) setReady(true)
    }, REVEAL_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [total, ready])

  // Counted in a ref and flipped ONCE, rather than held in state: 352 tiles
  // reporting in would otherwise be 352 re-renders of the whole layer.
  const settled = () => {
    const { ok, bad } = health.current
    if (ok + bad >= total && ok > 0) setReady(true)
  }

  if (!tiles) return null
  if (health.current.bad >= FAIL_LIMIT && health.current.ok === 0) return null
  const list = tiles.list.filter((t) => !failed.current.has(t.url))
  if (!list.length) return null

  return (
    <div aria-hidden="true" style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      opacity: ready ? 1 : 0,
      transition: 'opacity 420ms ease-out',
    }}>
      {list.map((t) => (
        <img
          key={t.key}
          src={t.url}
          alt=""
          draggable={false}
          // ⚠️ NOT loading="lazy". It was tried: Chromium fetched all 352 at
          // the opening view regardless (they sit inside a transformed
          // ancestor), so it bought nothing — and a browser that DID honour it
          // would leave the static floor showing until the user finished
          // zooming out, which is the flicker this whole file exists to avoid.
          // The set is fetched once, in full, and cached.
          decoding="async"
          onLoad={() => {
            health.current.ok += 1
            health.current.bad = 0
            settled()
          }}
          onError={(e) => {
            // Hide it right here rather than re-rendering: a browser paints a
            // broken <img> with a visible placeholder box, and with the whole
            // grid unreachable that is a screenful of torn-image icons over the
            // fallback map. Remembering the URL keeps it out of a later render.
            e.currentTarget.style.display = 'none'
            failed.current.add(t.url)
            health.current.bad += 1
            if (health.current.bad === FAIL_LIMIT && health.current.ok === 0) bump((n) => n + 1)
            settled()
          }}
          style={{
            position: 'absolute',
            left: `${t.left}%`,
            top: `${t.top}%`,
            width: `${t.width}%`,
            height: `${t.height}%`,
            userSelect: 'none',
          }}
        />
      ))}
    </div>
  )
}
