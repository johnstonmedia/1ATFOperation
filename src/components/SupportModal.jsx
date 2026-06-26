import { useState } from 'react'
import { useData } from '../context/DataContext'
import { notifyAdmin } from '../lib/notify'

// Help / support form. Submissions land in Operations Centre → Help under the
// chosen category (Support or Account Issue) and optionally email the admin.
export default function SupportModal({ onClose }) {
  const { append } = useData()
  const [form, setForm] = useState({ category: 'Support', name: '', contact: '', message: '' })
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await append('support', { ...form, ts: Date.now(), status: 'open' })
      notifyAdmin(
        `1ATF ${form.category} request`,
        `Category: ${form.category}\nFrom: ${form.name || 'Anonymous'} (${form.contact || 'no contact'})\n\n${form.message}`,
      )
      setDone(true)
    } catch {
      setErr('Could not send — check your connection and try again. [ATF-NET-01]')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 950, background: 'rgba(2,4,9,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="panel panel-pad" onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: '100%' }}>
        <div className="row between center">
          <h2 className="accent" style={{ margin: 0, fontSize: 18 }}>HELP &amp; SUPPORT</h2>
          <button className="ghost" onClick={onClose} style={{ padding: '4px 10px' }}>✕</button>
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
              <label>Contact (email or ID, optional)</label>
              <input value={form.contact} onChange={set('contact')} />
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
