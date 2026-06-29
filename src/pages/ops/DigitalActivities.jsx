import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useToast } from '../../context/ToastContext'
import { useAudit } from '../../hooks/useAudit'
import { useDialog } from '../../hooks/useDialog'
import { OpsHeader } from './OperationsCentre'
import { Field } from './NarrativeEditor'
import { COMPANIES } from '../../firebase/seed'
import { parseTextToQuestions, extractText } from '../../lib/docToQuiz'

// Upload documents/PDFs -> auto-generated quiz/form. RHQ can edit, then
// Save draft / Distribute now / Schedule distribution. Distributed tasks
// appear under "Your Tasks" for the targeted audience.
export default function DigitalActivities() {
  const { state, updateSlice, makeId } = useData()
  const confirm = useConfirm()
  const { push } = useToast()
  const audit = useAudit()
  const [editing, setEditing] = useState(null) // task being built

  const tasks = state.tasks
  const saveTasks = (next) => updateSlice('tasks', next)

  const upsert = (task) => {
    const exists = tasks.some((t) => t.id === task.id)
    saveTasks(exists ? tasks.map((t) => (t.id === task.id ? task : t)) : [...tasks, task])
    push(task.distributed ? 'Activity distributed' : task.scheduledFor ? 'Activity scheduled' : 'Draft saved')
    if (task.distributed) audit('Distributed activity', `“${task.title}” → ${task.audience}-COY`)
    else if (task.scheduledFor) audit('Scheduled activity', `“${task.title}” → ${task.audience}-COY`)
  }
  const remove = async (id) => {
    const t = tasks.find((x) => x.id === id)
    const ok = await confirm({
      title: 'Delete activity',
      message: `Delete “${t?.title || 'Untitled activity'}”? This cannot be undone.`,
      danger: true,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    saveTasks(tasks.filter((x) => x.id !== id))
    push('Activity deleted')
  }

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
  const [err, setErr] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const set = (k, v) => setT((p) => ({ ...p, [k]: v }))

  // An activity can only be distributed once it actually has content.
  const ready = t.title.trim() !== '' && t.questions.length > 0
  const requireContent = () => {
    if (!t.title.trim()) { setErr('Give the activity a title before distributing.'); return false }
    if (t.questions.length === 0) { setErr('Add at least one question before distributing.'); return false }
    setErr('')
    return true
  }

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

  const saveDraft = () => onSave({ ...t, distributed: false, scheduledFor: null })
  const distributeNow = () => { if (requireContent()) onSave({ ...t, distributed: true, scheduledFor: Date.now() }) }
  const openSchedule = () => { if (requireContent()) setScheduling(true) }
  // A Cloud Function/cron flips `distributed` when the time arrives; if the
  // chosen time is already past, it distributes immediately.
  const confirmSchedule = (ts) => { setScheduling(false); onSave({ ...t, distributed: ts <= Date.now(), scheduledFor: ts }) }

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
      {err && <div className="hostile mono" style={{ fontSize: 12, marginBottom: 10 }}>{err}</div>}
      {!ready && (
        <div className="mono dim" style={{ fontSize: 11, marginBottom: 10 }}>
          Add a title and at least one question to enable distribution.
        </div>
      )}
      <div className="row wrap" style={{ gap: 10 }}>
        <button onClick={saveDraft}>Save draft</button>
        <button className="primary" onClick={distributeNow} disabled={!ready}>Distribute now</button>
        <button onClick={openSchedule} disabled={!ready}>Schedule distribution</button>
      </div>

      {scheduling && <SchedulePicker onCancel={() => setScheduling(false)} onConfirm={confirmSchedule} />}
    </div>
  )
}

// Clean in-app scheduler: a date field plus hour/minute selects (no free-text
// prompt, no raw datetime box). Shows a live preview of the chosen moment.
function SchedulePicker({ onCancel, onConfirm }) {
  const dialogRef = useDialog(onCancel)
  const pad = (n) => String(n).padStart(2, '0')
  const now = new Date()
  const [date, setDate] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`)
  const [hour, setHour] = useState(pad(now.getHours()))
  const [minute, setMinute] = useState('00')

  const ts = Date.parse(`${date}T${hour}:${minute}:00`)
  const valid = !Number.isNaN(ts)
  const past = valid && ts <= Date.now()

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 950, background: 'rgba(2,4,9,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div ref={dialogRef} className="panel panel-pad col" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Schedule distribution" style={{ width: 360, maxWidth: '100%', gap: 12 }}>
        <div className="row between center">
          <h2 className="accent" style={{ margin: 0, fontSize: 17 }}>SCHEDULE DISTRIBUTION</h2>
          <button className="ghost" onClick={onCancel} aria-label="Close" style={{ padding: '4px 10px' }}>✕</button>
        </div>

        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <div className="row" style={{ gap: 10 }}>
          <Field label="Hour">
            <select value={hour} onChange={(e) => setHour(e.target.value)}>
              {Array.from({ length: 24 }, (_, h) => pad(h)).map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </Field>
          <Field label="Minute">
            <select value={minute} onChange={(e) => setMinute(e.target.value)}>
              {Array.from({ length: 12 }, (_, m) => pad(m * 5)).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
        </div>

        <div className="mono dim" style={{ fontSize: 11 }}>
          {valid ? <>Distributes: <span className="accent">{new Date(ts).toLocaleString()}</span></> : 'Pick a valid date.'}
          {past && <span className="warn"> · time is in the past — will distribute immediately.</span>}
        </div>

        <div className="row between" style={{ marginTop: 4 }}>
          <button className="ghost" onClick={onCancel}>Cancel</button>
          <button className="primary" disabled={!valid} onClick={() => onConfirm(ts)}>Confirm schedule</button>
        </div>
      </div>
    </div>
  )
}
