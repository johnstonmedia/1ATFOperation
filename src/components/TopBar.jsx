import { Link, useNavigate } from 'react-router-dom'
import Logo from './Logo'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import { COMPANIES } from '../firebase/seed'

export default function TopBar({ onMenu, onAuth }) {
  const { state } = useData()
  const { isRHQ, logout } = useAuth()
  const { company, setCompany } = useCompany()
  const navigate = useNavigate()
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
          <select value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Your company" style={{ width: 'auto', fontSize: 12, padding: '6px 8px' }}>
            <option value="">Company…</option>
            {COMPANIES.map((c) => <option key={c.letter} value={c.letter}>{c.name}</option>)}
          </select>
          {isRHQ ? (
            <>
              <button className="ghost hide-sm" onClick={() => navigate('/operations-centre')}>Ops Centre</button>
              <button className="ghost" onClick={logout}>Sign out</button>
            </>
          ) : (
            <button className="ghost hide-sm" onClick={onAuth}>RHQ</button>
          )}
        </div>
      </div>
    </header>
  )
}
