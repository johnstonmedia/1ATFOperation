import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { OpsHeader, useSaved } from './OperationsCentre'
import { Field } from './NarrativeEditor'
import { FIREBASE_ENABLED, storage } from '../../firebase/config'

// Upload logos and set theme colours. Local mode stores the logo as a data URL;
// with Firebase enabled it is uploaded to Cloud Storage.
export default function BrandingEditor() {
  const { state, updateSlice } = useData()
  const [b, setB] = useState(state.branding)
  const [saved, flash] = useSaved()
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setB({ ...b, [k]: e.target.value })

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      let url
      if (FIREBASE_ENABLED) {
        const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage')
        const r = ref(storage, `branding/${Date.now()}-${file.name}`)
        await uploadBytes(r, file)
        url = await getDownloadURL(r)
      } else {
        url = await new Promise((res) => {
          const fr = new FileReader()
          fr.onload = () => res(fr.result)
          fr.readAsDataURL(file)
        })
      }
      setB((prev) => ({ ...prev, logoUrl: url }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <OpsHeader title="Branding & Assets" sub="EDIT // IDENTITY">
        <button className="primary" onClick={() => { updateSlice('branding', b); flash() }}>
          {saved ? 'Saved ✓' : 'Save'}
        </button>
      </OpsHeader>
      <div className="row wrap" style={{ gap: 18, alignItems: 'flex-start' }}>
        <div className="panel panel-pad col" style={{ width: 320 }}>
          <Field label="Unit logo">
            <input type="file" accept="image/*" onChange={onFile} />
          </Field>
          {busy && <div className="mono accent" style={{ fontSize: 11 }}>Uploading…</div>}
          <div className="col center" style={{ background: 'rgba(0,0,0,0.4)', padding: 20, borderRadius: 4 }}>
            <img src={b.logoUrl} alt="logo preview" style={{ maxWidth: 160, maxHeight: 160, objectFit: 'contain' }} />
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
