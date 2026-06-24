import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'
import Sidebar from './Sidebar'
import LoginModal from './LoginModal'

// App shell: top bar + slide-in hamburger sidebar + routed content.
export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <div>
      <TopBar onMenu={() => setMenuOpen(true)} onAuth={() => setAuthOpen(true)} />
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} onAuth={() => setAuthOpen(true)} />
      <main style={{ paddingTop: 8 }}>
        <Outlet />
      </main>
      {authOpen && <LoginModal onClose={() => setAuthOpen(false)} />}
    </div>
  )
}
