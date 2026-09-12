import { useEffect, useRef, useState } from 'react'
import { coyLabelOf, labelOf } from '../lib/territory'
import { legendCodes } from '../lib/companyLabels'
import { renderHatchSwatch } from '../lib/terrainRender'

// Map key. Each swatch is drawn with the SAME cached hatch pattern the
// territory layer fills cells with (renderHatchSwatch), not a flat colour
// chip — so the key looks like a literal off-cut of the map and a visitor can
// match a swatch to the ground under it without interpreting anything.
//
// STATIC by design: the full roster is always listed, whether or not that
// company currently holds ground. The key is a fixed reference for reading the
// map, so it must not reshuffle or drop rows as the replay animates through
// frames — a legend that changes under you is harder to use than one carrying
// an entry with nothing on the board. (RHQ is the sole conditional row, since
// `showRHQ: false` means it isn't drawn on the map at all.)
//
// A map may also carry a TERRAIN KEY (`terrainKey` in lib/maps.js) naming what
// its own art's colours mean — the roads, tracks, drainage and boundaries the
// source sheet's legend defines. That is a longer list than the company key
// and it is reference material rather than live state, so it sits behind a
// toggle instead of permanently doubling the height of the key.

const SWATCH_W = 26
const SWATCH_H = 14

function Swatch({ code }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    // Match the map: size the pixel buffer to the real display resolution
    // rather than letting the browser rescale a fixed buffer, which would
    // alias the fine diagonals into an uneven wash.
    const dpr = window.devicePixelRatio || 1
    cv.width = Math.round(SWATCH_W * dpr)
    cv.height = Math.round(SWATCH_H * dpr)
    renderHatchSwatch(cv.getContext('2d'), code, cv.width, cv.height)
  }, [code])
  return (
    <canvas ref={ref} aria-hidden="true"
      style={{ width: SWATCH_W, height: SWATCH_H, borderRadius: 2, display: 'block', flex: '0 0 auto' }} />
  )
}

export default function MapLegend({ showRHQ = true, map }) {
  const codes = legendCodes({ showRHQ })
  const terrain = map?.terrainKey || []
  const [openTerrain, setOpenTerrain] = useState(false)
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row wrap center" style={{ gap: 14, rowGap: 8 }}>
        <span className="tag" style={{ flex: '0 0 auto' }}>MAP KEY</span>
        {codes.map((code) => (
          <span key={code} className="row center" style={{ gap: 6, flex: '0 0 auto' }}
            title={labelOf(code) || undefined}>
            <Swatch code={code} />
            <span className="mono" style={{ fontSize: 11, letterSpacing: 1 }}>{coyLabelOf(code)}</span>
          </span>
        ))}
        {terrain.length > 0 && (
          <button
            className="ghost"
            onClick={() => setOpenTerrain((v) => !v)}
            aria-expanded={openTerrain}
            style={{ padding: '2px 10px', fontSize: 10, flex: '0 0 auto' }}
            title="What the colours of the map itself mean"
          >
            {openTerrain ? '− TERRAIN' : '+ TERRAIN'}
          </button>
        )}
      </div>
      {openTerrain && terrain.length > 0 && (
        <div className="row wrap center" style={{ gap: 12, rowGap: 6 }}>
          {terrain.map((t) => (
            <span key={t.label} className="row center" style={{ gap: 5, flex: '0 0 auto' }}>
              <span aria-hidden="true" style={{
                width: 16, height: 10, borderRadius: 2, background: t.color,
                border: '1px solid rgba(0,0,0,0.35)', display: 'block', flex: '0 0 auto',
              }} />
              <span className="mono dim" style={{ fontSize: 10, letterSpacing: 0.5 }}>{t.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
