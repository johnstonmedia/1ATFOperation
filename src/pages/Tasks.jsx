import { useState } from 'react'
import RequireAuth from '../components/RequireAuth'
import { PageTitle } from './Profile'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import DocEmbed from '../components/DocEmbed'

const audiencesOf = (t) => t.audiences || (t.audience ? [t.audience] : [])
const forCompany = (t, company) => audiencesOf(t).includes(company)
const cipherWords = (q) => String(q.answer || '').trim().split(/\s+/).filter(Boolean)
const norm = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/gi, '')

export default function Tasks() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  )
}

function Inner() {
  const { user } = useAuth()
  const { state } = useData()
  const [open, setOpen] = useState(null)

  const tasks = state.tasks.filter((t) => t.distributed && forCompany(t, user.company))

  if (open) return <TaskRunner task={open} onBack={() => setOpen(null)} />

  return (
    <div className="container" style={{ padding: '24px 20px' }}>
      <PageTitle title="Your Tasks" sub="DISTRIBUTED BY RHQ // DIGITAL ACTIVITIES" />
      {tasks.length === 0 && (
        <div className="panel panel-pad mono dim" style={{ fontSize: 13 }}>
          No tasks have been distributed to you yet. RHQ will issue activities here.
        </div>
      )}
      <div className="col" style={{ gap: 12 }}>
        {tasks.map((t) => (
          <div key={t.id} className="panel panel-pad row between center wrap" style={{ gap: 12 }}>
            <div>
              <div className="head" style={{ fontSize: 15 }}>{t.title}</div>
              <div className="mono dim" style={{ fontSize: 11 }}>
                {t.questions?.length || 0} items
                {t.scheduledFor ? ` · issued ${new Date(t.scheduledFor).toLocaleDateString()}` : ''}
              </div>
            </div>
            <button className="primary" onClick={() => setOpen(t)}>Begin</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function TaskRunner({ task, onBack }) {
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const questions = task.questions || []
  const resources = task.resources || []
  const hasCipher = questions.some((q) => q.type === 'cipher')

  // Scoring: multiple-choice answers + each correctly deciphered word.
  let score = 0
  let gradable = 0
  questions.forEach((q, i) => {
    if (q.type === 'mc' && q.answer != null) {
      gradable += 1
      if (answers[i] === q.answer) score += 1
    } else if (q.type === 'cipher') {
      const words = cipherWords(q)
      gradable += words.length
      words.forEach((w, wi) => { if (norm((answers[i] || [])[wi]) === norm(w)) score += 1 })
    }
  })

  const setCipherWord = (i, wi, val) => {
    const arr = [...(answers[i] || [])]
    arr[wi] = val
    setAnswers({ ...answers, [i]: arr })
  }

  return (
    <div className="container" style={{ padding: '24px 20px', maxWidth: 1040 }}>
      <button className="ghost" onClick={onBack} style={{ marginBottom: 14 }}>← All tasks</button>
      <div className="row wrap" style={{ gap: 18, alignItems: 'flex-start' }}>
        <div className="panel panel-pad grow" style={{ minWidth: 320 }}>
          <h1 style={{ marginTop: 0, fontSize: 22 }}>{task.title}</h1>
          {task.brief && <p className="dim">{task.brief}</p>}
          {task.docUrl && <div style={{ margin: '12px 0' }}><DocEmbed url={task.docUrl} /></div>}
          {task.content && (
            <div className="mono" style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, background: 'rgba(0,0,0,0.25)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 12, margin: '10px 0' }}>
              {task.content}
            </div>
          )}
          <div className="divider" />
          <div className="col" style={{ gap: 22 }}>
            {questions.map((q, i) => (
              <div key={i}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="accent mono">{String(i + 1).padStart(2, '0')}</span>
                  <strong style={{ fontSize: 15 }}>{q.prompt}</strong>
                </div>
                <div className="col" style={{ gap: 6, marginTop: 8, paddingLeft: 26 }}>
                  {q.type === 'mc' && q.options.map((opt, oi) => {
                    const chosen = answers[i] === oi
                    const correct = submitted && q.answer === oi
                    const wrong = submitted && chosen && q.answer !== oi
                    return (
                      <button key={oi} className="ghost" onClick={() => !submitted && setAnswers({ ...answers, [i]: oi })}
                        style={{ textAlign: 'left', textTransform: 'none', letterSpacing: 0, borderColor: correct ? 'var(--accent)' : wrong ? 'var(--hostile)' : chosen ? 'var(--accent)' : 'var(--line)' }}>
                        {opt} {correct ? '✓' : wrong ? '✗' : ''}
                      </button>
                    )
                  })}
                  {q.type === 'short' && (
                    <textarea rows={3} value={answers[i] || ''} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} placeholder="Your response…" />
                  )}
                  {q.type === 'cipher' && (
                    <div className="row wrap" style={{ gap: 8 }}>
                      {cipherWords(q).map((w, wi) => {
                        const val = (answers[i] || [])[wi] || ''
                        const ok = submitted && norm(val) === norm(w)
                        const bad = submitted && !ok
                        return (
                          <input key={wi} value={val} onChange={(e) => !submitted && setCipherWord(i, wi, e.target.value)}
                            className="mono" style={{ width: `${Math.max(w.length + 2, 5)}ch`, borderColor: ok ? 'var(--accent)' : bad ? 'var(--hostile)' : 'var(--line)' }}
                            placeholder={'•'.repeat(w.length)} />
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="divider" />
          {submitted ? (
            <div className="row between center">
              <span className="accent head">{hasCipher ? 'INTEL RECEIVED' : 'SUBMITTED'}</span>
              {gradable > 0 && <span className="mono">SCORE: {score}/{gradable}</span>}
            </div>
          ) : (
            <button className="primary" onClick={() => setSubmitted(true)}>{hasCipher ? 'Enter intel' : 'Submit responses'}</button>
          )}
        </div>

        {resources.length > 0 && (
          <div className="panel panel-pad" style={{ width: 280, maxWidth: '100%' }}>
            <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2, marginBottom: 10 }}>RESOURCES</div>
            <div className="col" style={{ gap: 12 }}>
              {resources.map((r) => (
                <div key={r.id}>
                  {r.type === 'image'
                    ? <><img src={r.url} alt={r.title} style={{ width: '100%', borderRadius: 4, border: '1px solid var(--line)' }} /><div className="mono dim" style={{ fontSize: 10, marginTop: 4 }}>{r.title}</div></>
                    : <a href={r.url} target="_blank" rel="noreferrer" className="accent mono" style={{ fontSize: 12 }}>🔗 {r.title}</a>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
