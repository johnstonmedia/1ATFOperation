import { useState, useEffect, useCallback } from 'react'
import { useData } from '../../context/DataContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useAudit } from '../../hooks/useAudit'
import { OpsHeader } from './OperationsCentre'
import { Field } from './NarrativeEditor'
import DocEmbed from '../../components/DocEmbed'
import LanguageWarning from '../../components/LanguageWarning'
import { PHONETIC } from '../../firebase/seed'
import { listSubmissions, deleteSubmission } from '../../lib/submissions'

const rid = () => Math.random().toString(36).slice(2, 10)
const opLabel = (s, isNew) => (s.op === 'delete' ? 'REMOVAL REQUEST' : isNew ? 'NEW FRAGMENT' : 'EDIT')

// RHQ approval queue. Company Commanders submit intel changes here; RHQ approves
// them as-is or edits first, then publishes to the live `intel` slice.
export default function SubmissionsEditor() {
  const { state, updateSlice } = useData()
  const confirm = useConfirm()
  const audit = useAudit()
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setSubs(await listSubmissions()) } catch { setSubs([]) }
    setLoading(false)
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const intel = state.intel || []
  const pending = subs.filter((s) => s.status === 'pending')

  // Publish a submission's fragment to the live intel slice, then clear it.
  const publish = async (sub, fragmentOverride) => {
    const frag = { ...(fragmentOverride || sub.fragment), company: sub.company }
    let next
    if (sub.op === 'delete') {
      next = intel.filter((x) => x.id !== frag.id)
    } else {
      next = intel.some((x) => x.id === frag.id)
        ? intel.map((x) => (x.id === frag.id ? frag : x))
        : [...intel, frag]
    }
    await updateSlice('intel', next)
    await deleteSubmission(sub.id)
    audit(
      sub.op === 'delete' ? 'Removed intel (approved)' : 'Published intel (approved)',
      `${PHONETIC[sub.company] || sub.company}: “${frag.title || 'untitled'}” — from ${sub.submittedByName || 'commander'}`,
    )
    setReviewing(null)
    refresh()
  }

  const dismiss = async (sub) => {
    if (!(await confirm({ title: 'Dismiss submission', message: `Discard this ${PHONETIC[sub.company] || sub.company} submission without publishing? The commander can resubmit.`, danger: true, confirmLabel: 'Dismiss' }))) return
    await deleteSubmission(sub.id)
    audit('Dismissed intel submission', `${PHONETIC[sub.company] || sub.company}: “${sub.fragment?.title || 'untitled'}”`)
    refresh()
  }

  if (reviewing) {
    return (
      <ReviewFragment
        sub={reviewing}
        onBack={() => setReviewing(null)}
        onApprove={(frag) => publish(reviewing, frag)}
      />
    )
  }

  const liveIds = new Set(intel.map((f) => f.id))

  return (
    <div>
      <OpsHeader title="Approvals" sub={`COY SUBMISSIONS · ${pending.length} PENDING`}>
        <button className="ghost" onClick={refresh}>Refresh</button>
      </OpsHeader>

      <div className="mono dim" style={{ fontSize: 11, marginBottom: 14, maxWidth: 720 }}>
        Changes submitted by Company Commanders. Approve to publish to the public site, or open one to adjust the wording first.
        Nothing here is live until you approve it.
      </div>

      {loading && <div className="panel panel-pad mono dim" style={{ fontSize: 13 }}>Loading…</div>}
      {!loading && pending.length === 0 && (
        <div className="panel panel-pad mono dim" style={{ fontSize: 13 }}>No pending submissions. 🎉</div>
      )}

      <div className="col" style={{ gap: 12 }}>
        {pending.map((s) => {
          const isNew = s.op !== 'delete' && !liveIds.has(s.fragment?.id)
          return (
            <div key={s.id} className="panel panel-pad col" style={{ gap: 10, borderColor: s.op === 'delete' ? 'var(--hostile)' : 'var(--accent)' }}>
              <div className="row between center wrap" style={{ gap: 10 }}>
                <div>
                  <div className="row center" style={{ gap: 8 }}>
                    <span className="tag">{PHONETIC[s.company] || s.company}</span>
                    <span className="mono" style={{ fontSize: 10, letterSpacing: 1, color: s.op === 'delete' ? 'var(--hostile)' : '#ffcf4a' }}>{opLabel(s, isNew)}</span>
                  </div>
                  <div className="head" style={{ fontSize: 15, marginTop: 6 }}>{s.fragment?.title || 'Untitled fragment'}</div>
                  <div className="mono dim" style={{ fontSize: 11 }}>
                    solution: <span className="accent">{s.fragment?.answer || '—'}</span>
                    {s.submittedByName ? ` · by ${s.submittedByName}` : ''}
                  </div>
                </div>
              </div>

              {s.op === 'delete' ? (
                <div className="mono" style={{ fontSize: 12, color: 'var(--hostile)' }}>
                  Commander is asking to remove this fragment from the public site.
                </div>
              ) : (
                <div className="mono dim" style={{ fontSize: 12, whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 10 }}>
                  {s.fragment?.reveal || s.fragment?.prompt || '(no body)'}
                </div>
              )}

              <div className="row wrap" style={{ gap: 8 }}>
                {s.op === 'delete' ? (
                  <button className="danger" onClick={() => publish(s)}>Approve removal</button>
                ) : (
                  <>
                    <button className="primary" onClick={() => publish(s)}>Approve &amp; publish</button>
                    <button className="ghost" onClick={() => setReviewing(s)}>Review / edit first</button>
                  </>
                )}
                <button className="danger ghost" onClick={() => dismiss(s)}>Dismiss</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// RHQ opens a submission to adjust the wording before approving.
function ReviewFragment({ sub, onBack, onApprove }) {
  const [f, setF] = useState({ ...sub.fragment, resources: sub.fragment?.resources || [] })
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const [resDraft, setResDraft] = useState({ title: '', url: '' })

  const addLink = () => {
    if (!resDraft.url.trim()) return
    set('resources', [...f.resources, { id: rid(), type: 'link', title: resDraft.title.trim() || resDraft.url.trim(), url: resDraft.url.trim() }])
    setResDraft({ title: '', url: '' })
  }
  const delRes = (id) => set('resources', f.resources.filter((r) => r.id !== id))

  return (
    <div>
      <OpsHeader title="Review submission" sub={`${PHONETIC[sub.company] || sub.company} · FROM ${(sub.submittedByName || 'COMMANDER').toUpperCase()}`}>
        <button className="ghost" onClick={onBack}>← Back to queue</button>
      </OpsHeader>

      <LanguageWarning texts={[f.title, f.prompt, f.answer, f.reveal]} style={{ marginBottom: 14 }} />

      <div className="panel panel-pad col" style={{ marginBottom: 16, maxWidth: 720 }}>
        <Field label="Title"><input value={f.title || ''} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Coded message / instructions">
          <textarea rows={3} value={f.prompt || ''} onChange={(e) => set('prompt', e.target.value)} />
        </Field>
        <Field label="Solution (decoded words)">
          <input className="mono" value={f.answer || ''} onChange={(e) => set('answer', e.target.value)} />
        </Field>
        <Field label="Revealed intel">
          <textarea rows={3} value={f.reveal || ''} onChange={(e) => set('reveal', e.target.value)} />
        </Field>
        <Field label="Embedded document (optional URL)">
          <input value={f.docUrl || ''} onChange={(e) => set('docUrl', e.target.value)} />
        </Field>
        {f.docUrl?.trim() && <DocEmbed url={f.docUrl} height={280} />}
      </div>

      {f.resources?.length > 0 && (
        <div className="panel panel-pad col" style={{ marginBottom: 16, maxWidth: 720 }}>
          <strong className="head" style={{ fontSize: 14 }}>Resources</strong>
          {f.resources.map((r) => (
            <div key={r.id} className="row between center" style={{ gap: 8, borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
              <span className="mono" style={{ fontSize: 12 }}>{r.type === 'image' ? '🖼' : '🔗'} {r.title}</span>
              <button className="danger ghost" onClick={() => delRes(r.id)} style={{ padding: '2px 8px' }}>Remove</button>
            </div>
          ))}
          <div className="row wrap" style={{ gap: 8, alignItems: 'flex-end' }}>
            <div className="grow" style={{ minWidth: 140 }}><Field label="Link title"><input value={resDraft.title} onChange={(e) => setResDraft({ ...resDraft, title: e.target.value })} /></Field></div>
            <div className="grow" style={{ minWidth: 180 }}><Field label="Link URL"><input value={resDraft.url} onChange={(e) => setResDraft({ ...resDraft, url: e.target.value })} placeholder="https://…" /></Field></div>
            <button className="ghost" onClick={addLink}>+ Add link</button>
          </div>
        </div>
      )}

      <div className="row" style={{ gap: 10 }}>
        <button className="primary" onClick={() => onApprove(f)}>Approve &amp; publish</button>
        <button className="ghost" onClick={onBack}>Cancel</button>
      </div>
    </div>
  )
}
