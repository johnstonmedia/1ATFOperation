import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import SupportModal from './SupportModal'

// Access modal with three modes:
//  - login:  ID number + password (default).
//  - temp:   "Log in with temporary password" — ID + issued temp password +
//            a new password of their choosing (first-time setup / after a reset).
//  - forgot: raise a forgotten-password request to RHQ.
export default function LoginModal({ onClose, onAuthed, initialMode = 'login' }) {
  const { signIn, register, forgotPassword } = useAuth()
  const { reportError } = useData()
  const [mode, setMode] = useState(initialMode)
  const [form, setForm] = useState({ idNumber: '', password: '', tempPassword: '', newPassword: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [support, setSupport] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [capsOn, setCapsOn] = useState(false)
  const [remember, setRemember] = useState(true)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const go = (m) => { setErr(''); setInfo(''); setMode(m) }

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setInfo(''); setBusy(true)
    try {
      if (mode === 'login') { await signIn({ ...form, remember }); onAuthed?.(); onClose() }
      else if (mode === 'temp') { await register(form); onAuthed?.(); onClose() }
      else { await forgotPassword(form); setInfo('Request sent to RHQ. They will issue you a new temporary password.') }
    } catch (e2) {
      const info = await reportError(e2, `login:${mode}`, { idNumber: form.idNumber })
      setErr(
        info.reportable
          ? `${info.message} [${info.code}] — RHQ has been notified.`
          : `${info.message} [${info.code}]`,
      )
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'temp' ? 'LOG IN WITH TEMPORARY PASSWORD' : mode === 'forgot' ? 'FORGOTTEN PASSWORD' : 'SECURE ACCESS'

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(2,4,9,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="panel panel-pad" onClick={(e) => e.stopPropagation()} style={{ width: 400, maxWidth: '100%' }}>
        <div className="row between center">
          <h2 className="accent" style={{ margin: 0, fontSize: 17 }}>{title}</h2>
          <button className="ghost" onClick={onClose} style={{ padding: '4px 10px' }}>✕</button>
        </div>

        <form onSubmit={submit} className="col" style={{ marginTop: 16 }}>
          <div className="col" style={{ gap: 4 }}>
            <label>Service / ID Number</label>
            <input required value={form.idNumber} onChange={set('idNumber')} placeholder="e.g. 123456" autoComplete="username" />
          </div>

          {mode === 'login' && (
            <div className="col" style={{ gap: 4 }}>
              <label>Password</label>
              <PwInput required value={form.password} onChange={set('password')} autoComplete="current-password" show={showPw} setShow={setShowPw} onCaps={setCapsOn} />
              <label className="row center" style={{ gap: 8, fontSize: 11, cursor: 'pointer', textTransform: 'none', letterSpacing: 0 }}>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 'auto' }} />
                Keep me signed in on this device
              </label>
            </div>
          )}

          {mode === 'temp' && (
            <>
              <div className="col" style={{ gap: 4 }}>
                <label>Temporary Password (issued by RHQ)</label>
                <input required value={form.tempPassword} onChange={set('tempPassword')} placeholder="From your activation message" />
              </div>
              <div className="col" style={{ gap: 4 }}>
                <label>Choose a New Password</label>
                <PwInput required value={form.newPassword} onChange={set('newPassword')} placeholder="At least 6 characters" autoComplete="new-password" show={showPw} setShow={setShowPw} onCaps={setCapsOn} />
                <StrengthMeter pw={form.newPassword} />
              </div>
            </>
          )}

          {capsOn && (mode === 'login' || mode === 'temp') && (
            <div className="warn mono" style={{ fontSize: 11 }}>⚠ Caps Lock is on.</div>
          )}
          {err && <div className="hostile mono" style={{ fontSize: 12 }}>{err}</div>}
          {info && <div className="accent mono" style={{ fontSize: 12 }}>{info}</div>}

          <button className="primary" disabled={busy} type="submit">
            {busy ? 'PROCESSING…' : mode === 'login' ? 'Authenticate' : mode === 'temp' ? 'Set Password & Enter' : 'Request Reset'}
          </button>
        </form>

        <div className="divider" />
        <div className="col" style={{ gap: 8 }}>
          {mode !== 'temp' && (
            <button className="ghost" style={{ width: '100%' }} onClick={() => go('temp')}>
              Log in with temporary password
            </button>
          )}
          {mode !== 'login' && (
            <button className="ghost" style={{ width: '100%' }} onClick={() => go('login')}>
              Back to sign in
            </button>
          )}
          {mode === 'login' && (
            <button className="ghost" style={{ width: '100%' }} onClick={() => go('forgot')}>
              Forgot password?
            </button>
          )}
          <button className="ghost" style={{ width: '100%' }} onClick={() => setSupport(true)}>
            Help &amp; Support
          </button>
        </div>
      </div>

      {support && <SupportModal onClose={() => setSupport(false)} />}
    </div>
  )
}

// Password input with a reveal toggle and Caps Lock detection.
function PwInput({ show, setShow, onCaps, ...props }) {
  const caps = (e) => onCaps && e.getModifierState && onCaps(e.getModifierState('CapsLock'))
  return (
    <div style={{ position: 'relative' }}>
      <input
        {...props}
        type={show ? 'text' : 'password'}
        onKeyUp={caps}
        onKeyDown={caps}
        style={{ paddingRight: 60, width: '100%' }}
      />
      <button
        type="button"
        className="ghost"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', padding: '2px 8px', fontSize: 11 }}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

// Rough password-strength indicator shown while choosing a new password.
function pwStrength(pw) {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 6) s++
  if (pw.length >= 10) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return Math.min(s, 4)
}
function StrengthMeter({ pw }) {
  if (!pw) return null
  const score = pwStrength(pw)
  const colors = ['#ff3b46', '#ff8a3b', '#ffcf4a', '#7bd66a', '#36e0c0']
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong']
  return (
    <div className="col" style={{ gap: 4 }}>
      <div className="row" style={{ gap: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ height: 4, flex: 1, borderRadius: 2, background: i <= score - 1 ? colors[score] : 'var(--line)' }} />
        ))}
      </div>
      <span className="mono dim" style={{ fontSize: 10 }}>Strength: <span style={{ color: colors[score] }}>{labels[score]}</span></span>
    </div>
  )
}
