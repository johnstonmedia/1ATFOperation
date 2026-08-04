import { useEffect, useRef } from 'react'
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

export default function MapLegend({ showRHQ = true }) {
  const codes = legendCodes({ showRHQ })
  return (
    <div className="row wrap center" style={{ gap: 14, rowGap: 8 }}>
      <span className="tag" style={{ flex: '0 0 auto' }}>MAP KEY</span>
      {codes.map((code) => (
        <span key={code} className="row center" style={{ gap: 6, flex: '0 0 auto' }}
          title={labelOf(code) || undefined}>
          <Swatch code={code} />
          <span className="mono" style={{ fontSize: 11, letterSpacing: 1 }}>{coyLabelOf(code)}</span>
        </span>
      ))}
    </div>
  )
}
