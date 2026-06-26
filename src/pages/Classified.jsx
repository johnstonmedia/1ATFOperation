import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'
import LoginModal from '../components/LoginModal'
import SupportModal from '../components/SupportModal'

// The link originally shared with the unit: yourdomain.com/Classified
// First page everyone sees. "Continue" opens the temporary-password setup.
export default function Classified() {
  const { state } = useData()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [auth, setAuth] = useState(null) // 'temp' | 'login' | null
  const [support, setSupport] = useState(false)
  const c = state.classified

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: 24, position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6,
        background: 'repeating-linear-gradient(90deg,var(--hostile) 0 30px,#111 30px 60px)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 6,
        background: 'repeating-linear-gradient(90deg,var(--hostile) 0 30px,#111 30px 60px)' }} />

      <Logo size={120} />

      <div className="mono hostile" style={{ marginTop: 20, letterSpacing: 4, fontSize: 12 }}>
        YOUR EYES ONLY · DO NOT DISTRIBUTE
      </div>

      <h1
        style={{
          fontFamily: 'Orbitron', fontWeight: 900,
          fontSize: 'clamp(48px, 12vw, 130px)', margin: '10px 0',
          color: 'var(--hostile)', letterSpacing: 4,
          textShadow: '0 0 30px rgba(255,59,70,0.5)',
        }}
      >
        {c.heading}
      </h1>

      <div className="head" style={{ fontSize: 'clamp(18px,4vw,30px)', color: '#fff', letterSpacing: 2 }}>
        {c.unit}
      </div>

      <p className="dim" style={{ maxWidth: 620, marginTop: 18, lineHeight: 1.6, fontSize: 16 }}>
        {c.brief}
      </p>

      <div
        className="head accent"
        style={{ marginTop: 26, fontSize: 'clamp(16px,3vw,24px)', letterSpacing: 3, textShadow: '0 0 18px rgba(54,224,192,0.4)' }}
      >
        {c.motto}
      </div>

      <div className="row center wrap" style={{ gap: 12, marginTop: 40 }}>
        {user ? (
          <button className="primary" onClick={() => navigate('/')}>Enter Operational Portal →</button>
        ) : (
          <>
            <button className="primary" onClick={() => setAuth('temp')}>Continue →</button>
            <button className="ghost" onClick={() => setAuth('login')}>Already registered? Sign in</button>
          </>
        )}
      </div>

      <button className="ghost" onClick={() => setSupport(true)} style={{ marginTop: 14, fontSize: 11 }}>
        Help &amp; Support
      </button>

      <div className="mono dim" style={{ marginTop: 18, fontSize: 10 }}>LUCET PER MINISTERIUM</div>

      {auth && (
        <LoginModal
          initialMode={auth}
          onClose={() => setAuth(null)}
          onAuthed={() => navigate('/')}
        />
      )}
      {support && <SupportModal onClose={() => setSupport(false)} />}
    </div>
  )
}
