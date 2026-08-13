import { useState, useEffect, useCallback } from 'react'
import { useData } from '../context/DataContext'
import { useConfirm } from '../context/ConfirmContext'
import { useAudit } from '../hooks/useAudit'
import FragmentForm from './FragmentForm'
import { attachmentSummary } from '../lib/fragments'
import IntelPreview from './IntelPreview'
import LanguageWarning from './LanguageWarning'
import { PHONETIC } from '../firebase/seed'
import { listSubmissions, deleteSubmission } from '../lib/submissions'

// The Company Commander approval queue, shared by TWO surfaces:
//   - Ops Centre → Approvals (RHQ)
//   - Staff Centre → Approvals (an 'RHQ Staff' account)
// Both do exactly the same thing to the same data, so this lives in one place;
// only the page chrome differs, which is what the `Header` prop is for — pass
// OpsHeader from the Ops Centre, or a plain staff header. It must accept
// { title, sub, children }.
//
// Approving writes the fragment into the live `intel` slice and deletes the
// submission. Against live Firebase that needs the caller to be RHQ *or* RHQ
// Staff under firestore.rules — see the content/intel and intelSubmissions
// blocks there.

const opLabel = (s, isNew) => (s.op === 'delete' ? 'REMOVAL REQUEST' : isNew ? 'NEW FRAGMENT' : 'EDIT')

export default function ApprovalsQueue({ Header, intro }) {
  const { state, updateSlice } = useData()
  const confirm = useConfirm()
  const audit = useAudit()
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [reviewing, setReviewing] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setSubs(await listSubmissions())
      setDenied(false)
    } catch {
      // The rules restrict intelSubmissions to RHQ / RHQ Staff / the owning
      // commander. An honest notice beats a misleading empty queue.
      setSubs([])
      setDenied(true)
    }
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
        Header={Header}
        sub={reviewing}
        onBack={() => setReviewing(null)}
        onApprove={(frag) => publish(reviewing, frag)}
      />
    )
  }

  const liveIds = new Set(intel.map((f) => f.id))

  return (
    <div>
      <Header title="Approvals" sub={`COY SUBMISSIONS · ${pending.length} PENDING`}>
        <button className="ghost" onClick={refresh}>Refresh</button>
      </Header>

      <div className="mono dim" style={{ fontSize: 11, marginBottom: 14, maxWidth: 720 }}>
        {intro || 'Changes submitted by Company Commanders. Approve to publish to the public site, or open one to view the handouts and change anything — wording, solution, hint, document, images — before it goes live. Nothing here is live until you approve it.'}
      </div>

      {loading && <div className="panel panel-pad mono dim" style={{ fontSize: 13 }}>Loading…</div>}
      {!loading && denied && (
        <div className="panel panel-pad mono" style={{ fontSize: 12, borderColor: 'var(--hostile)', color: 'var(--hostile)' }}>
          The server would not release the approval queue for this account. It is
          restricted to RHQ, RHQ Staff and each company&rsquo;s own commander.
        </div>
      )}
      {!loading && !denied && pending.length === 0 && (
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
                  {s.op !== 'delete' && attachmentSummary(s.fragment) && (
                    <div className="mono dim" style={{ fontSize: 11, marginTop: 2 }}>{attachmentSummary(s.fragment)}</div>
                  )}
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
                    <button className="ghost" onClick={() => setReviewing(s)}>Open, view &amp; edit</button>
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

// Opened to adjust a submission before approving. This is the SAME form the
// author used (FragmentForm) — a reviewer can change every field, including the
// hint and the handouts, rather than having to bounce it back to the commander
// over a wording tweak. Audience is the one thing that isn't editable: `publish`
// stamps the submission's company back on regardless, so offering a picker here
// would only lie about what gets saved.
function ReviewFragment({ Header, sub, onBack, onApprove }) {
  const [f, setF] = useState({ ...sub.fragment, resources: sub.fragment?.resources || [] })
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const [preview, setPreview] = useState(false)

  const coy = PHONETIC[sub.company] || sub.company

  // The reviewer's real question is "does this work as a puzzle" — so give them
  // the recruit's view of the edited draft, same as both authoring screens have.
  if (preview) return <IntelPreview fragment={f} onBack={() => setPreview(false)} backLabel="← Back to review" />

  return (
    <div>
      <Header title="Review submission" sub={`${coy} · FROM ${(sub.submittedByName || 'COMMANDER').toUpperCase()}`}>
        <button className="ghost" onClick={() => setPreview(true)}>👁 Preview as recruit</button>
        <button className="ghost" onClick={onBack}>← Back to queue</button>
      </Header>

      <LanguageWarning texts={[f.title, f.prompt, f.answer, f.hint, f.reveal]} style={{ marginBottom: 14, maxWidth: 720 }} />

      <FragmentForm
        f={f}
        set={set}
        audience={
          <div className="mono dim" style={{ fontSize: 11 }}>
            Audience: <span className="accent">{coy}</span> · locked to the submitting company
          </div>
        }
      />

      <div className="row" style={{ gap: 10 }}>
        <button className="primary" onClick={() => onApprove(f)}>Approve &amp; publish</button>
        <button className="ghost" onClick={onBack}>Cancel</button>
      </div>
    </div>
  )
}
