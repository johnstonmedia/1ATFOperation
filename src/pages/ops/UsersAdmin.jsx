import { useState, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { useData } from '../../context/DataContext'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useToast } from '../../context/ToastContext'
import { useAudit } from '../../hooks/useAudit'
import { useDialog } from '../../hooks/useDialog'
import { OpsHeader } from './OperationsCentre'
import { Field } from './NarrativeEditor'
import { COMPANIES, ROLES, COMMANDER_ROLE, RANKS, PHONETIC, rankShort, normalizeRank } from '../../firebase/seed'
import { genTempPassword } from '../../lib/passwords'
import { getAuthVersion, setAuthVersion } from '../../lib/store'
import { sendMemberEmail } from '../../lib/notify'
import { FIREBASE_ENABLED, db } from '../../firebase/config'

const cleanId = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]/g, '')

// Roster management. Import a spreadsheet of name / ID / company / email, then
// the site issues each member a random temporary password (downloadable). A
// member registers from the Classified page with their ID + temp password and
// sets their own password. Role (RHQ / General) is chosen here, not imported.
export default function UsersAdmin() {
  const { state, updateSlice, replaceRoster, makeId } = useData()
  const { realUser } = useAuth()
  const confirm = useConfirm()
  const { push } = useToast()
  const audit = useAudit()
  const roster = state.roster

  // Self-heal: make sure the signed-in RHQ (incl. the bootstrap admin 190990)
  // always appears in the roster, even if the account was created before it was
  // written or the write was previously blocked.
  useEffect(() => {
    const me = realUser
    if (!me?.idNumber || me.role !== 'RHQ') return
    const id = String(me.idNumber).trim()
    if (roster.some((r) => String(r.idNumber).trim() === id)) return
    updateSlice('roster', [
      ...roster,
      { _id: `self-${id}`, idNumber: id, name: me.name || 'RHQ', email: me.email || '', company: me.company || 'S', role: 'RHQ', rank: me.rank || '' },
    ])
  }, [realUser, roster, updateSlice])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [importInfo, setImportInfo] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  // idNumber -> latest registration time, read from the users collection (RHQ
  // only). Lets us tell which issued temp passwords have already been consumed.
  const [registered, setRegistered] = useState({})

  useEffect(() => {
    if (!FIREBASE_ENABLED) return
    let live = true
    ;(async () => {
      try {
        const { collection, getDocs } = await import('firebase/firestore')
        const snap = await getDocs(collection(db, 'users'))
        const map = {}
        snap.forEach((d) => {
          const u = d.data()
          const id = String(u.idNumber || '').trim()
          if (!id) return
          const ts = u.registeredAt || 1 // legacy accounts: mark as registered
          if (!map[id] || ts > map[id]) map[id] = ts
        })
        if (live) setRegistered(map)
      } catch {
        /* non-RHQ or offline — leave empty (temps just show normally) */
      }
    })()
    return () => { live = false }
  }, [roster])

  // A temp password is "used" once the member has registered at or after the
  // time this temp was issued. Regenerating (new tempIssuedAt) reveals it again.
  const isUsed = (r) => {
    const reg = registered[String(r.idNumber).trim()]
    return Boolean(reg) && reg >= (r.tempIssuedAt || 0)
  }

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
  const upsert = async (rec) => {
    const prev = roster.find((r) => r._id === rec._id)
    const exists = Boolean(prev)
    save(exists ? roster.map((r) => (r._id === rec._id ? rec : r)) : [...roster, rec])
    setEditing(null)
    push('Member saved')
    audit(exists ? 'Updated member' : 'Added member', `${rec.name || 'Unnamed'} (ID ${rec.idNumber || '—'}, ${rec.role})`)
    // A re-issued temp password only works if the member's existing login is
    // invalidated too (bump their auth epoch), so they can register afresh with
    // the new temp. Only for existing members whose temp actually just changed.
    const reissued = exists && rec.tempPassword && rec.tempIssuedAt && rec.tempIssuedAt !== prev.tempIssuedAt
    if (reissued) {
      try {
        const idc = cleanId(rec.idNumber)
        const v = await getAuthVersion(idc)
        await setAuthVersion(idc, v + 1)
        audit('Re-issued login', `ID ${rec.idNumber}`)
        push('Login reset — the member can sign in with the new temporary password')
      } catch {
        push('Saved, but could not reset login (publish the database rules)', { type: 'error' })
      }
    }
  }
  const remove = (id) => {
    const r = roster.find((x) => x._id === id)
    save(roster.filter((x) => x._id !== id))
    push('Member removed')
    audit('Removed member', `${r?.name || 'Unnamed'} (ID ${r?.idNumber || '—'})`)
  }

  // ---- bulk selection ----
  const visible = filtered.slice(0, 300)
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r._id))
  const toggleOne = (id) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAllVisible = () =>
    setSelected((s) => {
      const n = new Set(s)
      const flip = allVisibleSelected ? (id) => n.delete(id) : (id) => n.add(id)
      visible.forEach((r) => flip(r._id))
      return n
    })
  const clearSelection = () => setSelected(new Set())
  const removeSelected = async () => {
    const rows = roster.filter((r) => selected.has(r._id))
    if (!rows.length) return
    const ok = await confirm({
      title: 'Remove members',
      message: `Remove ${rows.length} selected member${rows.length === 1 ? '' : 's'} from the roster? This cannot be undone.`,
      danger: true,
      confirmLabel: `Remove ${rows.length}`,
    })
    if (!ok) return
    save(roster.filter((r) => !selected.has(r._id)))
    push(`Removed ${rows.length} member${rows.length === 1 ? '' : 's'}`)
    audit('Bulk removed members', `${rows.length} removed`)
    clearSelection()
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
  // Only unused temps are exported — consumed ones are worthless.
  const downloadTempPasswords = () => {
    const data = roster.filter((r) => r.tempPassword && !isUsed(r)).map((r) => ({
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

  const hasTemps = roster.some((r) => r.tempPassword && !isUsed(r))

  // Email each member (with an address and an unused temp) their login details.
  const [emailing, setEmailing] = useState(false)
  const emailTargets = roster.filter((r) => r.email && r.tempPassword && !isUsed(r))
  const emailTempPasswords = async () => {
    if (!emailTargets.length) return
    const ok = await confirm({
      title: 'Email temporary passwords',
      message: `Send login details to ${emailTargets.length} member${emailTargets.length === 1 ? '' : 's'} with an email address and an unused temporary password? Each person receives their own Student ID and temporary password.`,
      confirmLabel: `Email ${emailTargets.length}`,
    })
    if (!ok) return
    setEmailing(true)
    const link = `${location.origin}${import.meta.env.BASE_URL}Classified`
    let sent = 0
    let failed = 0
    for (const r of emailTargets) {
      const message = [
        `Hello ${[rankShort(r.rank), r.name].filter(Boolean).join(' ') || 'Cadet'},`,
        '',
        'Your 1ATF Operational Portal access:',
        `  Student ID: ${r.idNumber}`,
        `  Temporary password: ${r.tempPassword}`,
        '',
        'To log in:',
        `  1. Go to: ${link}`,
        '  2. Click Continue and enter your Student ID number.',
        '  3. Enter the temporary password above, then choose your own password.',
        '',
        'Keep this private — do not share it. — RHQ',
      ].join('\n')
      const okOne = await sendMemberEmail({ toEmail: r.email, toName: r.name, subject: '1ATF Operational Portal — your access details', message })
      okOne ? sent++ : failed++
    }
    setEmailing(false)
    push(`Emailed ${sent} member${sent === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}`, { type: failed ? 'error' : 'success' })
    audit('Emailed temporary passwords', `${sent} sent${failed ? `, ${failed} failed` : ''}`)
  }

  return (
    <div>
      <OpsHeader title="Users" sub={`ADMIN // ROSTER (${roster.length})`}>
        <label className="btn" style={{ cursor: 'pointer' }}>
          Import spreadsheet
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onSpreadsheet} style={{ display: 'none' }} />
        </label>
        {hasTemps && <button onClick={downloadTempPasswords}>Download temp passwords</button>}
        {emailTargets.length > 0 && (
          <button onClick={emailTempPasswords} disabled={emailing}>
            {emailing ? 'Emailing…' : `Email temp passwords (${emailTargets.length})`}
          </button>
        )}
        <EmulateMenu />
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

      {selected.size > 0 && (
        <div className="panel panel-pad row between center wrap" style={{ marginBottom: 12, borderColor: 'var(--accent)', gap: 10 }}>
          <span className="accent mono">{selected.size} selected</span>
          <div className="row" style={{ gap: 8 }}>
            <button className="ghost" onClick={clearSelection}>Clear selection</button>
            <button className="danger" onClick={removeSelected}>Remove selected</button>
          </div>
        </div>
      )}

      <div className="panel" style={{ overflow: 'hidden' }}>
        <div className="table-scroll">
        <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(58,71,148,0.25)', fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: 1 }}>
              <th style={{ padding: '10px 12px', width: 34 }}>
                <input type="checkbox" aria-label="Select all shown" checked={allVisibleSelected} onChange={toggleAllVisible} style={{ width: 'auto' }} />
              </th>
              {['ID', 'NAME', 'COMPANY', 'ROLE', 'EMAIL', 'TEMP PW', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-dim)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r._id || r.idNumber} style={{ borderTop: '1px solid var(--line)', background: selected.has(r._id) ? 'rgba(54,224,192,0.08)' : 'transparent' }}>
                <td style={cell}>
                  <input type="checkbox" aria-label={`Select ${r.name || r.idNumber}`} checked={selected.has(r._id)} onChange={() => toggleOne(r._id)} style={{ width: 'auto' }} />
                </td>
                <td style={cell} className="mono">{r.idNumber}</td>
                <td style={cell}>{r.rank ? <span className="dim">{rankShort(r.rank)} </span> : ''}{r.name}</td>
                <td style={cell}>{PHONETIC[r.company] || '—'} {r.company && `(${r.company})`}</td>
                <td style={cell}><span className={r.role === 'RHQ' ? 'tag hostile' : 'tag'}>{r.role}</span></td>
                <td style={cell} className="mono dim">{r.email}</td>
                <td style={cell} className="mono">
                  {isUsed(r)
                    ? <span className="dim" title="This temporary password has been used to activate the account">USED</span>
                    : <span className="accent">{r.tempPassword || '—'}</span>}
                </td>
                <td style={cell}><button className="ghost" onClick={() => setEditing(r)} style={{ padding: '4px 10px' }}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {filtered.length === 0 && <div className="mono dim panel-pad">No matching personnel.</div>}
        {filtered.length > 300 && <div className="mono dim panel-pad">Showing first 300 of {filtered.length}. Refine your search.</div>}
      </div>

      {editing && <UserModal rec={editing} used={isUsed(editing)} onClose={() => setEditing(null)} onSave={upsert} onDelete={remove} />}
    </div>
  )
}

const cell = { padding: '9px 12px' }

// RHQ-only: open a new tab that previews what a given member would see.
function EmulateMenu() {
  const [open, setOpen] = useState(false)
  const go = (code) => {
    const url = `${location.origin}${import.meta.env.BASE_URL}?emulate=${encodeURIComponent(code)}`
    window.open(url, '_blank', 'noopener')
    setOpen(false)
  }
  const opts = [['GENERAL', 'General (no company)'], ...COMPANIES.map((c) => [c.letter, `${c.name} (${c.letter})`])]
  return (
    <div style={{ position: 'relative' }}>
      <button className="ghost" onClick={() => setOpen((o) => !o)}>Emulate user ▾</button>
      {open && (
        <div className="panel" onMouseLeave={() => setOpen(false)} style={{ position: 'absolute', right: 0, top: '110%', zIndex: 60, minWidth: 210, padding: 6 }}>
          <div className="mono dim" style={{ fontSize: 10, letterSpacing: 1, padding: '4px 8px' }}>OPEN MEMBER VIEW (NEW TAB)</div>
          {opts.map(([code, label]) => (
            <button key={code} className="ghost" onClick={() => go(code)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', textTransform: 'none', letterSpacing: 0 }}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function newUser(makeId) {
  return { _id: makeId(), name: '', idNumber: '', email: '', company: 'A', role: COMMANDER_ROLE, rank: '', tempPassword: genTempPassword(), tempIssuedAt: Date.now() }
}

function UserModal({ rec, onClose, onSave, onDelete, used }) {
  const [u, setU] = useState(rec)
  const confirm = useConfirm()
  const dialogRef = useDialog(onClose)
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
      <div ref={dialogRef} className="panel panel-pad col" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={rec.name ? 'Edit user' : 'New user'} style={{ width: 420, maxWidth: '100%' }}>
        <h2 className="accent" style={{ margin: 0, fontSize: 18 }}>{rec.name ? 'Edit User' : 'New User'}</h2>
        <Field label="Name"><input value={u.name} onChange={set('name')} /></Field>
        <div className="row" style={{ gap: 10 }}>
          <Field label="Rank">
            <select value={rankShort(u.rank)} onChange={set('rank')}>
              <option value="">— Select rank —</option>
              {RANKS.map((r) => <option key={r.short} value={r.short}>{r.long} ({r.short})</option>)}
            </select>
          </Field>
          <Field label="Student ID number"><input value={u.idNumber} onChange={set('idNumber')} placeholder="e.g. 183271" /></Field>
        </div>
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
            <input className="mono" value={u.tempPassword || ''} onChange={(e) => setU({ ...u, tempPassword: e.target.value, tempIssuedAt: Date.now() })} />
            <button className="ghost" type="button" onClick={() => setU({ ...u, tempPassword: genTempPassword(), tempIssuedAt: Date.now() })}>Regenerate</button>
          </div>
        </Field>
        {used && (
          <div className="warn mono" style={{ fontSize: 10 }}>
            This temporary password has already been used to activate the account.
          </div>
        )}
        <div className="mono dim" style={{ fontSize: 10 }}>
          The member signs in via “Log in with temporary password” using their ID + this temp password, then sets their own password.
          Regenerating and saving for an existing member resets their login so the new temp works (their old password stops working).
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
  idNumber: ['id', 'idnumber', 'id number', 'student id', 'student', 'service', 'service number', 'regimental', 'number', 'no'],
  name: ['name', 'full name', 'fullname', 'cadet', 'surname'],
  email: ['email', 'e-mail', 'mail'],
  company: ['company', 'coy', 'coy letter', 'unit', 'sub-unit', 'phonetic'],
  rank: ['rank', 'grade', 'rate'],
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
    role: COMMANDER_ROLE,
    rank: normalizeRank(get('rank')),
    tempPassword: genTempPassword(),
    tempIssuedAt: Date.now(),
  }
}
