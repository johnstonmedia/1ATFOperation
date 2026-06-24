import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { useData } from '../../context/DataContext'
import { OpsHeader } from './OperationsCentre'
import { Field } from './NarrativeEditor'
import { COMPANIES, ROLES, PHONETIC } from '../../firebase/seed'

// Roster management. Create/edit users, bulk-import a spreadsheet (~800 rows),
// and search. When a person registers with a matching ID number or email their
// account links to the roster record automatically (see AuthContext).
export default function UsersAdmin() {
  const { state, updateSlice, replaceRoster, makeId } = useData()
  const roster = state.roster
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [importInfo, setImportInfo] = useState(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return roster
    return roster.filter((r) =>
      [r.name, r.idNumber, r.email, r.rank, PHONETIC[r.company], r.company, r.role]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    )
  }, [roster, query])

  const save = (rows) => updateSlice('roster', rows)
  const upsert = (rec) => {
    const exists = roster.some((r) => r._id === rec._id)
    save(exists ? roster.map((r) => (r._id === rec._id ? rec : r)) : [...roster, rec])
    setEditing(null)
  }
  const remove = (id) => save(roster.filter((r) => r._id !== id))

  const onSpreadsheet = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    const mapped = rows.map((row) => mapRow(row, makeId))
    replaceRoster(mapped)
    setImportInfo({ count: mapped.length, columns: Object.keys(rows[0] || {}) })
    e.target.value = ''
  }

  return (
    <div>
      <OpsHeader title="Users" sub={`ADMIN // ROSTER (${roster.length})`}>
        <label className="btn" style={{ cursor: 'pointer' }}>
          Import spreadsheet
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onSpreadsheet} style={{ display: 'none' }} />
        </label>
        <button className="primary" onClick={() => setEditing({ _id: makeId(), name: '', idNumber: '', email: '', rank: '', company: 'A', role: 'General' })}>
          + New user
        </button>
      </OpsHeader>

      {importInfo && (
        <div className="panel panel-pad" style={{ marginBottom: 14, borderColor: 'var(--accent)' }}>
          <span className="accent mono">Imported {importInfo.count} records.</span>
          <span className="dim mono" style={{ fontSize: 11 }}> Detected columns: {importInfo.columns.join(', ')}</span>
        </div>
      )}

      <input
        placeholder="Search by name, ID, email, company, rank, role…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 14 }}
      />

      <div className="panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(58,71,148,0.25)', fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: 1 }}>
              {['ID', 'NAME', 'RANK', 'COMPANY', 'ROLE', 'EMAIL', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-dim)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 300).map((r) => (
              <tr key={r._id || r.idNumber} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={cell} className="mono">{r.idNumber}</td>
                <td style={cell}>{r.name}</td>
                <td style={cell}>{r.rank}</td>
                <td style={cell}>{PHONETIC[r.company] || '—'} {r.company && `(${r.company})`}</td>
                <td style={cell}><span className={r.role === 'RHQ' ? 'tag hostile' : 'tag'}>{r.role}</span></td>
                <td style={cell} className="mono dim">{r.email}</td>
                <td style={cell}><button className="ghost" onClick={() => setEditing(r)} style={{ padding: '4px 10px' }}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="mono dim panel-pad">No matching personnel.</div>}
        {filtered.length > 300 && <div className="mono dim panel-pad">Showing first 300 of {filtered.length}. Refine your search.</div>}
      </div>

      {editing && <UserModal rec={editing} onClose={() => setEditing(null)} onSave={upsert} onDelete={remove} />}
    </div>
  )
}

const cell = { padding: '9px 12px' }

function UserModal({ rec, onClose, onSave, onDelete }) {
  const [u, setU] = useState(rec)
  const set = (k) => (e) => setU({ ...u, [k]: e.target.value })
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2,4,9,0.8)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="panel panel-pad col" onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: '100%' }}>
        <h2 className="accent" style={{ margin: 0, fontSize: 18 }}>{rec.name ? 'Edit User' : 'New User'}</h2>
        <Field label="Name"><input value={u.name} onChange={set('name')} /></Field>
        <Field label="Service / ID number"><input value={u.idNumber} onChange={set('idNumber')} /></Field>
        <Field label="Email"><input value={u.email} onChange={set('email')} /></Field>
        <Field label="Rank"><input value={u.rank} onChange={set('rank')} /></Field>
        <div className="row" style={{ gap: 10 }}>
          <Field label="Company">
            <select value={u.company} onChange={set('company')}>
              {COMPANIES.map((c) => <option key={c.letter} value={c.letter}>{c.name} ({c.letter})</option>)}
            </select>
          </Field>
          <Field label="Role">
            <select value={u.role} onChange={set('role')}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
        </div>
        <div className="row between" style={{ marginTop: 8 }}>
          <button className="danger ghost" onClick={() => { onDelete(u._id); onClose() }}>Delete</button>
          <div className="row" style={{ gap: 8 }}>
            <button className="ghost" onClick={onClose}>Cancel</button>
            <button className="primary" onClick={() => onSave(u)}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Maps an arbitrary spreadsheet row to our roster record. Header matching is
// fuzzy so it tolerates differing column names — adjust COLUMN_HINTS once the
// real spreadsheet format is confirmed.
const COLUMN_HINTS = {
  idNumber: ['id', 'idnumber', 'id number', 'service', 'service number', 'regimental', 'number', 'no'],
  name: ['name', 'full name', 'fullname', 'cadet', 'surname'],
  email: ['email', 'e-mail', 'mail'],
  rank: ['rank', 'grade'],
  company: ['company', 'coy', 'coy letter', 'unit', 'sub-unit', 'phonetic'],
  role: ['role', 'appointment', 'position'],
}
function findKey(row, hints) {
  const keys = Object.keys(row)
  for (const h of hints) {
    const k = keys.find((key) => key.toLowerCase().trim() === h)
    if (k) return k
  }
  for (const h of hints) {
    const k = keys.find((key) => key.toLowerCase().includes(h))
    if (k) return k
  }
  return null
}
function mapRow(row, makeId) {
  const get = (field) => {
    const k = findKey(row, COLUMN_HINTS[field])
    return k ? String(row[k]).trim() : ''
  }
  let company = get('company').toUpperCase()
  // Accept either a letter (A) or a full phonetic name (Alpha).
  if (company.length > 1) {
    const entry = Object.entries(PHONETIC).find(([, name]) => name.toUpperCase() === company)
    company = entry ? entry[0] : company[0]
  }
  let role = get('role')
  role = /rhq/i.test(role) ? 'RHQ' : 'General'
  return {
    _id: makeId(),
    idNumber: get('idNumber'),
    name: get('name') || 'Unnamed',
    email: get('email'),
    rank: get('rank') || 'Cadet',
    company: COMPANIES.some((c) => c.letter === company) ? company : '',
    role,
  }
}
