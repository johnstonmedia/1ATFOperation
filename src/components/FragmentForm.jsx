import { useState } from 'react'
import { Field } from '../pages/ops/NarrativeEditor'
import DocEmbed from './DocEmbed'

// The intel-fragment form, shared by all THREE places a fragment is authored:
//   - Ops Centre → Intercepted Intelligence (RHQ, audience selectable)
//   - COY Centre (a commander, locked to their own company)
//   - Approvals (RHQ / RHQ Staff editing a commander's submission before it goes live)
//
// It lives in one place deliberately: these were three near-identical copies, and
// the approvals copy had silently fallen behind — no hint field, no image
// resources, and no way to add resources at all unless the submission already had
// some. A reviewer who can't edit a field can only dismiss the submission and ask
// the commander to redo it, which defeats the point of the queue.
//
// `audience` is a node rather than a flag so each caller supplies its own control
// (a <select> for RHQ, a read-only line where the company is locked).

const rid = () => Math.random().toString(36).slice(2, 10)
const MAX_IMAGE_BYTES = 150 * 1024

export default function FragmentForm({ f, set, audience, docHeight = 280, maxWidth = 720 }) {
  const resources = f.resources || []
  const docUrl = String(f.docUrl || '').trim()

  return (
    <>
      <div className="panel panel-pad col" style={{ marginBottom: 16, maxWidth }}>
        {audience}
        <Field label="Title"><input value={f.title || ''} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Coded message / instructions (what the cadet sees)">
          <textarea rows={3} value={f.prompt || ''} onChange={(e) => set('prompt', e.target.value)} placeholder="e.g. Decode the Morse:  -.-. .- -- .--." />
        </Field>
        <Field label="Solution (the decoded words — cadet gets one box per word)">
          <input className="mono" value={f.answer || ''} onChange={(e) => set('answer', e.target.value)} placeholder="e.g. CAMP AT SINGLETON" />
        </Field>
        <Field label="Hint (optional — cadets reveal it themselves with a button; leave blank for no hint)">
          <textarea rows={2} value={f.hint || ''} onChange={(e) => set('hint', e.target.value)} placeholder="e.g. Each group of dots and dashes is one letter. There's a Morse chart in Resources." />
        </Field>
        <Field label="Revealed intel (shown once they decode it — the actual info)">
          <textarea rows={3} value={f.reveal || ''} onChange={(e) => set('reveal', e.target.value)} placeholder="e.g. Depart 0700 Sat 12 Apr, Singleton. Bring webbing + boots." />
        </Field>
        <Field label="Embedded document (optional URL — direct PDF/image or Google Drive)">
          <input value={f.docUrl || ''} onChange={(e) => set('docUrl', e.target.value)} placeholder="docs/brief.pdf · https://… · Drive link" />
        </Field>
        {docUrl && <DocEmbed url={docUrl} height={docHeight} />}
      </div>

      <ResourcesPanel
        resources={resources}
        onChange={(next) => set('resources', next)}
        maxWidth={maxWidth}
      />
    </>
  )
}

// Resources are handouts a cadet gets alongside the puzzle — a Morse chart, a
// map crop, a link. They're shown here as the thing they actually are (image
// thumbnails, openable links) rather than as a filename: reviewing a submission
// means judging the handout, and "🖼 IMG_2841.jpg" tells you nothing about
// whether it's appropriate, legible, or even the right picture.
function ResourcesPanel({ resources, onChange, maxWidth }) {
  const [draft, setDraft] = useState({ title: '', url: '' })
  const [err, setErr] = useState('')
  const [openId, setOpenId] = useState(null)

  const addLink = () => {
    const url = draft.url.trim()
    if (!url) return
    onChange([...resources, { id: rid(), type: 'link', title: draft.title.trim() || url, url }])
    setDraft({ title: '', url: '' })
    setErr('')
  }
  const addImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    // Images are inlined as data URLs into the intel slice, so an oversized one
    // would bloat the doc for every visitor (and can push it at the 1 MiB cap).
    if (file.size > MAX_IMAGE_BYTES) {
      setErr(`“${file.name}” is ${Math.round(file.size / 1024)} KB — images must be under ${MAX_IMAGE_BYTES / 1024} KB. Resize it and try again.`)
      return
    }
    const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file) })
    onChange([...resources, { id: rid(), type: 'image', title: file.name, url }])
    setErr('')
  }
  const patch = (id, k, v) => onChange(resources.map((r) => (r.id === id ? { ...r, [k]: v } : r)))
  const del = (id) => onChange(resources.filter((r) => r.id !== id))

  return (
    <div className="panel panel-pad col" style={{ marginBottom: 16, maxWidth }}>
      <strong className="head" style={{ fontSize: 14 }}>Resources (handouts — e.g. a Morse-code chart)</strong>

      {resources.length === 0 && (
        <div className="mono dim" style={{ fontSize: 11 }}>None attached.</div>
      )}

      <div className="col" style={{ gap: 10 }}>
        {resources.map((r) => (
          <div key={r.id} className="col" style={{ gap: 6, borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
            <div className="row center wrap" style={{ gap: 8 }}>
              {r.type === 'image' ? (
                <img
                  src={r.url}
                  alt={r.title}
                  onClick={() => setOpenId(openId === r.id ? null : r.id)}
                  style={{
                    width: 54, height: 54, objectFit: 'cover', cursor: 'pointer', flex: '0 0 auto',
                    borderRadius: 4, border: '1px solid var(--line)', background: '#0a0f1a',
                  }}
                />
              ) : (
                <span style={{ fontSize: 20, width: 54, textAlign: 'center', flex: '0 0 auto' }}>🔗</span>
              )}
              <div className="grow col" style={{ gap: 4, minWidth: 160 }}>
                <input value={r.title || ''} onChange={(e) => patch(r.id, 'title', e.target.value)} placeholder="Title shown to cadets" />
                {r.type === 'link'
                  ? <input className="mono" style={{ fontSize: 11 }} value={r.url || ''} onChange={(e) => patch(r.id, 'url', e.target.value)} placeholder="https://…" />
                  : <span className="mono dim" style={{ fontSize: 10 }}>uploaded image · {Math.round((r.url?.length || 0) * 0.75 / 1024)} KB</span>}
              </div>
              <div className="row" style={{ gap: 6, flex: '0 0 auto' }}>
                {r.type === 'image'
                  ? <button className="ghost" style={{ padding: '2px 8px' }} onClick={() => setOpenId(openId === r.id ? null : r.id)}>{openId === r.id ? 'Hide' : 'View'}</button>
                  : <a className="btn ghost" href={r.url} target="_blank" rel="noreferrer" style={{ padding: '2px 8px', display: 'inline-block' }}>Open ↗</a>}
                <button className="danger ghost" onClick={() => del(r.id)} style={{ padding: '2px 8px' }}>Remove</button>
              </div>
            </div>
            {openId === r.id && r.type === 'image' && (
              <img src={r.url} alt={r.title} style={{ width: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--line)' }} />
            )}
          </div>
        ))}
      </div>

      {err && <div className="mono" style={{ fontSize: 11, color: 'var(--hostile)' }}>{err}</div>}

      <div className="row wrap" style={{ gap: 8, alignItems: 'flex-end' }}>
        <div className="grow" style={{ minWidth: 140 }}><Field label="Link title"><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field></div>
        <div className="grow" style={{ minWidth: 180 }}><Field label="Link URL"><input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://…" /></Field></div>
        <button className="ghost" onClick={addLink}>+ Add link</button>
        <label className="btn ghost" style={{ cursor: 'pointer', padding: '8px 12px' }}>+ Image<input type="file" accept="image/*" onChange={addImage} style={{ display: 'none' }} /></label>
      </div>
    </div>
  )
}
