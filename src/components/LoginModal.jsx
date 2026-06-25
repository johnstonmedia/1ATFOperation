import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

// Dual-mode access modal.
//  - login:    ID number + password (returning members; admin bootstrap).
//  - register: ID number + issued temporary password + a new password of their
//              choosing. The new password is only set if the temp password is
//              correct. Opened from the Classified "Continue" button.
export default function LoginModal({ onClose, onAuthed, initialMode = 'login' }) {
  const { signIn, register } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [form, setForm] = useState({ idNumber: '', password: '', tempPassword: '', newPassword: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const isRegister = mode === 'register'

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      if (isRegister) await register(form)
      else await signIn(form)
      onAuthed?.()
      onClose()
    } catch (e2) {
      setErr(e2.message || 'Access denied')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(2,4,9,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div className="panel panel-pad" onClick={(e) => e.stopPropagation()} style={{ width: 390, maxWidth: '100%' }}>
        <div className="row between center">
          <h2 className="accent" style={{ margin: 0, fontSize: 18 }}>
            {isRegister ? 'REGISTER ACCESS' : 'SECURE ACCESS'}
          </h2>
          <button className="ghost" onClick={onClose} style={{ padding: '4px 10px' }}>✕</button>
        </div>

        <form onSubmit={submit} className="col" style={{ marginTop: 16 }}>
          <div className="col" style={{ gap: 4 }}>
            <label>Service / ID Number</label>
            <input required value={form.idNumber} onChange={set('idNumber')} placeholder="e.g. 123456" autoComplete="username" />
          </div>

          {isRegister ? (
            <>
              <div className="col" style={{ gap: 4 }}>
                <label>Temporary Password (issued by RHQ)</label>
                <input required value={form.tempPassword} onChange={set('tempPassword')} placeholder="From your activation message" />
              </div>
              <div className="col" style={{ gap: 4 }}>
                <label>Choose a New Password</label>
                <input type="password" required value={form.newPassword} onChange={set('newPassword')} placeholder="At least 6 characters" autoComplete="new-password" />
              </div>
            </>
          ) : (
            <div className="col" style={{ gap: 4 }}>
              <label>Password</label>
              <input type="password" required value={form.password} onChange={set('password')} autoComplete="current-password" />
            </div>
          )}

          {err && <div className="hostile mono" style={{ fontSize: 12 }}>{err}</div>}

          <button className="primary" disabled={busy} type="submit">
            {busy ? 'PROCESSING…' : isRegister ? 'Set Password & Enter' : 'Authenticate'}
          </button>
        </form>

        <div className="divider" />
        <button
          className="ghost"
          style={{ width: '100%' }}
          onClick={() => { setErr(''); setMode(isRegister ? 'login' : 'register') }}
        >
          {isRegister ? 'Already registered? Sign in' : 'First time? Register with temp password'}
        </button>
      </div>
    </div>
  )
}
