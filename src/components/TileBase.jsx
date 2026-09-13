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

// Enough to cover a 4:3 viewport at any zoom with margin; a guard against a
// bad region calculation asking the browser for thousands of images.
const MAX_TILES = 192
// Give up after this many consecutive failures with nothing successful. The
// static image is already showing, so there is nothing to gain by retrying a
// host that isn't answering.
const FAIL_LIMIT = 8

export default function TileBase({ map, view, containerRef }) {
  const [box, setBox] = useState({ w: 0, h: 0 })
  const failed = useRef(new Set())
  const health = useRef({ ok: 0, bad: 0 })

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
    if (!map?.tiles || !w || !h) return []
    if (health.current.bad >= FAIL_LIMIT && health.current.ok === 0) return []

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
    return out.length > MAX_TILES ? [] : out.filter((t) => !failed.current.has(t.url))
  }, [map, box, view.scale, view.x, view.y])

  if (!tiles.length) return null
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {tiles.map((t) => (
        <img
          key={t.key}
          src={t.url}
          alt=""
          draggable={false}
          onLoad={(e) => {
            health.current.ok += 1
            health.current.bad = 0
            e.currentTarget.style.visibility = 'visible'
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
            visibility: 'hidden',
          }}
        />
      ))}
    </div>
  )
}
