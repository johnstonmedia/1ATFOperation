import { useParams, Navigate } from 'react-router-dom'
import RequireAuth from '../components/RequireAuth'
import { PageTitle } from './Profile'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { COMPANIES } from '../firebase/seed'

export default function CompanyPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  )
}

function Inner() {
  const { letter } = useParams()
  const { user } = useAuth()
  const { state } = useData()

  const L = (letter || '').toUpperCase()
  const meta = COMPANIES.find((c) => c.letter === L)

  // A user may only view their own company's page.
  if (!meta) return <Navigate to="/" replace />
  if (user.company !== L) {
    return (
      <div className="container" style={{ padding: 40 }}>
        <div className="panel panel-pad col center" style={{ gap: 10, padding: 36 }}>
          <div className="head hostile">NOT YOUR COMPANY</div>
          <p className="mono dim" style={{ fontSize: 12 }}>
            You are cleared for {user.company ? `${user.company}-COY` : 'no company'} only.
          </p>
        </div>
      </div>
    )
  }

  const page = state.companyPages[L] || { name: meta.name, role: '', duties: [], tasks: [] }
  const tasks = state.tasks.filter((t) => t.distributed && (t.audience === 'all' || t.audience === L))

  return (
    <div className="container" style={{ padding: '24px 20px' }}>
      <PageTitle title={`${meta.name} Company`} sub={`${L}-COY // OPERATIONAL TASKING`} />

      <div className="row wrap" style={{ gap: 20, alignItems: 'flex-start' }}>
        <div className="panel panel-pad grow" style={{ minWidth: 300, borderColor: meta.accent }}>
          <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2 }}>ROLE IN THE OPERATION</div>
          <p style={{ lineHeight: 1.5 }}>{page.role || 'Awaiting tasking from RHQ.'}</p>
          <div className="divider" />
          <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2, marginBottom: 8 }}>STANDING DUTIES</div>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            {(page.duties || []).map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </div>

        <div className="panel panel-pad grow" style={{ minWidth: 300 }}>
          <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2, marginBottom: 8 }}>COMPANY TASKS</div>
          {(page.tasks || []).length === 0 && tasks.length === 0 && (
            <div className="mono dim" style={{ fontSize: 12 }}>No active tasks.</div>
          )}
          <div className="col" style={{ gap: 8 }}>
            {(page.tasks || []).map((t, i) => (
              <div key={`s${i}`} className="row between center" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span>{typeof t === 'string' ? t : t.title}</span>
                <span className="tag">STANDING</span>
              </div>
            ))}
            {tasks.map((t) => (
              <div key={t.id} className="row between center" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span>{t.title}</span>
                <span className="tag live">DISTRIBUTED</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
