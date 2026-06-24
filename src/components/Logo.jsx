import { useState } from 'react'
import { useData } from '../context/DataContext'

// Renders the SCU crest. Prefers a real uploaded PNG (public/scu-logo.png or a
// branding.logoUrl set in the Operations Centre); falls back to the bundled SVG.
export default function Logo({ size = 56 }) {
  const { state } = useData()
  const base = import.meta.env.BASE_URL // '/' locally, '/<repo>/' on Pages
  const fallbackSvg = base + 'scu-logo.svg'
  const configured = state?.branding?.logoUrl || base + 'scu-logo.png'
  const [src, setSrc] = useState(configured)
  return (
    <img
      src={src}
      alt="Shore Cadet Unit crest"
      width={size}
      height={size}
      style={{ objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(54,224,192,0.25))' }}
      onError={() => {
        if (src !== fallbackSvg) setSrc(fallbackSvg)
      }}
    />
  )
}
