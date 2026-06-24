import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { FIREBASE_ENABLED } from '../firebase/config'

// Single-step access. Members log in with their ID number. The first time an ID
// is used, whatever password is entered becomes that account's password (the
// account is "claimed"); afterwards it must match. Only RHQ-provisioned IDs work.
export default function LoginModal({ onClose }) {
  const { signIn } = useAuth()
  const [form, setForm] = useState({ idNumber: '', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await signIn(form)
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
      style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(2,4,9,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div className="panel panel-pad" onClick={(e) => e.stopPropagation()} style={{ width: 380, maxWidth: '100%' }}>
        <div className="row between center">
          <h2 className="accent" style={{ margin: 0, fontSize: 18 }}>SECURE ACCESS</h2>
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
          <div className="col" style={{ gap: 4 }}>
            <label>Password</label>
            <input type="password" required value={form.password} onChange={set('password')} autoComplete="current-password" />
          </div>

          {err && <div className="hostile mono" style={{ fontSize: 12 }}>{err}</div>}

          <button className="primary" disabled={busy} type="submit">
            {busy ? 'VERIFYING…' : 'Authenticate'}
          </button>
        </form>

        <div className="divider" />
        <div className="mono dim" style={{ fontSize: 10, lineHeight: 1.5 }}>
          First time? Logging in with your ID number sets your password. Use the same
          password next time. IDs are issued by RHQ.
        </div>
      </div>
    </div>
  )
}
