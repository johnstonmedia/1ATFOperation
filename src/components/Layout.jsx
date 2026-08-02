import { useState } from 'react'
import { Outlet, Link } from 'react-router-dom'
import TopBar from './TopBar'
import Sidebar, { NavContent } from './Sidebar'
import Logo from './Logo'
import LoginModal from './LoginModal'
import { useAuth } from '../context/AuthContext'

// App shell. Navigation is responsive: desktop/tablet (≥768px) gets a
// permanently pinned left rail; phones get the hamburger + slide-in drawer
// (the hamburger button and the rail hide/show via CSS — .app-rail /
// .nav-burger in index.css). Both render the same NavContent.
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
      <div className="app-shell">
        <aside className="app-rail">
          <Link to="/" className="row center" style={{ gap: 10, color: 'inherit', marginBottom: 8 }}>
            <Logo size={38} />
            <span className="head accent" style={{ fontSize: 13 }}>NAVIGATION</span>
          </Link>
          <NavContent onAuth={() => setAuthOpen(true)} />
        </aside>
        <div className="app-main">
          <TopBar onMenu={() => setMenuOpen(true)} onAuth={() => setAuthOpen(true)} />
          <main style={{ paddingTop: 8 }}>
            <Outlet />
          </main>
          <footer className="row center" style={{ justifyContent: 'center', gap: 10, padding: '14px 20px 22px' }}>
            <span className="mono dim" style={{ fontSize: 10 }}>SHORE CADET UNIT // 1ATF</span>
            <span className="mono dim" style={{ fontSize: 10 }}>·</span>
            <Link to="/privacy" className="mono dim" style={{ fontSize: 10 }}>Privacy Notice</Link>
          </footer>
        </div>
      </div>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} onAuth={() => setAuthOpen(true)} />
      {authOpen && <LoginModal onClose={() => setAuthOpen(false)} />}
    </div>
  )
}
