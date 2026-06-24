import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { OpsHeader, useSaved } from './OperationsCentre'
import { Field } from './NarrativeEditor'

// Edits the URL-only /Classified landing page.
export default function ClassifiedEditor() {
  const { state, updateSlice } = useData()
  const [c, setC] = useState(state.classified)
  const [saved, flash] = useSaved()
  const set = (k) => (e) => setC({ ...c, [k]: e.target.value })

  return (
    <div>
      <OpsHeader title="Classified Page" sub="EDIT // /CLASSIFIED">
        <button className="primary" onClick={() => { updateSlice('classified', c); flash() }}>
          {saved ? 'Saved ✓' : 'Save'}
        </button>
      </OpsHeader>
      <div className="panel panel-pad col" style={{ maxWidth: 640 }}>
        <Field label="Heading (big red letters)"><input value={c.heading} onChange={set('heading')} /></Field>
        <Field label="Unit line"><input value={c.unit} onChange={set('unit')} /></Field>
        <Field label="Brief"><textarea rows={4} value={c.brief} onChange={set('brief')} /></Field>
        <Field label="Motto"><input value={c.motto} onChange={set('motto')} /></Field>
        <div className="mono dim" style={{ fontSize: 11 }}>
          Live at <span className="accent">/Classified</span> — share this link with the unit.
        </div>
      </div>
    </div>
  )
}
