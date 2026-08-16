import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useAudit } from '../../hooks/useAudit'
import { OpsHeader, useSaved } from './OperationsCentre'
import { smeacOf, movementsOf, COMPANIES } from '../../firebase/seed'

const rid = () => Math.random().toString(36).slice(2, 9)

// Edits the main public narrative: unit identity, quote, the SMEAC operation
// brief, per-company roles, and the Meridian threat brief.
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
  // SMEAC fields edit against the MERGED view (defaults filled in), so the
  // first edit freezes the whole brief into n.smeac.
  const sm = smeacOf(n)
  const smeac = (k) => (e) => setN({ ...n, smeac: { ...sm, [k]: e.target.value } })

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
        <h3 className="accent" style={{ margin: 0 }}>Operation Brief — SMEAC</h3>
        <div className="mono dim" style={{ fontSize: 11 }}>
          Shown on the home page under the map. A section left empty is skipped.
        </div>
        <Field label="Section title"><input value={n.oneatf.title} onChange={oneatf('title')} /></Field>
        <Field label="Situation"><textarea rows={3} value={sm.situation} onChange={smeac('situation')} /></Field>
        <Field label="Mission"><textarea rows={3} value={sm.mission} onChange={smeac('mission')} /></Field>
        <Field label="Execution"><textarea rows={3} value={sm.execution} onChange={smeac('execution')} /></Field>
        <Field label="Admin & Logistics"><textarea rows={3} value={sm.admin} onChange={smeac('admin')} /></Field>
        <Field label="Command / Control / Communications"><textarea rows={3} value={sm.command} onChange={smeac('command')} /></Field>
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

      <MovementsEditor n={n} setN={setN} />

      <div className="panel panel-pad col" style={{ borderColor: 'var(--hostile)' }}>
        <h3 className="hostile" style={{ margin: 0 }}>Meridian Brief</h3>
        <div className="mono dim" style={{ fontSize: 11 }}>
          One box on the home page with two headings.
        </div>
        <Field label="Section title"><input value={n.meridian.title} onChange={meridian('title')} /></Field>
        <Field label="Threat level"><input value={n.meridian.threatLevel} onChange={meridian('threatLevel')} /></Field>
        <div className="row" style={{ gap: 10 }}>
          <div style={{ width: 180 }}><Field label="Heading 1"><input value={n.meridian.objectiveHeading || ''} onChange={meridian('objectiveHeading')} /></Field></div>
          <div className="grow"><Field label="Heading 1 content"><textarea rows={3} value={n.meridian.objective} onChange={meridian('objective')} /></Field></div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div style={{ width: 180 }}><Field label="Heading 2"><input value={n.meridian.motiveHeading || ''} onChange={meridian('motiveHeading')} /></Field></div>
          <div className="grow"><Field label="Heading 2 content"><textarea rows={3} value={n.meridian.motive} onChange={meridian('motive')} /></Field></div>
        </div>
        <Field label="Heading 2 — second paragraph (no heading of its own)">
          <textarea rows={3} value={n.meridian.whyStop} onChange={meridian('whyStop')} />
        </Field>
        <div className="mono dim" style={{ fontSize: 10 }}>
          This used to be a third box with its own heading. It now runs on under Heading 2 —
          the text is still published, the heading isn’t. Leave it blank to drop it entirely.
        </div>
      </div>
    </div>
  )
}

// Editor for the home page's "Recent movements" box. Rows are free-form: RHQ
// adds one per company action worth explaining, in whatever order tells the
// story — deliberately not one fixed row per company, since most weeks only a
// couple of companies actually move the line.
function MovementsEditor({ n, setN }) {
  const mv = movementsOf(n)
  const patch = (p) => setN({ ...n, movements: { ...mv, ...p } })
  const setEntry = (id, p) => patch({ entries: mv.entries.map((e) => (e.id === id ? { ...e, ...p } : e)) })
  const add = () => patch({ entries: [...mv.entries, { id: rid(), companies: ['A'], text: '' }] })
  const del = (id) => patch({ entries: mv.entries.filter((e) => e.id !== id) })
  // Toggle one company on/off a movement — a movement can be credited to any
  // subset of the six non-RHQ companies, not just one.
  const toggleCompany = (id, letter) => {
    const entry = mv.entries.find((x) => x.id === id)
    const current = entry?.companies || []
    const next = current.includes(letter) ? current.filter((l) => l !== letter) : [...current, letter]
    setEntry(id, { companies: next })
  }
  const move = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= mv.entries.length) return
    const next = [...mv.entries]
    ;[next[i], next[j]] = [next[j], next[i]]
    patch({ entries: next })
  }

  return (
    <div className="panel panel-pad col" style={{ marginBottom: 18 }}>
      <div className="row between center wrap" style={{ gap: 10 }}>
        <h3 className="accent" style={{ margin: 0 }}>Recent Movements</h3>
        <label className="row center" style={{ gap: 6, fontSize: 11 }}>
          <input type="checkbox" checked={!!mv.show} onChange={(e) => patch({ show: e.target.checked })} style={{ width: 'auto' }} />
          Show on site
        </label>
      </div>
      <div className="mono dim" style={{ fontSize: 11 }}>
        Sits above the company-roles box on the home page: what each company actually did to
        change the map. Untick “Show on site” to hide the whole box (e.g. between updates, so
        it never sits there stale). Removing every row hides it too.
      </div>

      <Field label="Box title"><input value={mv.title || ''} onChange={(e) => patch({ title: e.target.value })} /></Field>
      <Field label="Intro line (optional)"><input value={mv.intro || ''} onChange={(e) => patch({ intro: e.target.value })} /></Field>

      <div className="divider" />
      <div className="row between center">
        <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2 }}>MOVEMENTS</div>
        <button className="ghost" onClick={add} style={{ padding: '3px 9px' }}>+ Add movement</button>
      </div>
      {!mv.entries.length && <div className="mono dim" style={{ fontSize: 12 }}>No movements listed — the box is hidden.</div>}
      {mv.entries.map((e, i) => (
        <div key={e.id} className="row wrap" style={{ gap: 8, alignItems: 'flex-start', borderTop: '1px solid var(--line)', paddingTop: 8 }}>
          {/* One toggle per company (max six — every non-RHQ company) rather
              than a single-select: a movement can now be credited to more
              than one company at once. */}
          <div className="row wrap" style={{ gap: 4, flex: '0 0 auto', width: 88 }}>
            {COMPANIES.filter((c) => c.letter !== 'R').map((c) => {
              const active = (e.companies || []).includes(c.letter)
              return (
                <button key={c.letter} type="button" title={c.name} onClick={() => toggleCompany(e.id, c.letter)}
                  className={active ? '' : 'ghost'}
                  style={{
                    width: 26, height: 26, padding: 0, borderRadius: 4,
                    background: active ? c.accent : 'transparent',
                    borderColor: active ? c.accent : undefined,
                    color: active ? '#04121b' : undefined,
                    fontFamily: 'Orbitron', fontWeight: 700, fontSize: 11,
                  }}>{c.letter}</button>
              )
            })}
          </div>
          <textarea rows={2} value={e.text} onChange={(ev) => setEntry(e.id, { text: ev.target.value })}
            placeholder="e.g. Cleared the approach to Singleton, forcing the Meridian line back off the ridge."
            style={{ flex: '1 1 260px' }} />
          <div className="row" style={{ gap: 4, flex: '0 0 auto' }}>
            <button className="ghost" style={{ padding: '3px 8px' }} onClick={() => move(i, -1)} disabled={i === 0} title="Move up">↑</button>
            <button className="ghost" style={{ padding: '3px 8px' }} onClick={() => move(i, 1)} disabled={i === mv.entries.length - 1} title="Move down">↓</button>
            <button className="danger ghost" style={{ padding: '3px 8px' }} onClick={() => del(e.id)}>Remove</button>
          </div>
        </div>
      ))}
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
