import { useParams, Navigate } from 'react-router-dom'
import { PageTitle } from './Profile'
import { useData } from '../context/DataContext'
import { COMPANIES } from '../firebase/seed'

export default function CompanyPage() {
  const { letter } = useParams()
  const { state } = useData()

  const L = (letter || '').toUpperCase()
  const meta = COMPANIES.find((c) => c.letter === L)
  if (!meta) return <Navigate to="/" replace />

  const page = state.companyPages[L] || { name: meta.name, role: '', duties: [], tasks: [] }

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
          <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2, marginBottom: 8 }}>STANDING TASKS</div>
          {(page.tasks || []).length === 0 && <div className="mono dim" style={{ fontSize: 12 }}>No standing tasks.</div>}
          <div className="col" style={{ gap: 8 }}>
            {(page.tasks || []).map((t, i) => (
              <div key={`s${i}`} className="row between center" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span>{typeof t === 'string' ? t : t.title}</span>
                <span className="tag">STANDING</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
