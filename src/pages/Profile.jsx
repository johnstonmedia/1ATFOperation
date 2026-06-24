import RequireAuth from '../components/RequireAuth'
import { useAuth } from '../context/AuthContext'
import { PHONETIC } from '../firebase/seed'

export default function Profile() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  )
}

function Inner() {
  const { user } = useAuth()
  const company = user.company ? PHONETIC[user.company] : 'Unassigned'

  const fields = [
    ['Name', user.name],
    ['Rank', user.rank],
    ['Company', `${company}${user.company ? ` (${user.company})` : ''}`],
    ['Role', user.role],
    ['Service / ID', user.idNumber || '—'],
    ['Email', user.email],
    ['Roster link', user.linked ? 'CONFIRMED' : 'PENDING — contact RHQ'],
  ]

  return (
    <div className="container" style={{ padding: '24px 20px' }}>
      <PageTitle title="Personnel File" sub="CLASSIFICATION // RESTRICTED" />
      <div className="panel panel-pad" style={{ maxWidth: 560 }}>
        <div className="row center" style={{ gap: 16, marginBottom: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 6,
            background: 'linear-gradient(135deg, var(--primary), #0a1226)',
            border: '1px solid var(--accent)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontFamily: 'Orbitron', fontSize: 26, color: 'var(--accent)',
          }}>
            {(user.name || '?').split(' ').map((s) => s[0]).slice(-2).join('')}
          </div>
          <div>
            <div className="head" style={{ fontSize: 18, color: '#fff' }}>{user.name}</div>
            <div className="mono accent" style={{ fontSize: 12 }}>{user.rank} · {company} Company</div>
          </div>
        </div>
        <div className="divider" />
        <div className="col" style={{ gap: 0 }}>
          {fields.map(([k, v]) => (
            <div key={k} className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <span className="mono dim" style={{ fontSize: 11, letterSpacing: 1 }}>{k.toUpperCase()}</span>
              <span className="mono" style={{ fontSize: 13 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function PageTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="mono dim" style={{ fontSize: 10, letterSpacing: 3 }}>{sub}</div>
      <h1 style={{ margin: '4px 0 0', fontSize: 26, color: '#fff' }}>{title}</h1>
    </div>
  )
}
