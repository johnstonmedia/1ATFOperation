import { useState } from 'react'
import { Outlet, Link } from 'react-router-dom'
import TopBar from './TopBar'
import Sidebar from './Sidebar'
import LoginModal from './LoginModal'
import { useAuth } from '../context/AuthContext'

// App shell: top bar + slide-in hamburger sidebar + routed content.
export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const { emulating, user, exitEmulation } = useAuth()

  return (
    <div>
      {emulating && (
        <div className="row between center" style={{ background: 'var(--accent)', color: '#04121b', padding: '6px 16px', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700 }}>
          <span>EMULATING: {user.name} — this is a preview of what this member sees.</span>
          <button className="ghost" onClick={exitEmulation} style={{ borderColor: '#04121b', color: '#04121b', padding: '2px 10px' }}>Exit emulation</button>
        </div>
      )}
      <TopBar onMenu={() => setMenuOpen(true)} onAuth={() => setAuthOpen(true)} />
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} onAuth={() => setAuthOpen(true)} />
      <main style={{ paddingTop: 8 }}>
        <Outlet />
      </main>
      <footer className="row center" style={{ justifyContent: 'center', gap: 10, padding: '14px 20px 22px' }}>
        <span className="mono dim" style={{ fontSize: 10 }}>SHORE CADET UNIT // 1ATF</span>
        <span className="mono dim" style={{ fontSize: 10 }}>·</span>
        <Link to="/privacy" className="mono dim" style={{ fontSize: 10 }}>Privacy Notice</Link>
      </footer>
      {authOpen && <LoginModal onClose={() => setAuthOpen(false)} />}
    </div>
  )
}
