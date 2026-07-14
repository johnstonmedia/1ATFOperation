import RequireAuth from '../components/RequireAuth'
import { PageTitle } from './Profile'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { PHONETIC } from '../firebase/seed'

export default function Activity() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  )
}

function Inner() {
  const { user } = useAuth()
  const { state } = useData()
  const companyName = PHONETIC[user.company]

  const movements = state.activity.filter((a) => a.company === companyName)
  const inAudience = (t) => (t.audiences || (t.audience ? [t.audience] : [])).includes(user.company)
  const myTasks = state.tasks.filter((t) => t.distributed && inAudience(t))

  return (
    <div className="container" style={{ padding: '24px 20px' }}>
      <PageTitle title="Your Activity" sub={`${companyName?.toUpperCase() || ''} COMPANY // ACTIVITY FEED`} />

      <div className="row wrap" style={{ gap: 20, alignItems: 'flex-start' }}>
        <div className="panel panel-pad grow" style={{ minWidth: 300 }}>
          <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2, marginBottom: 10 }}>
            RECENT COMPANY MOVEMENTS
          </div>
          {movements.length === 0 && <Empty text="No recorded movements." />}
          <div className="col" style={{ gap: 10 }}>
            {movements.map((m) => (
              <div key={m.id} className="row" style={{ gap: 10 }}>
                <span className="accent mono">▮</span>
                <div>
                  <div style={{ fontSize: 14 }}>{m.text}</div>
                  <div className="mono dim" style={{ fontSize: 10 }}>{new Date(m.ts).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel panel-pad grow" style={{ minWidth: 300 }}>
          <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2, marginBottom: 10 }}>
            YOUR RECENT TASKS
          </div>
          {myTasks.length === 0 && <Empty text="No tasks distributed yet." />}
          <div className="col" style={{ gap: 8 }}>
            {myTasks.map((t) => (
              <div key={t.id} className="row between center" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 14 }}>{t.title}</span>
                <span className="tag live">{t.questions?.length || 0} ITEMS</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Empty({ text }) {
  return <div className="mono dim" style={{ fontSize: 12, padding: '12px 0' }}>{text}</div>
}
