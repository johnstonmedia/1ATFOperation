import { useState } from 'react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useDialog } from '../hooks/useDialog'
import { notifyAdmin } from '../lib/notify'
import { classify } from '../lib/errors'

// Help / support form. Submissions land in Operations Centre → Help under the
// chosen category (Support or Account Issue) and optionally email the admin.
export default function SupportModal({ onClose }) {
  const { append } = useData()
  const { user } = useAuth()
  // A signed-in member's ID is taken automatically and can't be changed.
  const lockedId = user?.idNumber && user.idNumber !== 'EMULATED' ? String(user.idNumber) : ''
  const [form, setForm] = useState({ category: 'Support', name: user?.name || '', idNumber: lockedId, message: '' })
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const dialogRef = useDialog(onClose)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    const id = String(form.idNumber || '').trim()
    if (!id) { setErr('Your ID number is required. [ATF-INP-01]'); return }
    setBusy(true)
    try {
      await append('support', { category: form.category, name: form.name, idNumber: id, message: form.message, ts: Date.now(), status: 'open' })
      notifyAdmin(
        `1ATF ${form.category} request`,
        `Category: ${form.category}\nFrom: ${form.name || 'Anonymous'} (ID ${id})\n\n${form.message}`,
      )
      setDone(true)
    } catch (e) {
      // Surface the real reason (e.g. a permission-denied means RHQ still needs
      // to publish the database rules) rather than always blaming the network.
      const info = classify(e)
      setErr(`${info.message} [${info.code}]`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 950, background: 'rgba(2,4,9,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div ref={dialogRef} className="panel panel-pad" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Help and Support" style={{ width: 420, maxWidth: '100%' }}>
        <div className="row between center">
          <h2 className="accent" style={{ margin: 0, fontSize: 18 }}>HELP &amp; SUPPORT</h2>
          <button className="ghost" onClick={onClose} aria-label="Close" style={{ padding: '4px 10px' }}>✕</button>
        </div>

        {done ? (
          <div className="col center" style={{ gap: 12, padding: '24px 0' }}>
            <div className="head accent">MESSAGE SENT</div>
            <div className="mono dim" style={{ fontSize: 12, textAlign: 'center' }}>
              RHQ has received your request and will respond as required.
            </div>
            <button className="primary" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form onSubmit={submit} className="col" style={{ marginTop: 14 }}>
            <div className="col" style={{ gap: 4 }}>
              <label>Type</label>
              <select value={form.category} onChange={set('category')}>
                <option value="Support">General Support</option>
                <option value="Account Issue">Account Issue</option>
              </select>
            </div>
            <div className="col" style={{ gap: 4 }}>
              <label>Name (optional)</label>
              <input value={form.name} onChange={set('name')} />
            </div>
            <div className="col" style={{ gap: 4 }}>
              <label>ID number (required)</label>
              <input
                required
                value={form.idNumber}
                onChange={set('idNumber')}
                readOnly={Boolean(lockedId)}
                placeholder="e.g. 123456"
                title={lockedId ? 'Taken from your signed-in account' : undefined}
                style={lockedId ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
              />
              {lockedId && <span className="mono dim" style={{ fontSize: 10 }}>Taken from your account — you’re signed in.</span>}
            </div>
            <div className="col" style={{ gap: 4 }}>
              <label>Message</label>
              <textarea rows={4} required value={form.message} onChange={set('message')} />
            </div>
            {err && <div className="hostile mono" style={{ fontSize: 12 }}>{err}</div>}
            <button className="primary" disabled={busy} type="submit">{busy ? 'SENDING…' : 'Send to RHQ'}</button>
          </form>
        )}
      </div>
    </div>
  )
}
