import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import Logo from '../components/Logo'
import LoginModal from '../components/LoginModal'
import DocEmbed from '../components/DocEmbed'
import LanguageWarning from '../components/LanguageWarning'
import { Field } from './ops/NarrativeEditor'
import { PHONETIC } from '../firebase/seed'
import {
  listSubmissions, createSubmission, updateSubmission, deleteSubmission, newSubmission,
} from '../lib/submissions'

const rid = () => Math.random().toString(36).slice(2, 10)

// COY Centre — a Company Commander edits ONLY their own company's intel. Nothing
// they do goes live directly: each change is submitted to RHQ for approval.
export default function CommanderPanel() {
  const { user, isCommander, logout } = useAuth()
  const { state } = useData()
  const { push } = useToast()
  const confirm = useConfirm()
  const [authOpen, setAuthOpen] = useState(false)
  const [subs, setSubs] = useState([])
  const [editing, setEditing] = useState(null)

  const company = user?.company || ''
  const coyName = PHONETIC[company] || company

  const refresh = useCallback(async () => {
    if (!company) return
    try { setSubs(await listSubmissions({ company })) } catch { /* offline / rules */ }
  }, [company])

  useEffect(() => { if (isCommander) refresh() }, [isCommander, refresh])

  // Gate: Company Commanders only. URL-only page — reached via the "COY CENTRE"
  // button that appears once a commander signs in.
  if (!user || !isCommander) {
    return (
      <div className="col center" style={{ minHeight: '100vh', gap: 16, padding: 24, textAlign: 'center' }}>
        <Logo size={90} />
        <div className="head accent" style={{ letterSpacing: 3 }}>COY CENTRE</div>
        <div className="mono dim" style={{ fontSize: 12, maxWidth: 420 }}>
          {user
            ? 'This area is for Company Commanders. Your account does not have that role.'
            : 'Sign in with your Company Commander account to manage your company’s intelligence.'}
        </div>
        {!user && <button className="primary" onClick={() => setAuthOpen(true)}>Sign in</button>}
        <Link to="/" className="mono dim" style={{ fontSize: 11 }}>← Return to portal</Link>
        {authOpen && <LoginModal onClose={() => setAuthOpen(false)} />}
      </div>
    )
  }

  const liveIntel = (state.intel || []).filter((f) => f.company === company)
  const pendingFor = (fragId) => subs.find((s) => s.status === 'pending' && s.fragment?.id === fragId)
  // New-fragment submissions (not editing an existing live fragment).
  const liveIds = new Set(liveIntel.map((f) => f.id))
  const newPending = subs.filter((s) => s.status === 'pending' && !liveIds.has(s.fragment?.id))

  const blank = () => ({ id: rid(), company, title: '', prompt: '', answer: '', reveal: '', resources: [], docUrl: '', ts: Date.now() })

  // Submit an add/edit. If a pending submission already targets this fragment,
  // update it in place so the queue keeps one entry per fragment.
  const submit = async (fragment) => {
    const frag = { ...fragment, company } // never let a commander retarget another company
    const existing = pendingFor(frag.id)
    if (existing) {
      await updateSubmission(existing.id, { fragment: frag, op: 'upsert', submittedAt: Date.now(), status: 'pending' })
    } else {
      await createSubmission(newSubmission({ company, fragment: frag, op: 'upsert', by: user }))
    }
    push('Submitted to RHQ for approval')
    setEditing(null)
    refresh()
  }

  const requestRemoval = async (frag) => {
    if (!(await confirm({ title: 'Request removal', message: `Ask RHQ to remove “${frag.title || 'this fragment'}” from the public site?`, danger: true, confirmLabel: 'Request removal' }))) return
    const existing = pendingFor(frag.id)
    if (existing) await updateSubmission(existing.id, { op: 'delete', fragment: frag, submittedAt: Date.now(), status: 'pending' })
    else await createSubmission(newSubmission({ company, fragment: frag, op: 'delete', by: user }))
    push('Removal requested — awaiting RHQ')
    refresh()
  }

  const withdraw = async (sub) => {
    if (!(await confirm({ title: 'Withdraw submission', message: 'Withdraw this pending change? RHQ will no longer see it.', confirmLabel: 'Withdraw' }))) return
    await deleteSubmission(sub.id)
    push('Submission withdrawn')
    refresh()
  }

  if (editing) {
    const pending = pendingFor(editing.id)
    return (
      <CoyBuilder
        fragment={editing}
        coyName={coyName}
        note={pending ? 'You have a pending version awaiting RHQ — saving updates it.' : ''}
        onCancel={() => setEditing(null)}
        onSubmit={submit}
      />
    )
  }

  return (
    <div className="container" style={{ padding: '24px 20px', maxWidth: 900 }}>
      <div className="row between center wrap" style={{ gap: 12, marginBottom: 6 }}>
        <div className="row center" style={{ gap: 12 }}>
          <Logo size={40} />
          <div>
            <div className="mono accent" style={{ fontSize: 10, letterSpacing: 3 }}>COY CENTRE · {coyName?.toUpperCase()}</div>
            <h1 style={{ margin: '2px 0 0', fontSize: 24, color: '#fff' }}>Company Intelligence</h1>
          </div>
        </div>
        <div className="row center" style={{ gap: 8 }}>
          <Link to="/intel" className="mono dim" style={{ fontSize: 11 }}>View public page →</Link>
          <button className="ghost" onClick={logout}>Sign out</button>
        </div>
      </div>

      <div className="panel panel-pad mono dim" style={{ fontSize: 12, lineHeight: 1.6, margin: '10px 0 18px' }}>
        You edit <span className="accent">{coyName}</span> intelligence only. Changes are <strong>not</strong> published
        straight away — each one is sent to RHQ, who approves it (or adjusts it first) before it appears on the public site.
        <div className="row center" style={{ gap: 8, marginTop: 10 }}>
          <StatusChip status="live" /> <span>already on the public site</span>
          <StatusChip status="pending" /> <span>waiting for RHQ approval</span>
        </div>
      </div>

      <div className="row between center" style={{ marginBottom: 12 }}>
        <strong className="head" style={{ fontSize: 15 }}>Your intel fragments</strong>
        <button className="primary" onClick={() => setEditing(blank())}>+ New fragment</button>
      </div>

      {liveIntel.length === 0 && newPending.length === 0 && (
        <div className="panel panel-pad mono dim" style={{ fontSize: 13 }}>
          No intel for {coyName} yet. Use “+ New fragment” to draft one and submit it to RHQ.
        </div>
      )}

      <div className="col" style={{ gap: 12 }}>
        {liveIntel.map((f) => {
          const p = pendingFor(f.id)
          return (
            <div key={f.id} className="panel panel-pad col" style={{ gap: 8 }}>
              <div className="row between center wrap" style={{ gap: 10 }}>
                <div>
                  <div className="head" style={{ fontSize: 15 }}>{f.title || 'Untitled fragment'}</div>
                  <div className="mono dim" style={{ fontSize: 11 }}>solution: <span className="accent">{f.answer || '—'}</span></div>
                </div>
                <div className="row center" style={{ gap: 8 }}>
                  <StatusChip status="live" />
                  {p && <StatusChip status="pending" label={p.op === 'delete' ? 'REMOVAL PENDING' : 'EDIT PENDING'} />}
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="ghost" onClick={() => setEditing(p && p.op === 'upsert' ? p.fragment : f)}>Edit</button>
                {p
                  ? <button className="ghost" onClick={() => withdraw(p)}>Withdraw pending change</button>
                  : <button className="danger ghost" onClick={() => requestRemoval(f)}>Request removal</button>}
              </div>
            </div>
          )
        })}

        {newPending.map((s) => (
          <div key={s.id} className="panel panel-pad col" style={{ gap: 8, borderColor: 'var(--accent)' }}>
            <div className="row between center wrap" style={{ gap: 10 }}>
              <div>
                <div className="head" style={{ fontSize: 15 }}>{s.fragment?.title || 'Untitled fragment'}</div>
                <div className="mono dim" style={{ fontSize: 11 }}>solution: <span className="accent">{s.fragment?.answer || '—'}</span></div>
              </div>
              <StatusChip status="pending" label="NEW — PENDING" />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="ghost" onClick={() => setEditing(s.fragment)}>Edit</button>
              <button className="ghost" onClick={() => withdraw(s)}>Withdraw</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusChip({ status, label }) {
  const live = status === 'live'
  return (
    <span
      className="mono"
      style={{
        fontSize: 10, letterSpacing: 1, padding: '2px 8px', borderRadius: 20,
        border: `1px solid ${live ? 'var(--accent)' : '#ffcf4a'}`,
        color: live ? 'var(--accent)' : '#ffcf4a',
      }}
    >
      {label || (live ? 'LIVE' : 'PENDING')}
    </span>
  )
}

// Simplified, company-locked fragment editor for commanders.
function CoyBuilder({ fragment, coyName, note, onCancel, onSubmit }) {
  const [f, setF] = useState({ ...fragment, resources: fragment.resources || [] })
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const [resDraft, setResDraft] = useState({ title: '', url: '' })

  const addLink = () => {
    if (!resDraft.url.trim()) return
    set('resources', [...f.resources, { id: rid(), type: 'link', title: resDraft.title.trim() || resDraft.url.trim(), url: resDraft.url.trim() }])
    setResDraft({ title: '', url: '' })
  }
  const addImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 150 * 1024) { e.target.value = ''; return }
    const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file) })
    set('resources', [...f.resources, { id: rid(), type: 'image', title: file.name, url }])
    e.target.value = ''
  }
  const delRes = (id) => set('resources', f.resources.filter((r) => r.id !== id))

  return (
    <div className="container" style={{ padding: '24px 20px', maxWidth: 760 }}>
      <div className="row between center" style={{ marginBottom: 18 }}>
        <div>
          <div className="mono accent" style={{ fontSize: 10, letterSpacing: 3 }}>COY CENTRE · {coyName?.toUpperCase()} · DRAFT</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 22, color: '#fff' }}>Edit fragment</h1>
        </div>
        <button className="ghost" onClick={onCancel}>← Back</button>
      </div>

      <LanguageWarning texts={[f.title, f.prompt, f.answer, f.reveal]} style={{ marginBottom: 14 }} />

      <div className="panel panel-pad col" style={{ marginBottom: 16 }}>
        <div className="mono dim" style={{ fontSize: 11 }}>Audience: <span className="accent">{coyName} (your company)</span></div>
        <Field label="Title"><input value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Coded message / instructions (what the cadet sees)">
          <textarea rows={3} value={f.prompt} onChange={(e) => set('prompt', e.target.value)} placeholder="e.g. Decode the Morse:  -.-. .- -- .--." />
        </Field>
        <Field label="Solution (the decoded words — cadet gets one box per word)">
          <input className="mono" value={f.answer} onChange={(e) => set('answer', e.target.value)} placeholder="e.g. CAMP AT SINGLETON" />
        </Field>
        <Field label="Revealed intel (shown once they decode it)">
          <textarea rows={3} value={f.reveal} onChange={(e) => set('reveal', e.target.value)} placeholder="e.g. Depart 0700 Sat 12 Apr, Singleton. Bring webbing + boots." />
        </Field>
        <Field label="Embedded document (optional URL — direct PDF/image or Google Drive)">
          <input value={f.docUrl} onChange={(e) => set('docUrl', e.target.value)} placeholder="docs/brief.pdf · https://… · Drive link" />
        </Field>
        {f.docUrl.trim() && <DocEmbed url={f.docUrl} height={280} />}
      </div>

      <div className="panel panel-pad col" style={{ marginBottom: 16 }}>
        <strong className="head" style={{ fontSize: 14 }}>Resources (optional — e.g. a Morse-code chart)</strong>
        <div className="col" style={{ gap: 6 }}>
          {f.resources.map((r) => (
            <div key={r.id} className="row between center" style={{ gap: 8, borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
              <span className="mono" style={{ fontSize: 12 }}>{r.type === 'image' ? '🖼' : '🔗'} {r.title}</span>
              <button className="danger ghost" onClick={() => delRes(r.id)} style={{ padding: '2px 8px' }}>Remove</button>
            </div>
          ))}
        </div>
        <div className="row wrap" style={{ gap: 8, alignItems: 'flex-end' }}>
          <div className="grow" style={{ minWidth: 140 }}><Field label="Link title"><input value={resDraft.title} onChange={(e) => setResDraft({ ...resDraft, title: e.target.value })} /></Field></div>
          <div className="grow" style={{ minWidth: 180 }}><Field label="Link URL"><input value={resDraft.url} onChange={(e) => setResDraft({ ...resDraft, url: e.target.value })} placeholder="https://…" /></Field></div>
          <button className="ghost" onClick={addLink}>+ Add link</button>
          <label className="btn ghost" style={{ cursor: 'pointer', padding: '8px 12px' }}>+ Image<input type="file" accept="image/*" onChange={addImage} style={{ display: 'none' }} /></label>
        </div>
      </div>

      {note && <div className="mono" style={{ fontSize: 11, color: '#ffcf4a', marginBottom: 10 }}>{note}</div>}
      <div className="row" style={{ gap: 10 }}>
        <button className="primary" onClick={() => onSubmit(f)}>Submit for approval</button>
        <button className="ghost" onClick={onCancel}>Cancel</button>
      </div>
      <div className="mono dim" style={{ fontSize: 10, marginTop: 8 }}>
        This does not publish immediately — RHQ reviews it, may adjust it, then makes it live.
      </div>
    </div>
  )
}
