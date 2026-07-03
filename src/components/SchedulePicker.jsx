import { useState } from 'react'
import { useDialog } from '../hooks/useDialog'

// Clean in-app date + time picker (no raw datetime box). Calls onConfirm(ts).
// `verb` tweaks the copy, e.g. "distribute" or "deploy".
export default function SchedulePicker({ onCancel, onConfirm, title = 'SCHEDULE', verb = 'happen' }) {
  const dialogRef = useDialog(onCancel)
  const pad = (n) => String(n).padStart(2, '0')
  const now = new Date()
  const [date, setDate] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`)
  const [hour, setHour] = useState(pad(now.getHours()))
  const [minute, setMinute] = useState('00')

  const ts = Date.parse(`${date}T${hour}:${minute}:00`)
  const valid = !Number.isNaN(ts)
  const past = valid && ts <= Date.now()

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 950, background: 'rgba(2,4,9,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div ref={dialogRef} className="panel panel-pad col" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title} style={{ width: 360, maxWidth: '100%', gap: 12 }}>
        <div className="row between center">
          <h2 className="accent" style={{ margin: 0, fontSize: 17 }}>{title}</h2>
          <button className="ghost" onClick={onCancel} aria-label="Close" style={{ padding: '4px 10px' }}>✕</button>
        </div>

        <div className="col" style={{ gap: 4 }}>
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div className="col grow" style={{ gap: 4 }}>
            <label>Hour</label>
            <select value={hour} onChange={(e) => setHour(e.target.value)}>
              {Array.from({ length: 24 }, (_, h) => pad(h)).map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div className="col grow" style={{ gap: 4 }}>
            <label>Minute</label>
            <select value={minute} onChange={(e) => setMinute(e.target.value)}>
              {Array.from({ length: 12 }, (_, m) => pad(m * 5)).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="mono dim" style={{ fontSize: 11 }}>
          {valid ? <>Will {verb}: <span className="accent">{new Date(ts).toLocaleString()}</span></> : 'Pick a valid date.'}
          {past && <span className="warn"> · time is in the past — {verb}s immediately.</span>}
        </div>

        <div className="row between" style={{ marginTop: 4 }}>
          <button className="ghost" onClick={onCancel}>Cancel</button>
          <button className="primary" disabled={!valid} onClick={() => onConfirm(ts)}>Confirm</button>
        </div>
      </div>
    </div>
  )
}
