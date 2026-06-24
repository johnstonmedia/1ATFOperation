import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { FIREBASE_ENABLED } from '../firebase/config'

// Sign in / register. Registration matches the account to the RHQ-provisioned
// roster by ID number or email so it inherits rank/company/role.
export default function LoginModal({ onClose }) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ idNumber: '', password: '', email: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      if (mode === 'login') await login(form)
      else await register(form)
      onClose()
    } catch (e2) {
      setErr(e2.message || 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(2,4,9,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div className="panel panel-pad" onClick={(e) => e.stopPropagation()} style={{ width: 380, maxWidth: '100%' }}>
        <div className="row between center">
          <h2 className="accent" style={{ margin: 0, fontSize: 18 }}>
            {mode === 'login' ? 'SECURE ACCESS' : 'REQUEST CLEARANCE'}
          </h2>
          <button className="ghost" onClick={onClose} style={{ padding: '4px 10px' }}>✕</button>
        </div>
        <div className="mono dim" style={{ fontSize: 10, marginTop: 4 }}>
          {FIREBASE_ENABLED ? 'FIREBASE AUTH · LIVE' : 'LOCAL PREVIEW MODE'}
        </div>

        <form onSubmit={submit} className="col" style={{ marginTop: 16 }}>
          <div className="col" style={{ gap: 4 }}>
            <label>Service / ID Number</label>
            <input required value={form.idNumber} onChange={set('idNumber')} placeholder="e.g. 190990" autoComplete="username" />
          </div>
          {mode === 'register' && (
            <div className="col" style={{ gap: 4 }}>
              <label>Email (optional)</label>
              <input type="email" value={form.email} onChange={set('email')} placeholder="For contact / recovery" autoComplete="email" />
            </div>
          )}
          <div className="col" style={{ gap: 4 }}>
            <label>Password</label>
            <input type="password" required value={form.password} onChange={set('password')} autoComplete="current-password" />
          </div>

          {err && <div className="hostile mono" style={{ fontSize: 12 }}>{err}</div>}

          <button className="primary" disabled={busy} type="submit">
            {busy ? 'PROCESSING…' : mode === 'login' ? 'Authenticate' : 'Create Account'}
          </button>
        </form>

        <div className="divider" />
        <button className="ghost" style={{ width: '100%' }} onClick={() => { setErr(''); setMode(mode === 'login' ? 'register' : 'login') }}>
          {mode === 'login' ? 'No account? Request clearance' : 'Have access? Sign in'}
        </button>
      </div>
    </div>
  )
}
