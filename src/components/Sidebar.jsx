import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PHONETIC } from '../firebase/seed'
import SupportModal from './SupportModal'

// Left-hand hamburger menu. Profile / Activity / Tasks / Company tabs require a
// signed-in account; the user's company tab is derived from their profile.
export default function Sidebar({ open, onClose, onAuth }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [support, setSupport] = useState(false)

  const go = (path) => {
    onClose()
    navigate(path)
  }

  const needAuth = (path) => {
    onClose()
    if (user) navigate(path)
    else onAuth()
  }

  const companyName = user?.company ? PHONETIC[user.company] : null

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
          <button className="ghost" onClick={onClose} style={{ padding: '4px 10px' }}>✕</button>
        </div>

        <MenuItem label="Command Map" sub="Public overview" onClick={() => go('/')} />

        <div className="divider" />
        <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2, margin: '4px 0' }}>
          PERSONNEL {user ? '' : '· LOGIN REQUIRED'}
        </div>

        <MenuItem label="Profile" sub="Rank · company · details" locked={!user} onClick={() => needAuth('/profile')} />
        <MenuItem label="Your Activity" sub="Recent company movements" locked={!user} onClick={() => needAuth('/activity')} />
        <MenuItem label="Your Tasks" sub="Tasks distributed by RHQ" locked={!user} onClick={() => needAuth('/tasks')} />

        {user && companyName && (
          <MenuItem
            label={`${companyName} Company`}
            sub={`${user.company}-COY tasks & role`}
            onClick={() => go(`/company/${user.company}`)}
          />
        )}

        <div className="grow" />
        {!user && (
          <button className="primary" onClick={() => { onClose(); onAuth() }}>Access Portal</button>
        )}
        <button className="ghost" onClick={() => setSupport(true)}>Help &amp; Support</button>
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
