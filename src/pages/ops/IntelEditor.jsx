import { useState, useEffect } from 'react'
import { useData } from '../../context/DataContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useAudit } from '../../hooks/useAudit'
import { OpsHeader, useSaved } from './OperationsCentre'
import { Field } from './NarrativeEditor'
import FragmentForm from '../../components/FragmentForm'
import LanguageWarning from '../../components/LanguageWarning'
import IntelPreview from '../../components/IntelPreview'
import { listStats, summarise } from '../../lib/intelStats'
import { COMPANIES, PHONETIC } from '../../firebase/seed'

const rid = () => Math.random().toString(36).slice(2, 10)
const audLabel = (code) => (code === 'ALL' ? 'Unit-wide (RHQ)' : PHONETIC[code] || code)

// RHQ / COY manage the decryptable intel fragments cadets see per company.
export default function IntelEditor() {
  const { state, updateSlice } = useData()
  const confirm = useConfirm()
  const audit = useAudit()
  const [editing, setEditing] = useState(null)

  const intel = state.intel || []
  const blank = () => ({ id: rid(), company: 'A', title: '', prompt: '', answer: '', hint: '', reveal: '', resources: [], docUrl: '', ts: Date.now() })

  const upsert = (f) => {
    const exists = intel.some((x) => x.id === f.id)
    updateSlice('intel', exists ? intel.map((x) => (x.id === f.id ? f : x)) : [...intel, f])
    audit('Saved intel fragment', `${audLabel(f.company)}: “${f.title || 'untitled'}”`)
    setEditing(null)
  }
  const remove = async (id) => {
    const f = intel.find((x) => x.id === id)
    if (!(await confirm({ title: 'Delete intel', message: `Delete “${f?.title || 'this fragment'}”?`, danger: true, confirmLabel: 'Delete' }))) return
    updateSlice('intel', intel.filter((x) => x.id !== id))
  }

  if (editing) return <Builder fragment={editing} onCancel={() => setEditing(null)} onSave={upsert} />

  return (
    <div>
      <OpsHeader title="Intercepted Intelligence" sub="TASKING // DECRYPTABLE FRAGMENTS" updatedAt={state.contentMeta?.intel?.updatedAt}>
        <button className="primary" onClick={() => setEditing(blank())}>+ New fragment</button>
      </OpsHeader>

      <IntroEditor />

      <div className="mono dim" style={{ fontSize: 11, marginBottom: 14 }}>
        Each fragment is a coded message a cadet decrypts. Set the audience to a company, or <span className="accent">Entire unit</span> for the RHQ intelligence section. No login — cadets pick their company on the site.
      </div>

      {intel.length === 0 && <div className="panel panel-pad mono dim" style={{ fontSize: 13 }}>No intel fragments yet.</div>}
      <div className="col" style={{ gap: 12 }}>
        {intel.map((f) => (
          <div key={f.id} className="panel panel-pad row between center wrap" style={{ gap: 12 }}>
            <div>
              <div className="head" style={{ fontSize: 15 }}>{f.title || 'Untitled fragment'}</div>
              <div className="mono dim" style={{ fontSize: 11 }}>
                {audLabel(f.company)} · solution: <span className="accent">{f.answer || '—'}</span>
                {String(f.hint || '').trim() ? ' · has hint' : ''}
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="ghost" onClick={() => setEditing(f)}>Edit</button>
              <button className="danger ghost" onClick={() => remove(f.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <DecryptStats intel={intel} />
    </div>
  )
}

// Anonymous engagement figures: how many devices have cracked each fragment,
// and how that splits by company. This is the only feedback loop RHQ has on
// whether the puzzles are landing — the public tabs have no accounts, so
// there's nothing else to measure against.
//
// Presented as an ENGAGEMENT SIGNAL, deliberately not as a score: the count is
// device-deduped, not person-deduped, and an unauthenticated visitor can
// inflate it one request at a time (see the intelStats block in
// firestore.rules). Anyone reading this panel needs to know that.
function DecryptStats({ intel }) {
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setBusy(true)
    setRows(await listStats())
    setBusy(false)
  }
  useEffect(() => { load() }, [])

  const s = rows ? summarise(rows, intel) : null

  return (
    <div className="panel panel-pad col" style={{ gap: 10, marginTop: 18 }}>
      <div className="row between center wrap" style={{ gap: 8 }}>
        <strong className="head" style={{ fontSize: 14 }}>Decrypts</strong>
        <div className="row center" style={{ gap: 8 }}>
          {s && <span className="mono accent" style={{ fontSize: 11 }}>{s.total} TOTAL</span>}
          <button className="ghost" onClick={load} disabled={busy} style={{ padding: '3px 9px', fontSize: 11 }}>
            {busy ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>
      <div className="mono dim" style={{ fontSize: 11, lineHeight: 1.6 }}>
        Anonymous count of devices that have solved each fragment — no names, no IDs, nothing
        identifying a cadet. Treat it as an engagement signal, not a score: it counts devices
        rather than people, and it isn’t tamper-proof.
      </div>

      {!s && <div className="mono dim" style={{ fontSize: 12 }}>Loading…</div>}
      {s && s.total === 0 && <div className="mono dim" style={{ fontSize: 12 }}>No decrypts recorded yet.</div>}

      {s && s.total > 0 && (
        <>
          <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2, marginTop: 4 }}>BY COMPANY</div>
          <div className="row wrap" style={{ gap: 8 }}>
            {s.byCompany.map((c) => (
              <span key={c.company} className="tag" style={{ fontSize: 11 }}>
                {c.company === 'NONE' ? 'No company set' : audLabel(c.company)} · <span className="accent">{c.solves}</span>
              </span>
            ))}
          </div>

          <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2, marginTop: 8 }}>BY FRAGMENT</div>
          {s.byFragment.map((f) => (
            <div key={f.fragmentId} className="row between center wrap"
              style={{ gap: 8, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
              <span style={{ fontSize: 13, color: f.deleted ? 'var(--text-dim)' : undefined }}>
                {f.title}{f.deleted ? ' (deleted)' : ''}
              </span>
              <span className="row center" style={{ gap: 10, flex: '0 0 auto' }}>
                <span className="mono dim" style={{ fontSize: 10 }}>
                  {f.lastAt ? `last ${new Date(f.lastAt).toLocaleDateString()}` : ''}
                </span>
                <span className="mono accent" style={{ fontSize: 13 }}>{f.solves}</span>
              </span>
            </div>
          ))}
          {/* Fragments nobody has cracked don't appear above (they have no
              stats doc at all), so call them out — a zero is the most useful
              number here. */}
          <ZeroSolves intel={intel} solved={new Set(s.byFragment.map((f) => f.fragmentId))} />
        </>
      )}
    </div>
  )
}

function ZeroSolves({ intel, solved }) {
  const none = intel.filter((f) => String(f.answer || '').trim() && !solved.has(f.id))
  if (!none.length) return null
  return (
    <div className="mono" style={{ fontSize: 11, marginTop: 8, color: 'var(--warn)' }}>
      No decrypts yet: {none.map((f) => f.title || 'Untitled').join(', ')}
    </div>
  )
}

// Editable intro (title + paragraph) shown atop the recruit Intelligence tab,
// with a checkbox to show or hide it.
function IntroEditor() {
  const { state, updateSlice } = useData()
  const [saved, flash] = useSaved()
  const [intro, setIntro] = useState(state.intelIntro || { show: true, title: '', text: '' })
  const set = (k) => (e) => setIntro({ ...intro, [k]: e.target.value })
  return (
    <div className="panel panel-pad col" style={{ marginBottom: 16, maxWidth: 720 }}>
      <div className="row between center">
        <strong className="head" style={{ fontSize: 14 }}>Intro text (top of the tab)</strong>
        <label className="row center" style={{ gap: 6, fontSize: 11 }}>
          <input type="checkbox" checked={!!intro.show} onChange={(e) => setIntro({ ...intro, show: e.target.checked })} style={{ width: 'auto' }} /> Show on site
        </label>
      </div>
      <Field label="Title"><input value={intro.title || ''} onChange={set('title')} /></Field>
      <Field label="Paragraph"><textarea rows={3} value={intro.text || ''} onChange={set('text')} /></Field>
      <button className="ghost" style={{ alignSelf: 'flex-start' }} onClick={() => { updateSlice('intelIntro', intro); flash() }}>{saved ? 'Saved ✓' : 'Save intro'}</button>
    </div>
  )
}

function Builder({ fragment, onCancel, onSave }) {
  const [saved, flash] = useSaved()
  const [f, setF] = useState({ ...fragment, resources: fragment.resources || [] })
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const [preview, setPreview] = useState(false)

  // Preview renders the REAL cadet component against the unsaved draft, so
  // what RHQ checks is literally what gets published — including how many
  // answer boxes the solution produces, which is the thing most worth
  // eyeballing before it goes live. It records no solve and no telemetry.
  if (preview) return <IntelPreview fragment={f} onBack={() => setPreview(false)} />

  const save = () => { onSave(f); flash() }

  return (
    <div>
      <OpsHeader title="Build Intel" sub="INTEL FRAGMENT // EDITOR">
        <button className="ghost" onClick={() => setPreview(true)}>👁 Preview as recruit</button>
        <button className="ghost" onClick={onCancel}>← Back</button>
      </OpsHeader>

      <LanguageWarning texts={[f.title, f.prompt, f.answer, f.hint, f.reveal]} style={{ marginBottom: 14, maxWidth: 720 }} />

      <FragmentForm
        f={f}
        set={set}
        audience={
          <Field label="Audience">
            <select value={f.company} onChange={(e) => set('company', e.target.value)}>
              <option value="ALL">Entire unit (RHQ intelligence)</option>
              {COMPANIES.filter((c) => c.letter !== 'R').map((c) => <option key={c.letter} value={c.letter}>{c.name} ({c.letter})</option>)}
            </select>
          </Field>
        }
      />

      <button className="primary" onClick={save}>{saved ? 'Saved ✓' : 'Save fragment'}</button>
    </div>
  )
}
