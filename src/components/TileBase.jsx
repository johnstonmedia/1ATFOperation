import { useMemo, useRef, useState } from 'react'
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
// floor: it shows before the tiles arrive, it covers any ground outside the
// fetched region, and it is all that shows if the service is unreachable — no
// signal on camp, or the endpoint moves. A dead tile URL degrades to the old
// static map, never to a blank one.

// Give up after this many consecutive failures with nothing successful. The
// static image is already showing, so there is nothing to gain by retrying a
// host that isn't answering.
const FAIL_LIMIT = 8

export default function TileBase({ map }) {
  const failed = useRef(new Set())
  const health = useRef({ ok: 0, bad: 0 })
  const [, bump] = useState(0)

  // Computed from the MAP ALONE — not from the view — so it is stable for the
  // life of the component and a pan or zoom can never invalidate it.
  const tiles = useMemo(() => fixedTiles(map), [map])

  if (!tiles) return null
  if (health.current.bad >= FAIL_LIMIT && health.current.ok === 0) return null
  const list = tiles.list.filter((t) => !failed.current.has(t.url))
  if (!list.length) return null

  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {list.map((t) => (
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
            // grid unreachable that is a screenful of torn-image icons over the
            // fallback map. Remembering the URL keeps it out of a later render.
            e.currentTarget.style.display = 'none'
            failed.current.add(t.url)
            health.current.bad += 1
            if (health.current.bad === FAIL_LIMIT && health.current.ok === 0) bump((n) => n + 1)
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
