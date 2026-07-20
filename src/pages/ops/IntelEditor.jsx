import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useAudit } from '../../hooks/useAudit'
import { OpsHeader, useSaved } from './OperationsCentre'
import { Field } from './NarrativeEditor'
import DocEmbed from '../../components/DocEmbed'
import { COMPANIES, PHONETIC } from '../../firebase/seed'

const rid = () => Math.random().toString(36).slice(2, 10)

// RHQ / COY manage the decryptable intel fragments cadets see per company.
export default function IntelEditor() {
  const { state, updateSlice } = useData()
  const confirm = useConfirm()
  const audit = useAudit()
  const [editing, setEditing] = useState(null)

  const intel = state.intel || []
  const blank = () => ({ id: rid(), company: 'A', title: '', prompt: '', answer: '', reveal: '', resources: [], docUrl: '', ts: Date.now() })

  const upsert = (f) => {
    const exists = intel.some((x) => x.id === f.id)
    updateSlice('intel', exists ? intel.map((x) => (x.id === f.id ? f : x)) : [...intel, f])
    audit('Saved intel fragment', `${PHONETIC[f.company] || f.company}: “${f.title || 'untitled'}”`)
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
      <OpsHeader title="Intel" sub="TASKING // DECRYPTABLE FRAGMENTS" updatedAt={state.contentMeta?.intel?.updatedAt}>
        <button className="primary" onClick={() => setEditing(blank())}>+ New fragment</button>
      </OpsHeader>
      <div className="mono dim" style={{ fontSize: 11, marginBottom: 14 }}>
        Each fragment is a coded message a cadet decrypts to reveal camp info. They pick their company on the public Intel page; no login.
      </div>

      {intel.length === 0 && <div className="panel panel-pad mono dim" style={{ fontSize: 13 }}>No intel fragments yet.</div>}
      <div className="col" style={{ gap: 12 }}>
        {intel.map((f) => (
          <div key={f.id} className="panel panel-pad row between center wrap" style={{ gap: 12 }}>
            <div>
              <div className="head" style={{ fontSize: 15 }}>{f.title || 'Untitled fragment'}</div>
              <div className="mono dim" style={{ fontSize: 11 }}>{PHONETIC[f.company] || f.company} · solution: <span className="accent">{f.answer || '—'}</span></div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="ghost" onClick={() => setEditing(f)}>Edit</button>
              <button className="danger ghost" onClick={() => remove(f.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Builder({ fragment, onCancel, onSave }) {
  const [saved, flash] = useSaved()
  const [f, setF] = useState({ ...fragment, resources: fragment.resources || [] })
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const [resDraft, setResDraft] = useState({ title: '', url: '' })

  const addLink = () => {
    if (!resDraft.url.trim()) return
    set('resources', [...f.resources, { id: rid(), type: 'link', title: resDraft.title.trim() || resDraft.url.trim(), url: resDraft.url.trim() }])
    setResDraft({ title: '', url: '' })
  }
  const addImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 150 * 1024) { e.target.value = ''; return }
    const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file) })
    set('resources', [...f.resources, { id: rid(), type: 'image', title: file.name, url }])
    e.target.value = ''
  }
  const delRes = (id) => set('resources', f.resources.filter((r) => r.id !== id))

  const save = () => { onSave(f); flash() }

  return (
    <div>
      <OpsHeader title="Build Intel" sub="INTEL FRAGMENT // EDITOR">
        <button className="ghost" onClick={onCancel}>← Back</button>
      </OpsHeader>

      <div className="panel panel-pad col" style={{ marginBottom: 16, maxWidth: 720 }}>
        <div className="row" style={{ gap: 10 }}>
          <Field label="Company">
            <select value={f.company} onChange={(e) => set('company', e.target.value)}>
              {COMPANIES.map((c) => <option key={c.letter} value={c.letter}>{c.name} ({c.letter})</option>)}
            </select>
          </Field>
          <div className="grow"><Field label="Title"><input value={f.title} onChange={(e) => set('title', e.target.value)} /></Field></div>
        </div>
        <Field label="Coded message / instructions (what the cadet sees)">
          <textarea rows={3} value={f.prompt} onChange={(e) => set('prompt', e.target.value)} placeholder="e.g. Decode the Morse:  -.-. .- -- .--." />
        </Field>
        <Field label="Solution (the decoded words — cadet gets one box per word)">
          <input className="mono" value={f.answer} onChange={(e) => set('answer', e.target.value)} placeholder="e.g. CAMP AT SINGLETON" />
        </Field>
        <Field label="Revealed intel (shown once they decode it — the actual info)">
          <textarea rows={3} value={f.reveal} onChange={(e) => set('reveal', e.target.value)} placeholder="e.g. Depart 0700 Sat 12 Apr, Singleton. Bring webbing + boots." />
        </Field>
        <Field label="Embedded document (optional URL — direct PDF/image or Google Drive)">
          <input value={f.docUrl} onChange={(e) => set('docUrl', e.target.value)} placeholder="docs/brief.pdf · https://… · Drive link" />
        </Field>
        {f.docUrl.trim() && <DocEmbed url={f.docUrl} height={280} />}
      </div>

      <div className="panel panel-pad col" style={{ marginBottom: 16, maxWidth: 720 }}>
        <strong className="head" style={{ fontSize: 14 }}>Resources (e.g. a Morse-code chart)</strong>
        <div className="col" style={{ gap: 6 }}>
          {f.resources.map((r) => (
            <div key={r.id} className="row between center" style={{ gap: 8, borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
              <span className="mono" style={{ fontSize: 12 }}>{r.type === 'image' ? '🖼' : '🔗'} {r.title}</span>
              <button className="danger ghost" onClick={() => delRes(r.id)} style={{ padding: '2px 8px' }}>Remove</button>
            </div>
          ))}
        </div>
        <div className="row wrap" style={{ gap: 8, alignItems: 'flex-end' }}>
          <div className="grow" style={{ minWidth: 140 }}><Field label="Link title"><input value={resDraft.title} onChange={(e) => setResDraft({ ...resDraft, title: e.target.value })} /></Field></div>
          <div className="grow" style={{ minWidth: 180 }}><Field label="Link URL"><input value={resDraft.url} onChange={(e) => setResDraft({ ...resDraft, url: e.target.value })} placeholder="https://…" /></Field></div>
          <button className="ghost" onClick={addLink}>+ Add link</button>
          <label className="btn ghost" style={{ cursor: 'pointer', padding: '8px 12px' }}>+ Image<input type="file" accept="image/*" onChange={addImage} style={{ display: 'none' }} /></label>
        </div>
      </div>

      <button className="primary" onClick={save}>{saved ? 'Saved ✓' : 'Save fragment'}</button>
    </div>
  )
}
