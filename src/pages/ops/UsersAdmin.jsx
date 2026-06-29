import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { useData } from '../../context/DataContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useToast } from '../../context/ToastContext'
import { useAudit } from '../../hooks/useAudit'
import { OpsHeader } from './OperationsCentre'
import { Field } from './NarrativeEditor'
import { COMPANIES, ROLES, PHONETIC } from '../../firebase/seed'
import { genTempPassword } from '../../lib/passwords'

// Roster management. Import a spreadsheet of name / ID / company / email, then
// the site issues each member a random temporary password (downloadable). A
// member registers from the Classified page with their ID + temp password and
// sets their own password. Role (RHQ / General) is chosen here, not imported.
export default function UsersAdmin() {
  const { state, updateSlice, replaceRoster, makeId } = useData()
  const confirm = useConfirm()
  const { push } = useToast()
  const audit = useAudit()
  const roster = state.roster
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [importInfo, setImportInfo] = useState(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return roster
    return roster.filter((r) =>
      [r.name, r.idNumber, r.email, PHONETIC[r.company], r.company, r.role]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    )
  }, [roster, query])

  const save = (rows) => updateSlice('roster', rows)
  const upsert = (rec) => {
    const exists = roster.some((r) => r._id === rec._id)
    save(exists ? roster.map((r) => (r._id === rec._id ? rec : r)) : [...roster, rec])
    setEditing(null)
    push('Member saved')
    audit(exists ? 'Updated member' : 'Added member', `${rec.name || 'Unnamed'} (ID ${rec.idNumber || '—'}, ${rec.role})`)
  }
  const remove = (id) => {
    const r = roster.find((x) => x._id === id)
    save(roster.filter((x) => x._id !== id))
    push('Member removed')
    audit('Removed member', `${r?.name || 'Unnamed'} (ID ${r?.idNumber || '—'})`)
  }

  const onSpreadsheet = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    const incoming = rows.map((row) => mapRow(row, makeId))
    // Merge: keep every existing member untouched; only add genuinely new IDs.
    const existing = new Set(roster.map((r) => String(r.idNumber).trim()).filter(Boolean))
    const toAdd = incoming.filter((r) => r.idNumber && !existing.has(String(r.idNumber).trim()))
    replaceRoster([...roster, ...toAdd])
    setImportInfo({
      count: incoming.length,
      added: toAdd.length,
      skipped: incoming.length - toAdd.length,
      columns: Object.keys(rows[0] || {}),
    })
    push(`Imported ${toAdd.length} new member${toAdd.length === 1 ? '' : 's'}`)
    audit('Imported roster', `${toAdd.length} added, ${incoming.length - toAdd.length} kept`)
    e.target.value = ''
  }

  // Download the roster with the issued temporary passwords for distribution.
  const downloadTempPasswords = () => {
    const data = roster.map((r) => ({
      Name: r.name,
      'ID Number': r.idNumber,
      Email: r.email,
      Company: PHONETIC[r.company] ? `${PHONETIC[r.company]} (${r.company})` : r.company,
      'Temporary Password': r.tempPassword || '',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Temp Passwords')
    XLSX.writeFile(wb, '1ATF-temporary-passwords.xlsx')
  }

  const hasTemps = roster.some((r) => r.tempPassword)

  return (
    <div>
      <OpsHeader title="Users" sub={`ADMIN // ROSTER (${roster.length})`}>
        <label className="btn" style={{ cursor: 'pointer' }}>
          Import spreadsheet
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onSpreadsheet} style={{ display: 'none' }} />
        </label>
        {hasTemps && <button onClick={downloadTempPasswords}>Download temp passwords</button>}
        <button className="primary" onClick={() => setEditing(newUser(makeId))}>+ New user</button>
      </OpsHeader>

      {importInfo && (
        <div className="panel panel-pad" style={{ marginBottom: 14, borderColor: 'var(--accent)' }}>
          <span className="accent mono">
            Added {importInfo.added} new member{importInfo.added === 1 ? '' : 's'} ·
            kept {importInfo.skipped} existing (unchanged).
          </span>
          <span className="dim mono" style={{ fontSize: 11 }}> Columns: {importInfo.columns.join(', ')} · Use “Download temp passwords” to distribute.</span>
        </div>
      )}

      <input
        placeholder="Search by name, ID, email or company…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 14 }}
      />

      <div className="panel" style={{ overflow: 'hidden' }}>
        <div className="table-scroll">
        <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(58,71,148,0.25)', fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: 1 }}>
              {['ID', 'NAME', 'COMPANY', 'ROLE', 'EMAIL', 'TEMP PW', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-dim)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 300).map((r) => (
              <tr key={r._id || r.idNumber} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={cell} className="mono">{r.idNumber}</td>
                <td style={cell}>{r.name}</td>
                <td style={cell}>{PHONETIC[r.company] || '—'} {r.company && `(${r.company})`}</td>
                <td style={cell}><span className={r.role === 'RHQ' ? 'tag hostile' : 'tag'}>{r.role}</span></td>
                <td style={cell} className="mono dim">{r.email}</td>
                <td style={cell} className="mono accent">{r.tempPassword || '—'}</td>
                <td style={cell}><button className="ghost" onClick={() => setEditing(r)} style={{ padding: '4px 10px' }}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {filtered.length === 0 && <div className="mono dim panel-pad">No matching personnel.</div>}
        {filtered.length > 300 && <div className="mono dim panel-pad">Showing first 300 of {filtered.length}. Refine your search.</div>}
      </div>

      {editing && <UserModal rec={editing} onClose={() => setEditing(null)} onSave={upsert} onDelete={remove} />}
    </div>
  )
}

const cell = { padding: '9px 12px' }

function newUser(makeId) {
  return { _id: makeId(), name: '', idNumber: '', email: '', company: 'A', role: 'General', rank: '', tempPassword: genTempPassword() }
}

function UserModal({ rec, onClose, onSave, onDelete }) {
  const [u, setU] = useState(rec)
  const confirm = useConfirm()
  const set = (k) => (e) => setU({ ...u, [k]: e.target.value })
  const del = async () => {
    const ok = await confirm({
      title: 'Remove member',
      message: `Remove ${u.name || 'this member'} (ID ${u.idNumber || '—'}) from the roster? This cannot be undone.`,
      danger: true,
      confirmLabel: 'Remove',
    })
    if (!ok) return
    onDelete(u._id)
    onClose()
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2,4,9,0.8)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="panel panel-pad col" onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: '100%' }}>
        <h2 className="accent" style={{ margin: 0, fontSize: 18 }}>{rec.name ? 'Edit User' : 'New User'}</h2>
        <Field label="Name"><input value={u.name} onChange={set('name')} /></Field>
        <Field label="Service / ID number"><input value={u.idNumber} onChange={set('idNumber')} /></Field>
        <Field label="Email"><input value={u.email} onChange={set('email')} /></Field>
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
        <Field label="Temporary password">
          <div className="row" style={{ gap: 8 }}>
            <input className="mono" value={u.tempPassword || ''} onChange={set('tempPassword')} />
            <button className="ghost" type="button" onClick={() => setU({ ...u, tempPassword: genTempPassword() })}>Regenerate</button>
          </div>
        </Field>
        <div className="mono dim" style={{ fontSize: 10 }}>
          The member registers with their ID + this temporary password, then sets their own password.
        </div>
        <div className="row between" style={{ marginTop: 8 }}>
          <button className="danger ghost" onClick={del}>Delete</button>
          <div className="row" style={{ gap: 8 }}>
            <button className="ghost" onClick={onClose}>Cancel</button>
            <button className="primary" onClick={() => onSave(u)}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Maps a spreadsheet row to a roster record. We capture only name, ID, company
// and email; a random temporary password is issued. Header matching is fuzzy —
// adjust COLUMN_HINTS once the real spreadsheet's headers are confirmed.
const COLUMN_HINTS = {
  idNumber: ['id', 'idnumber', 'id number', 'service', 'service number', 'regimental', 'number', 'no'],
  name: ['name', 'full name', 'fullname', 'cadet', 'surname'],
  email: ['email', 'e-mail', 'mail'],
  company: ['company', 'coy', 'coy letter', 'unit', 'sub-unit', 'phonetic'],
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
  return {
    _id: makeId(),
    idNumber: get('idNumber'),
    name: get('name') || 'Unnamed',
    email: get('email'),
    company: COMPANIES.some((c) => c.letter === company) ? company : '',
    role: 'General',
    rank: '',
    tempPassword: genTempPassword(),
  }
}
