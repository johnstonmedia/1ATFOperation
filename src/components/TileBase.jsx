import { useEffect, useMemo, useRef, useState } from 'react'
import { tileZoomFor, tilesFor } from '../lib/maps'

// Live satellite basemap for a map that declares a `tiles` source.
//
// WHY THIS ISN'T LEAFLET. Leaflet would bring its own pan/zoom, its own
// coordinate space and its own DOM, and PixelMap's whole territory system —
// the hatch canvas, beacons, derived company labels, the replay animation,
// both exporters — is built on ONE flat cell grid over ONE rectangle. Making
// Leaflet the map would mean rewriting every one of those against a Leaflet
// overlay. What Leaflet actually provides here is "fetch XYZ tiles and put
// them in the right place", which is the function below, because the map's
// frame is a Web Mercator rectangle (see `geo.merc` in lib/maps.js) and a
// tile therefore lands in it with a pure linear transform.
//
// Tiles are positioned as PERCENTAGES of the frame, so the browser scales them
// with everything else under PixelMap's transform — no redraw on pan, and no
// second coordinate system to keep in sync with the grid.
//
// The static `map.image` still renders underneath (PixelMap draws it first).
// That is the floor: it shows before tiles arrive, and it is all that shows if
// they never do — no signal on camp, or the service moved. A dead tile URL
// degrades to the old static map, never to a blank one.
//
// ⚠️ THE FLOOR MUST NOT BE VISIBLE MID-ZOOM. Each zoom step asks for a deeper
// tile level, and the naive version unmounts the level you were looking at the
// moment the new one is requested — so every press of + flashed the 10 m
// Sentinel still and then snapped back to real imagery, which reads as the map
// glitching rather than loading. So the PREVIOUS level is kept mounted
// underneath the new one until the new one has actually arrived (see
// `settled`). A slippy map's oldest trick, and the reason this file tracks
// which tile URLs have loaded rather than just rendering the current set.

// Enough to cover a 4:3 viewport at any zoom with margin; a guard against a
// bad region calculation asking the browser for thousands of images.
const MAX_TILES = 192
// Give up after this many consecutive failures with nothing successful. The
// static image is already showing, so there is nothing to gain by retrying a
// host that isn't answering.
const FAIL_LIMIT = 8

// How much of a level has to be on screen before the level under it is
// dropped. Not 100%: one stalled edge tile shouldn't hold two layers up
// indefinitely, and the layer underneath is the same ground at half the
// resolution — far better than the static floor, and invisible behind 92%.
const SETTLED = 0.92

export default function TileBase({ map, view, containerRef }) {
  const [box, setBox] = useState({ w: 0, h: 0 })
  const failed = useRef(new Set())
  const health = useRef({ ok: 0, bad: 0 })
  // Every tile URL that has decoded at least once. A URL names (z, x, y)
  // uniquely, so this doubles as "have I already got this tile" across levels
  // and survives a pan back and forth without re-deciding.
  const loaded = useRef(new Set())
  const [, bump] = useState(0)
  // The deepest level that was fully on screen; kept mounted underneath a
  // newer level until that one settles.
  const under = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef])

  const tiles = useMemo(() => {
    const { w, h } = box
    if (!map?.tiles || !w || !h) return {}
    if (health.current.bad >= FAIL_LIMIT && health.current.ok === 0) return {}

    // Visible sub-rectangle of the frame, as 0..1 fractions. The stage is
    // `scale(s) translate(tx,ty)` about its centre and fills the container, so
    // a point at fraction u sits at W/2 + s*((u*W − W/2) + tx); solving that
    // for the container's own edges gives the two lines below. (PixelMap's
    // clampPan is the same algebra: at full pan this yields exactly 0 and 1.)
    const s = view.scale
    const u0 = 0.5 - 0.5 / s - view.x / w
    const v0 = 0.5 - 0.5 / s - view.y / h
    const pad = 0.06 / s // a little beyond the edges, so a pan isn't all gaps
    const region = {
      x0: Math.max(0, u0 - pad), x1: Math.min(1, u0 + 1 / s + pad),
      y0: Math.max(0, v0 - pad), y1: Math.min(1, v0 + 1 / s + pad),
    }

    // Step down a zoom level rather than flood the browser, if a wide view at
    // a deep level would ask for more images than MAX_TILES.
    let z = tileZoomFor(map, w * s)
    let out = tilesFor(map, z, region)
    while (out.length > MAX_TILES && z > (map.tiles.minZoom ?? 0)) {
      z -= 1
      out = tilesFor(map, z, region)
    }
    if (out.length > MAX_TILES) return {}
    return { z, list: out.filter((t) => !failed.current.has(t.url)) }
  }, [map, box, view.scale, view.x, view.y])

  const list = tiles.list || []
  const z = tiles.z

  // Has the current level arrived? Measured against what we asked for, not
  // against what has rendered, so a level that is mostly cached counts as
  // settled on its first paint and never shows the layer beneath at all.
  const have = list.reduce((n, t) => n + (loaded.current.has(t.url) ? 1 : 0), 0)
  const settled = list.length > 0 && have / list.length >= SETTLED

  // Promote on settle; keep whatever was underneath until then. Only a level
  // at a DIFFERENT zoom is worth keeping — panning within one level already
  // reuses its own tiles.
  if (settled && (!under.current || under.current.z !== z)) under.current = { z, list }
  const beneath = !settled && under.current && under.current.z !== z ? under.current.list : null

  if (!list.length && !beneath) return null

  const tileImg = (t, dim) => (
    <img
      key={`${dim ? 'u' : 'c'}-${t.key}`}
      src={t.url}
      alt=""
      draggable={false}
      onLoad={(e) => {
        health.current.ok += 1
        health.current.bad = 0
        e.currentTarget.style.visibility = 'visible'
        if (!loaded.current.has(t.url)) {
          loaded.current.add(t.url)
          // Re-render so `settled` can be recomputed and the layer beneath
          // dropped once this level is up.
          bump((n) => n + 1)
        }
      }}
      onError={(e) => {
        // Hide it right here rather than re-rendering: a browser paints a
        // broken <img> with a visible placeholder box, and with the whole
        // grid unreachable that is a screenful of torn-image icons over
        // the fallback map. Remembering the URL keeps it out of the next
        // batch too.
        e.currentTarget.style.display = 'none'
        failed.current.add(t.url)
        health.current.bad += 1
      }}
      style={{
        position: 'absolute',
        left: `${t.left}%`,
        top: `${t.top}%`,
        width: `${t.width}%`,
        height: `${t.height}%`,
        userSelect: 'none',
        // Shown only once it has actually decoded, so a slow tile never
        // flashes a placeholder over the fallback imagery underneath.
        visibility: loaded.current.has(t.url) ? 'visible' : 'hidden',
      }}
    />
  )

  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* The level you were just looking at, held under the incoming one so a
          zoom step never exposes the static floor. Dropped the moment the new
          level settles. */}
      {beneath && (
        <div style={{ position: 'absolute', inset: 0 }}>{beneath.map((t) => tileImg(t, true))}</div>
      )}
      <div style={{ position: 'absolute', inset: 0 }}>{list.map((t) => tileImg(t, false))}</div>
    </div>
  )
}
