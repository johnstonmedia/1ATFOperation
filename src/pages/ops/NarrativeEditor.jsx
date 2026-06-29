import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useAudit } from '../../hooks/useAudit'
import { OpsHeader, useSaved } from './OperationsCentre'
import { COMPANIES } from '../../firebase/seed'

// Edits the main public narrative: unit identity, quote, 1ATF mission,
// per-company roles, and the Meridian threat brief.
export default function NarrativeEditor() {
  const { state, updateSlice } = useData()
  const audit = useAudit()
  const [n, setN] = useState(state.narrative)
  const [saved, flash] = useSaved()

  const save = () => {
    updateSlice('narrative', n)
    audit('Updated main narrative')
    flash()
  }
  const top = (k) => (e) => setN({ ...n, [k]: e.target.value })
  const oneatf = (k) => (e) => setN({ ...n, oneatf: { ...n.oneatf, [k]: e.target.value } })
  const meridian = (k) => (e) => setN({ ...n, meridian: { ...n.meridian, [k]: e.target.value } })
  const company = (name) => (e) =>
    setN({ ...n, oneatf: { ...n.oneatf, companies: { ...n.oneatf.companies, [name]: e.target.value } } })

  return (
    <div>
      <OpsHeader title="Main Narrative" sub="EDIT // PUBLIC HOME CONTENT" updatedAt={state.contentMeta?.narrative?.updatedAt}>
        <button className="primary" onClick={save}>{saved ? 'Saved ✓' : 'Save changes'}</button>
      </OpsHeader>

      <div className="panel panel-pad col" style={{ marginBottom: 18 }}>
        <Field label="Unit name"><input value={n.unitName} onChange={top('unitName')} /></Field>
        <Field label="Short name"><input value={n.shortName} onChange={top('shortName')} /></Field>
        <Field label="Header quote"><input value={n.quote} onChange={top('quote')} /></Field>
      </div>

      <div className="panel panel-pad col" style={{ marginBottom: 18 }}>
        <h3 className="accent" style={{ margin: 0 }}>1ATF Brief</h3>
        <Field label="Section title"><input value={n.oneatf.title} onChange={oneatf('title')} /></Field>
        <Field label="Mission"><textarea rows={4} value={n.oneatf.mission} onChange={oneatf('mission')} /></Field>
        <div className="divider" />
        <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2 }}>COMPANY ROLES</div>
        {COMPANIES.map((c) => (
          <Field key={c.letter} label={`${c.name} (${c.letter})`}>
            <textarea rows={2} value={n.oneatf.companies[c.name] || ''} onChange={company(c.name)} />
          </Field>
        ))}
      </div>

      <div className="panel panel-pad col" style={{ borderColor: 'var(--hostile)' }}>
        <h3 className="hostile" style={{ margin: 0 }}>Meridian Brief</h3>
        <Field label="Section title"><input value={n.meridian.title} onChange={meridian('title')} /></Field>
        <Field label="Threat level"><input value={n.meridian.threatLevel} onChange={meridian('threatLevel')} /></Field>
        <Field label="Motive"><textarea rows={3} value={n.meridian.motive} onChange={meridian('motive')} /></Field>
        <Field label="Objective"><textarea rows={3} value={n.meridian.objective} onChange={meridian('objective')} /></Field>
        <Field label="Why we stop them"><textarea rows={3} value={n.meridian.whyStop} onChange={meridian('whyStop')} /></Field>
      </div>
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <div className="col" style={{ gap: 4 }}>
      <label>{label}</label>
      {children}
    </div>
  )
}
