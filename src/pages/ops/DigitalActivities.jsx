import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useToast } from '../../context/ToastContext'
import { useAudit } from '../../hooks/useAudit'
import SchedulePicker from '../../components/SchedulePicker'
import { OpsHeader } from './OperationsCentre'
import { Field } from './NarrativeEditor'
import { COMPANIES } from '../../firebase/seed'
import { interpretDocument } from '../../lib/docToQuiz'

const rid = () => Math.random().toString(36).slice(2, 10)
// Audience is a list of company letters; tolerate the old single `audience`.
const audiencesOf = (t) => t.audiences || (t.audience ? [t.audience] : [])
const audienceLabel = (t) => {
  const a = audiencesOf(t)
  return a.length ? a.join(' / ') + '-COY' : 'no audience'
}

// Upload documents/PDFs -> auto-generated quiz/form, kept alongside the original
// text and any attached resources. Distributed activities remain here so RHQ can
// edit and re-distribute (to the same or different companies).
export default function DigitalActivities() {
  const { state, updateSlice, makeId } = useData()
  const confirm = useConfirm()
  const { push } = useToast()
  const audit = useAudit()
  const [editing, setEditing] = useState(null)

  const tasks = state.tasks
  const saveTasks = (next) => updateSlice('tasks', next)

  const upsert = (task) => {
    const exists = tasks.some((t) => t.id === task.id)
    saveTasks(exists ? tasks.map((t) => (t.id === task.id ? task : t)) : [...tasks, task])
    push(task.distributed ? 'Activity distributed' : task.scheduledFor ? 'Activity scheduled' : 'Draft saved')
    if (task.distributed) audit('Distributed activity', `“${task.title}” → ${audienceLabel(task)}`)
    else if (task.scheduledFor) audit('Scheduled activity', `“${task.title}” → ${audienceLabel(task)}`)
  }
  const remove = async (id) => {
    const t = tasks.find((x) => x.id === id)
    const ok = await confirm({ title: 'Delete activity', message: `Delete “${t?.title || 'Untitled activity'}”? This cannot be undone.`, danger: true, confirmLabel: 'Delete' })
    if (!ok) return
    saveTasks(tasks.filter((x) => x.id !== id))
    push('Activity deleted')
  }

  const blank = () => ({ id: makeId(), title: '', brief: '', audiences: ['A'], content: '', resources: [], questions: [], distributed: false, scheduledFor: null })

  if (editing) {
    return <Builder task={editing} onCancel={() => setEditing(null)} onSave={(t) => { upsert(t); setEditing(null) }} />
  }

  return (
    <div>
      <OpsHeader title="Activities" sub="TASKING // DIGITAL ACTIVITIES">
        <button className="primary" onClick={() => setEditing(blank())}>+ New activity</button>
      </OpsHeader>

      <div className="mono dim" style={{ fontSize: 11, marginBottom: 14 }}>
        Distributed activities stay here — open one to edit it, then distribute again to the same or different companies.
      </div>

      {tasks.length === 0 && (
        <div className="panel panel-pad mono dim" style={{ fontSize: 13 }}>No activities yet. Create one and upload a document, or build it by hand.</div>
      )}

      <div className="col" style={{ gap: 12 }}>
        {tasks.map((t) => (
          <div key={t.id} className="panel panel-pad row between center wrap" style={{ gap: 12 }}>
            <div>
              <div className="head" style={{ fontSize: 15 }}>{t.title || 'Untitled activity'}</div>
              <div className="mono dim" style={{ fontSize: 11 }}>
                {(t.questions?.length || 0)} items · {audienceLabel(t)}
                {' · '}
                {t.distributed
                  ? <span className="accent">DISTRIBUTED</span>
                  : t.scheduledFor
                    ? <span className="warn">SCHEDULED {new Date(t.scheduledFor).toLocaleString()}</span>
                    : <span>DRAFT</span>}
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="ghost" onClick={() => setEditing(t)}>{t.distributed ? 'Edit / re-distribute' : 'Edit'}</button>
              <button className="danger ghost" onClick={() => remove(t.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Builder({ task, onCancel, onSave }) {
  const [t, setT] = useState({ ...task, audiences: audiencesOf(task), content: task.content || '', resources: task.resources || [] })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const set = (k, v) => setT((p) => ({ ...p, [k]: v }))

  const hasContent = t.questions.length > 0 || t.content.trim() !== ''
  const ready = t.title.trim() !== '' && hasContent && t.audiences.length > 0
  const requireReady = () => {
    if (!t.title.trim()) { setErr('Give the activity a title before distributing.'); return false }
    if (!hasContent) { setErr('Add at least one question or some document content first.'); return false }
    if (!t.audiences.length) { setErr('Choose at least one company to distribute to.'); return false }
    setErr('')
    return true
  }

  const toggleAudience = (letter) =>
    set('audiences', t.audiences.includes(letter) ? t.audiences.filter((x) => x !== letter) : [...t.audiences, letter])

  const onUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const { content, questions } = await interpretDocument(file)
      // Keep the document's text so briefings/descriptions aren't lost.
      set('content', [t.content, content].filter((s) => s && s.trim()).join('\n\n'))
      set('questions', [...t.questions, ...questions])
      if (!t.title) set('title', file.name.replace(/\.[^.]+$/, ''))
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  // Resources shown on the side of the activity (e.g. a Morse-code chart).
  const [resDraft, setResDraft] = useState({ title: '', url: '' })
  const addLink = () => {
    if (!resDraft.url.trim()) return
    set('resources', [...t.resources, { id: rid(), type: 'link', title: resDraft.title.trim() || resDraft.url.trim(), url: resDraft.url.trim() }])
    setResDraft({ title: '', url: '' })
  }
  const addImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 150 * 1024) { setErr('Resource image too large (max 150 KB). Link to it by URL instead.'); e.target.value = ''; return }
    const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file) })
    set('resources', [...t.resources, { id: rid(), type: 'image', title: file.name, url }])
    e.target.value = ''
  }
  const delResource = (id) => set('resources', t.resources.filter((r) => r.id !== id))

  const setQ = (i, patch) => set('questions', t.questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)))
  const addQ = (type) => set('questions', [...t.questions, type === 'cipher' ? { type: 'cipher', prompt: '', answer: '' } : { type: 'mc', prompt: '', options: ['', ''], answer: 0 }])
  const delQ = (i) => set('questions', t.questions.filter((_, idx) => idx !== i))

  const saveDraft = () => onSave({ ...t, distributed: false, scheduledFor: null })
  const distributeNow = () => { if (requireReady()) onSave({ ...t, distributed: true, scheduledFor: Date.now() }) }
  const openSchedule = () => { if (requireReady()) setScheduling(true) }
  const confirmSchedule = (ts) => { setScheduling(false); onSave({ ...t, distributed: ts <= Date.now(), scheduledFor: ts }) }

  return (
    <div>
      <OpsHeader title="Build Activity" sub="DIGITAL ACTIVITY // EDITOR">
        <button className="ghost" onClick={onCancel}>← Back</button>
      </OpsHeader>

      <div className="panel panel-pad col" style={{ marginBottom: 16 }}>
        <Field label="Title"><input value={t.title} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Brief / instructions"><textarea rows={2} value={t.brief} onChange={(e) => set('brief', e.target.value)} /></Field>
        <Field label="Distribute to (one or more companies)">
          <div className="row wrap" style={{ gap: 6 }}>
            {COMPANIES.map((c) => (
              <button key={c.letter} type="button" className={t.audiences.includes(c.letter) ? 'primary' : 'ghost'} onClick={() => toggleAudience(c.letter)} style={{ padding: '4px 10px', fontSize: 12 }}>
                {c.name} ({c.letter})
              </button>
            ))}
          </div>
        </Field>
        <Field label="Upload document / PDF (keeps the text and auto-builds questions)">
          <input type="file" accept=".txt,.md,.csv,.pdf,.docx" onChange={onUpload} />
        </Field>
        {busy && <div className="mono accent" style={{ fontSize: 11 }}>Reading document…</div>}
        <div className="mono dim" style={{ fontSize: 10 }}>
          Tip: lines ending in “?” become questions; “A)/B)” lines become options; “*” marks the correct option; “Q:” makes a short-answer item. Everything else is kept as reference text.
        </div>
      </div>

      <Field label="Document content shown to members (kept from the upload — editable)">
        <textarea rows={5} value={t.content} onChange={(e) => set('content', e.target.value)} placeholder="Any briefing text, instructions or intel to keep alongside the questions…" />
      </Field>

      {/* Resources / attachments */}
      <div className="panel panel-pad col" style={{ margin: '16px 0' }}>
        <strong className="head" style={{ fontSize: 14 }}>Resources (shown on the side)</strong>
        <div className="mono dim" style={{ fontSize: 10 }}>e.g. a Morse-code alphabet to help decipher a message. Attach a small image (≤150 KB) or link to one.</div>
        <div className="col" style={{ gap: 6 }}>
          {t.resources.map((r) => (
            <div key={r.id} className="row between center" style={{ gap: 8, borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
              <span className="mono" style={{ fontSize: 12 }}>{r.type === 'image' ? '🖼' : '🔗'} {r.title}</span>
              <button className="danger ghost" onClick={() => delResource(r.id)} style={{ padding: '2px 8px' }}>Remove</button>
            </div>
          ))}
        </div>
        <div className="row wrap" style={{ gap: 8, alignItems: 'flex-end' }}>
          <div className="grow" style={{ minWidth: 140 }}><Field label="Link title"><input value={resDraft.title} onChange={(e) => setResDraft({ ...resDraft, title: e.target.value })} /></Field></div>
          <div className="grow" style={{ minWidth: 180 }}><Field label="Link URL"><input value={resDraft.url} onChange={(e) => setResDraft({ ...resDraft, url: e.target.value })} placeholder="https://…" /></Field></div>
          <button className="ghost" onClick={addLink}>+ Add link</button>
          <label className="btn ghost" style={{ cursor: 'pointer', padding: '8px 12px' }}>
            + Image
            <input type="file" accept="image/*" onChange={addImage} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Questions */}
      <div className="col" style={{ gap: 12 }}>
        {t.questions.map((q, i) => (
          <div key={i} className="panel panel-pad col">
            <div className="row between center">
              <span className="mono accent">ITEM {String(i + 1).padStart(2, '0')}</span>
              <div className="row" style={{ gap: 8 }}>
                <select value={q.type} onChange={(e) => setQ(i, { type: e.target.value })} style={{ width: 160 }}>
                  <option value="mc">Multiple choice</option>
                  <option value="short">Short answer</option>
                  <option value="cipher">Decipher (intel)</option>
                </select>
                <button className="danger ghost" onClick={() => delQ(i)}>✕</button>
              </div>
            </div>
            <input value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} placeholder={q.type === 'cipher' ? 'Instructions / the coded message' : 'Question prompt'} />
            {q.type === 'mc' && (
              <div className="col" style={{ gap: 6 }}>
                {(q.options || []).map((opt, oi) => (
                  <div key={oi} className="row center" style={{ gap: 8 }}>
                    <input type="radio" name={`ans-${i}`} checked={q.answer === oi} onChange={() => setQ(i, { answer: oi })} style={{ width: 'auto' }} />
                    <input value={opt} onChange={(e) => setQ(i, { options: q.options.map((o, idx) => idx === oi ? e.target.value : o) })} placeholder={`Option ${oi + 1}`} />
                    <button className="ghost" onClick={() => setQ(i, { options: q.options.filter((_, idx) => idx !== oi) })}>−</button>
                  </div>
                ))}
                <button className="ghost" onClick={() => setQ(i, { options: [...(q.options || []), ''] })} style={{ alignSelf: 'flex-start' }}>+ Option</button>
              </div>
            )}
            {q.type === 'cipher' && (
              <Field label="Solution (the decoded words — members get one box per word)">
                <input className="mono" value={q.answer || ''} onChange={(e) => setQ(i, { answer: e.target.value })} placeholder="e.g. ADVANCE ON RED CENTRE" />
              </Field>
            )}
          </div>
        ))}
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="ghost" onClick={() => addQ('mc')}>+ Question</button>
          <button className="ghost" onClick={() => addQ('cipher')}>+ Decipher item</button>
        </div>
      </div>

      <div className="divider" />
      {err && <div className="hostile mono" style={{ fontSize: 12, marginBottom: 10 }}>{err}</div>}
      {!ready && <div className="mono dim" style={{ fontSize: 11, marginBottom: 10 }}>Needs a title, at least one company, and a question or document content to distribute.</div>}
      <div className="row wrap" style={{ gap: 10 }}>
        <button onClick={saveDraft}>Save draft</button>
        <button className="primary" onClick={distributeNow} disabled={!ready}>{task.distributed ? 'Re-distribute now' : 'Distribute now'}</button>
        <button onClick={openSchedule} disabled={!ready}>Schedule distribution</button>
      </div>

      {scheduling && <SchedulePicker title="SCHEDULE DISTRIBUTION" verb="distribute" onCancel={() => setScheduling(false)} onConfirm={confirmSchedule} />}
    </div>
  )
}
