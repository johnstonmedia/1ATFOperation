import { useState } from 'react'
import RequireAuth from '../components/RequireAuth'
import { PageTitle } from './Profile'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

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

  // Only tasks RHQ has DISTRIBUTED appear here, filtered to the user's audience.
  const tasks = state.tasks.filter(
    (t) => t.distributed && (t.audience === 'all' || t.audience === user.company),
  )

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
                {t.questions?.length || 0} items · audience: {t.audience === 'all' ? 'ALL UNITS' : `${t.audience}-COY`}
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

// Renders a distributed document as an interactive quiz/form.
function TaskRunner({ task, onBack }) {
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)

  const score = task.questions?.reduce((s, q, i) => {
    if (q.type === 'mc' && q.answer != null) return s + (answers[i] === q.answer ? 1 : 0)
    return s
  }, 0)
  const gradable = task.questions?.filter((q) => q.type === 'mc' && q.answer != null).length || 0

  return (
    <div className="container" style={{ padding: '24px 20px', maxWidth: 760 }}>
      <button className="ghost" onClick={onBack} style={{ marginBottom: 14 }}>← All tasks</button>
      <div className="panel panel-pad">
        <h1 style={{ marginTop: 0, fontSize: 22 }}>{task.title}</h1>
        {task.brief && <p className="dim">{task.brief}</p>}
        <div className="divider" />
        <div className="col" style={{ gap: 22 }}>
          {task.questions?.map((q, i) => (
            <div key={i}>
              <div className="row" style={{ gap: 8 }}>
                <span className="accent mono">{String(i + 1).padStart(2, '0')}</span>
                <strong style={{ fontSize: 15 }}>{q.prompt}</strong>
              </div>
              <div className="col" style={{ gap: 6, marginTop: 8, paddingLeft: 26 }}>
                {q.type === 'mc' ? (
                  q.options.map((opt, oi) => {
                    const chosen = answers[i] === oi
                    const correct = submitted && q.answer === oi
                    const wrong = submitted && chosen && q.answer !== oi
                    return (
                      <button
                        key={oi}
                        className="ghost"
                        onClick={() => !submitted && setAnswers({ ...answers, [i]: oi })}
                        style={{
                          textAlign: 'left', textTransform: 'none', letterSpacing: 0,
                          borderColor: correct ? 'var(--accent)' : wrong ? 'var(--hostile)' : chosen ? 'var(--accent-2)' : 'var(--line)',
                        }}
                      >
                        {opt} {correct ? '✓' : wrong ? '✗' : ''}
                      </button>
                    )
                  })
                ) : (
                  <textarea
                    rows={3}
                    value={answers[i] || ''}
                    onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                    placeholder="Your response…"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="divider" />
        {submitted ? (
          <div className="row between center">
            <span className="accent head">SUBMITTED</span>
            {gradable > 0 && <span className="mono">SCORE: {score}/{gradable}</span>}
          </div>
        ) : (
          <button className="primary" onClick={() => setSubmitted(true)}>Submit responses</button>
        )}
      </div>
    </div>
  )
}
