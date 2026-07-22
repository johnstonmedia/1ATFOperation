import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useAudit } from '../../hooks/useAudit'
import { OpsHeader, useSaved } from './OperationsCentre'

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
      <OpsHeader title="Map: Narrative" sub="EDIT // COMMAND MAP TEXT" updatedAt={state.contentMeta?.narrative?.updatedAt}>
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
        <Field label="Recruit companies (A/B/C/D) — shared role">
          <textarea rows={2} value={n.oneatf.recruitRole || ''} onChange={oneatf('recruitRole')} />
        </Field>
        <Field label="Echo">
          <textarea rows={2} value={n.oneatf.companies.Echo || ''} onChange={company('Echo')} />
        </Field>
        <Field label="Support">
          <textarea rows={2} value={n.oneatf.companies.Support || ''} onChange={company('Support')} />
        </Field>
      </div>

      <div className="panel panel-pad col" style={{ borderColor: 'var(--hostile)' }}>
        <h3 className="hostile" style={{ margin: 0 }}>Meridian Brief</h3>
        <Field label="Section title"><input value={n.meridian.title} onChange={meridian('title')} /></Field>
        <Field label="Threat level"><input value={n.meridian.threatLevel} onChange={meridian('threatLevel')} /></Field>
        <div className="row" style={{ gap: 10 }}>
          <div style={{ width: 180 }}><Field label="Box 1 heading"><input value={n.meridian.motiveHeading || ''} onChange={meridian('motiveHeading')} /></Field></div>
          <div className="grow"><Field label="Box 1 content"><textarea rows={3} value={n.meridian.motive} onChange={meridian('motive')} /></Field></div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div style={{ width: 180 }}><Field label="Box 2 heading"><input value={n.meridian.objectiveHeading || ''} onChange={meridian('objectiveHeading')} /></Field></div>
          <div className="grow"><Field label="Box 2 content"><textarea rows={3} value={n.meridian.objective} onChange={meridian('objective')} /></Field></div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div style={{ width: 180 }}><Field label="Box 3 heading"><input value={n.meridian.whyHeading || ''} onChange={meridian('whyHeading')} /></Field></div>
          <div className="grow"><Field label="Box 3 content"><textarea rows={3} value={n.meridian.whyStop} onChange={meridian('whyStop')} /></Field></div>
        </div>
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
