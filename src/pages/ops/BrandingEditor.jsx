import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { OpsHeader, useSaved } from './OperationsCentre'
import { Field } from './NarrativeEditor'

// Theme colours. The unit logo is set by placing scu-logo.png in the public/
// folder of the repo (no upload / Firebase Storage required).
export default function BrandingEditor() {
  const { state, updateSlice } = useData()
  const [b, setB] = useState(state.branding)
  const [saved, flash] = useSaved()
  const set = (k) => (e) => setB({ ...b, [k]: e.target.value })

  return (
    <div>
      <OpsHeader title="Branding & Assets" sub="EDIT // IDENTITY">
        <button className="primary" onClick={() => { updateSlice('branding', b); flash() }}>
          {saved ? 'Saved ✓' : 'Save'}
        </button>
      </OpsHeader>
      <div className="row wrap" style={{ gap: 18, alignItems: 'flex-start' }}>
        <div className="panel panel-pad col" style={{ width: 320 }}>
          <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2 }}>UNIT LOGO</div>
          <div className="col center" style={{ background: 'rgba(0,0,0,0.4)', padding: 20, borderRadius: 4 }}>
            <img src={b.logoUrl} alt="logo preview" style={{ maxWidth: 160, maxHeight: 160, objectFit: 'contain' }} />
          </div>
          <div className="mono dim" style={{ fontSize: 11, lineHeight: 1.5 }}>
            To change the logo, place your image at <span className="accent">public/scu-logo.png</span> in
            the repository and commit. It is used automatically across the site.
          </div>
        </div>
        <div className="panel panel-pad col" style={{ width: 280 }}>
          <Field label="Primary colour"><input type="text" value={b.primary} onChange={set('primary')} /></Field>
          <Field label="Hostile colour"><input type="text" value={b.hostile} onChange={set('hostile')} /></Field>
          <Field label="Accent colour"><input type="text" value={b.accent} onChange={set('accent')} /></Field>
          <div className="row" style={{ gap: 8 }}>
            {[b.primary, b.hostile, b.accent].map((c, i) => (
              <span key={i} style={{ width: 40, height: 40, background: c, borderRadius: 4, border: '1px solid var(--line)' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
