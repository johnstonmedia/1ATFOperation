import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import { COMPANIES, PHONETIC } from '../firebase/seed'
import SupportModal from './SupportModal'

// Left-hand hamburger menu. No member login — cadets pick their company and
// read that company's intel / page. RHQ can still sign in for the ops centre.
export default function Sidebar({ open, onClose, onAuth }) {
  const { isRHQ } = useAuth()
  const { company, setCompany } = useCompany()
  const navigate = useNavigate()
  const [support, setSupport] = useState(false)

  // Close the drawer on Escape while it is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const go = (path) => {
    onClose()
    navigate(path)
  }

  const companyName = company ? PHONETIC[company] : null

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 600,
          background: 'rgba(0,0,0,0.55)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.2s',
        }}
      />
      <nav
        aria-label="Main navigation"
        aria-hidden={!open}
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 700,
          width: 300, maxWidth: '85vw',
          background: 'var(--panel-solid)',
          borderRight: '1px solid var(--accent)',
          boxShadow: '0 0 40px rgba(54,224,192,0.15)',
          transform: open ? 'translateX(0)' : 'translateX(-105%)',
          transition: 'transform 0.25s cubic-bezier(.2,.8,.2,1)',
          padding: 18,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}
      >
        <div className="row between center" style={{ marginBottom: 8 }}>
          <span className="head accent" style={{ fontSize: 14 }}>NAVIGATION</span>
          <button className="ghost" onClick={onClose} aria-label="Close menu" style={{ padding: '4px 10px' }}>✕</button>
        </div>

        <MenuItem label="Command Map" sub="Operational overview" onClick={() => go('/')} />
        <MenuItem label="Intel" sub="Decrypt your company's fragments" onClick={() => go('/intel')} />

        <div className="divider" />
        <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2, margin: '4px 0' }}>YOUR COMPANY</div>
        <select value={company} onChange={(e) => setCompany(e.target.value)} style={{ marginBottom: 6 }}>
          <option value="">— Select your company —</option>
          {COMPANIES.map((c) => <option key={c.letter} value={c.letter}>{c.name}</option>)}
        </select>
        {companyName && (
          <MenuItem label={`${companyName} Company`} sub="Your company page" onClick={() => go(`/company/${company}`)} />
        )}

        <div className="grow" />
        <button className="ghost" onClick={() => setSupport(true)}>Help &amp; Support</button>
        {isRHQ
          ? <button className="ghost" onClick={() => go('/operations-centre')}>Operations Centre</button>
          : <button className="ghost" onClick={() => { onClose(); onAuth() }} style={{ fontSize: 11 }}>RHQ sign in</button>}
        <Link to="/" onClick={onClose} className="mono dim" style={{ fontSize: 10, marginTop: 10 }}>
          LUCET PER MINISTERIUM
        </Link>
      </nav>
      {support && <SupportModal onClose={() => setSupport(false)} />}
    </>
  )
}

function MenuItem({ label, sub, onClick, locked }) {
  return (
    <button
      className="ghost"
      onClick={onClick}
      style={{
        textAlign: 'left', padding: '12px 12px', width: '100%',
        display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start',
        textTransform: 'none', letterSpacing: 0,
      }}
    >
      <span className="head" style={{ fontSize: 13, letterSpacing: 1 }}>
        {label} {locked && <span className="dim" style={{ fontSize: 10 }}>🔒</span>}
      </span>
      {sub && <span className="mono dim" style={{ fontSize: 10 }}>{sub}</span>}
    </button>
  )
}
