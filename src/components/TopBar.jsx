import { Link } from 'react-router-dom'
import Logo from './Logo'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'

export default function TopBar({ onMenu, onAuth }) {
  const { state } = useData()
  const { user, logout } = useAuth()
  const n = state.narrative

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 500,
        borderBottom: '1px solid var(--line)',
        background: 'linear-gradient(180deg, rgba(7,11,20,0.95), rgba(7,11,20,0.78))',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="container row center between" style={{ padding: '10px 20px' }}>
        <div className="row center" style={{ gap: 14 }}>
          <button className="ghost" onClick={onMenu} aria-label="Open menu" style={{ padding: '8px 12px' }}>
            ☰
          </button>
          <Link to="/" className="row center" style={{ gap: 14, color: 'inherit' }}>
            <Logo size={48} />
            <div className="col" style={{ gap: 2 }}>
              <div className="head" style={{ fontSize: 18, color: '#fff' }}>
                {n.shortName} <span className="dim hide-sm" style={{ fontSize: 12 }}>// {n.unitName}</span>
              </div>
              <div className="mono accent hide-sm" style={{ fontSize: 10, opacity: 0.85 }}>
                “{n.quote}”
              </div>
            </div>
          </Link>
        </div>

        <div className="row center" style={{ gap: 10 }}>
          {user ? (
            <>
              <div className="mono dim topbar-id" style={{ fontSize: 11, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <div style={{ color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.rank} {user.name}</div>
                <div>{user.company ? `${user.company}-COY` : 'UNASSIGNED'} · {user.role}</div>
              </div>
              <button className="ghost" onClick={logout}>Sign out</button>
            </>
          ) : (
            <button className="primary" onClick={onAuth}>Access</button>
          )}
        </div>
      </div>
    </header>
  )
}
