import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { OpsHeader } from './OperationsCentre'
import { Field } from './NarrativeEditor'
import { COMPANIES } from '../../firebase/seed'
import { parseTextToQuestions, extractText } from '../../lib/docToQuiz'

// Upload documents/PDFs -> auto-generated quiz/form. RHQ can edit, then
// Save draft / Distribute now / Schedule distribution. Distributed tasks
// appear under "Your Tasks" for the targeted audience.
export default function DigitalActivities() {
  const { state, updateSlice, makeId } = useData()
  const [editing, setEditing] = useState(null) // task being built

  const tasks = state.tasks
  const saveTasks = (next) => updateSlice('tasks', next)

  const upsert = (task) => {
    const exists = tasks.some((t) => t.id === task.id)
    saveTasks(exists ? tasks.map((t) => (t.id === task.id ? task : t)) : [...tasks, task])
  }
  const remove = (id) => saveTasks(tasks.filter((t) => t.id !== id))

  if (editing) {
    return (
      <Builder
        task={editing}
        onCancel={() => setEditing(null)}
        onSave={(t) => { upsert(t); setEditing(null) }}
      />
    )
  }

  return (
    <div>
      <OpsHeader title="Digital Activities" sub="TASKING // DOCUMENT → QUIZ">
        <button
          className="primary"
          onClick={() => setEditing({ id: makeId(), title: '', brief: '', audience: 'A', questions: [], distributed: false, scheduledFor: null })}
        >
          + New activity
        </button>
      </OpsHeader>

      {tasks.length === 0 && (
        <div className="panel panel-pad mono dim" style={{ fontSize: 13 }}>
          No activities yet. Create one and upload a document to auto-build a quiz.
        </div>
      )}

      <div className="col" style={{ gap: 12 }}>
        {tasks.map((t) => (
          <div key={t.id} className="panel panel-pad row between center wrap" style={{ gap: 12 }}>
            <div>
              <div className="head" style={{ fontSize: 15 }}>{t.title || 'Untitled activity'}</div>
              <div className="mono dim" style={{ fontSize: 11 }}>
                {t.questions.length} items · {t.audience}-COY
                {' · '}
                {t.distributed
                  ? <span className="accent">DISTRIBUTED</span>
                  : t.scheduledFor
                    ? <span className="warn">SCHEDULED {new Date(t.scheduledFor).toLocaleString()}</span>
                    : <span>DRAFT</span>}
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="ghost" onClick={() => setEditing(t)}>Edit</button>
              <button className="danger ghost" onClick={() => remove(t.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Builder({ task, onCancel, onSave }) {
  const [t, setT] = useState(task)
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setT((p) => ({ ...p, [k]: v }))

  const onUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const text = await extractText(file)
      const qs = parseTextToQuestions(text)
      set('questions', [...t.questions, ...qs])
      if (!t.title) set('title', file.name.replace(/\.[^.]+$/, ''))
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  const setQ = (i, patch) => set('questions', t.questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)))
  const addQ = () => set('questions', [...t.questions, { type: 'mc', prompt: '', options: ['', ''], answer: 0 }])
  const delQ = (i) => set('questions', t.questions.filter((_, idx) => idx !== i))

  const finalise = (mode) => {
    let out = { ...t }
    if (mode === 'draft') out = { ...out, distributed: false, scheduledFor: null }
    if (mode === 'now') out = { ...out, distributed: true, scheduledFor: Date.now() }
    if (mode === 'schedule') {
      const when = prompt('Distribute at (YYYY-MM-DD HH:MM):')
      const ts = when ? Date.parse(when.replace(' ', 'T')) : NaN
      if (Number.isNaN(ts)) return
      // For preview we mark scheduled; a Cloud Function/cron flips `distributed`
      // when the time arrives. In local mode it distributes if already due.
      out = { ...out, distributed: ts <= Date.now(), scheduledFor: ts }
    }
    onSave(out)
  }

  return (
    <div>
      <OpsHeader title="Build Activity" sub="DIGITAL ACTIVITY // EDITOR">
        <button className="ghost" onClick={onCancel}>← Back</button>
      </OpsHeader>

      <div className="panel panel-pad col" style={{ marginBottom: 16 }}>
        <Field label="Title"><input value={t.title} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Brief / instructions"><textarea rows={2} value={t.brief} onChange={(e) => set('brief', e.target.value)} /></Field>
        <Field label="Audience">
          <select value={t.audience} onChange={(e) => set('audience', e.target.value)}>
            {COMPANIES.map((c) => <option key={c.letter} value={c.letter}>{c.name} ({c.letter})</option>)}
          </select>
        </Field>
        <Field label="Upload document / PDF (auto-builds questions)">
          <input type="file" accept=".txt,.md,.csv,.pdf,.docx" onChange={onUpload} />
        </Field>
        {busy && <div className="mono accent" style={{ fontSize: 11 }}>Parsing document…</div>}
        <div className="mono dim" style={{ fontSize: 10 }}>
          Tip: lines ending in “?” become questions; “A)/B)” lines become options; prefix the correct option with “*”; “Q:” makes a short-answer item.
        </div>
      </div>

      <div className="col" style={{ gap: 12 }}>
        {t.questions.map((q, i) => (
          <div key={i} className="panel panel-pad col">
            <div className="row between center">
              <span className="mono accent">ITEM {String(i + 1).padStart(2, '0')}</span>
              <div className="row" style={{ gap: 8 }}>
                <select value={q.type} onChange={(e) => setQ(i, { type: e.target.value })} style={{ width: 150 }}>
                  <option value="mc">Multiple choice</option>
                  <option value="short">Short answer</option>
                </select>
                <button className="danger ghost" onClick={() => delQ(i)}>✕</button>
              </div>
            </div>
            <input value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} placeholder="Question prompt" />
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
          </div>
        ))}
        <button className="ghost" onClick={addQ}>+ Add question manually</button>
      </div>

      <div className="divider" />
      <div className="row wrap" style={{ gap: 10 }}>
        <button onClick={() => finalise('draft')}>Save draft</button>
        <button className="primary" onClick={() => finalise('now')}>Distribute now</button>
        <button onClick={() => finalise('schedule')}>Schedule distribution</button>
      </div>
    </div>
  )
}
