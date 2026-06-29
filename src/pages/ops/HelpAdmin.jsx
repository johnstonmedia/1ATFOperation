import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useAudit } from '../../hooks/useAudit'
import { OpsHeader } from './OperationsCentre'
import { genTempPassword } from '../../lib/passwords'
import { getAuthVersion, setAuthVersion } from '../../lib/store'

const cleanId = (id) => String(id).trim().toLowerCase().replace(/[^a-z0-9]/g, '')
const when = (ts) => (ts ? new Date(ts).toLocaleString() : '')

// Operations Centre → Help. Three tabs: Support messages, password Reset
// requests, and Account Issue messages. Support/Account come from the public
// Help form; Reset requests from "Forgot password" on the login screen.
export default function HelpAdmin() {
  const { state, updateSlice } = useData()
  const [tab, setTab] = useState('support')

  const support = state.support || []
  const resets = state.resetRequests || []

  const supportMsgs = support.filter((m) => (m.category || 'Support') === 'Support')
  const accountMsgs = support.filter((m) => m.category === 'Account Issue')

  const setSupport = (rows) => updateSlice('support', rows)
  const setResets = (rows) => updateSlice('resetRequests', rows)

  const tabs = [
    ['support', `Support (${supportMsgs.filter((m) => m.status !== 'resolved').length})`],
    ['reset', `Reset Password (${resets.filter((r) => r.status === 'open').length})`],
    ['account', `Account Issues (${accountMsgs.filter((m) => m.status !== 'resolved').length})`],
  ]

  return (
    <div>
      <OpsHeader title="Help" sub="ADMIN // SUPPORT & REQUESTS" />
      <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map(([id, label]) => (
          <button key={id} className={tab === id ? 'primary' : 'ghost'} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'support' && <Messages list={supportMsgs} all={support} onChange={setSupport} empty="No support messages." />}
      {tab === 'account' && <Messages list={accountMsgs} all={support} onChange={setSupport} empty="No account-issue messages." />}
      {tab === 'reset' && <ResetRequests resets={resets} state={state} setResets={setResets} updateSlice={updateSlice} />}
    </div>
  )
}

function Messages({ list, all, onChange, empty }) {
  const confirm = useConfirm()
  const resolve = (id) => onChange(all.map((m) => (m.id === id ? { ...m, status: 'resolved' } : m)))
  const remove = async (id) => {
    if (!(await confirm({ title: 'Delete message', message: 'Permanently delete this message?', danger: true, confirmLabel: 'Delete' }))) return
    onChange(all.filter((m) => m.id !== id))
  }
  if (list.length === 0) return <div className="panel panel-pad mono dim" style={{ fontSize: 13 }}>{empty}</div>
  return (
    <div className="col" style={{ gap: 12 }}>
      {list.sort((a, b) => (b.ts || 0) - (a.ts || 0)).map((m) => (
        <div key={m.id} className="panel panel-pad col" style={{ gap: 6, opacity: m.status === 'resolved' ? 0.55 : 1 }}>
          <div className="row between center wrap" style={{ gap: 8 }}>
            <strong>{m.name || 'Anonymous'} <span className="mono dim" style={{ fontSize: 11 }}>{m.contact}</span></strong>
            <div className="row center" style={{ gap: 6 }}>
              {m.code && <span className="tag hostile">{m.code}</span>}
              {m.auto && <span className="tag">AUTO</span>}
              <span className="mono dim" style={{ fontSize: 10 }}>{when(m.ts)}</span>
            </div>
          </div>
          <div className="mono" style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{m.message}</div>
          <div className="row" style={{ gap: 8 }}>
            {m.status !== 'resolved'
              ? <button className="ghost" onClick={() => resolve(m.id)}>Mark resolved</button>
              : <span className="tag live">RESOLVED</span>}
            <button className="danger ghost" onClick={() => remove(m.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function ResetRequests({ resets, state, setResets, updateSlice }) {
  const [working, setWorking] = useState(null)
  const confirm = useConfirm()
  const audit = useAudit()

  const doReset = async (req) => {
    setWorking(req.id)
    try {
      const idc = cleanId(req.idNumber)
      const v = await getAuthVersion(idc)
      await setAuthVersion(idc, v + 1) // invalidate the old credential
      const newTemp = genTempPassword()
      // Store the new temp password on the member's roster record.
      const matched = (state.roster || []).some((r) => String(r.idNumber).trim() === String(req.idNumber).trim())
      if (matched) {
        updateSlice('roster', state.roster.map((r) =>
          String(r.idNumber).trim() === String(req.idNumber).trim() ? { ...r, tempPassword: newTemp } : r,
        ))
      }
      setResets(resets.map((x) => (x.id === req.id
        ? { ...x, status: 'resolved', newTempPassword: newTemp, matched, resolvedTs: Date.now() }
        : x)))
      audit('Reset password', `ID ${req.idNumber}${matched ? '' : ' (no roster match)'}`)
    } finally {
      setWorking(null)
    }
  }

  const remove = async (id) => {
    if (!(await confirm({ title: 'Clear request', message: 'Clear this reset request from the list?', danger: true, confirmLabel: 'Clear' }))) return
    setResets(resets.filter((x) => x.id !== id))
  }
  if (resets.length === 0) return <div className="panel panel-pad mono dim" style={{ fontSize: 13 }}>No password-reset requests.</div>

  return (
    <div className="col" style={{ gap: 12 }}>
      {resets.sort((a, b) => (b.ts || 0) - (a.ts || 0)).map((r) => (
        <div key={r.id} className="panel panel-pad col" style={{ gap: 8 }}>
          <div className="row between center wrap" style={{ gap: 8 }}>
            <strong className="mono">ID {r.idNumber}</strong>
            <span className="mono dim" style={{ fontSize: 10 }}>{when(r.ts)}</span>
          </div>
          {r.status === 'open' ? (
            <button className="primary" disabled={working === r.id} onClick={() => doReset(r)} style={{ alignSelf: 'flex-start' }}>
              {working === r.id ? 'Resetting…' : 'Reset password'}
            </button>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              <div className="row center" style={{ gap: 10, flexWrap: 'wrap' }}>
                <span className="tag live">NEW TEMP PASSWORD</span>
                <span className="mono accent" style={{ fontSize: 16, letterSpacing: 2 }}>{r.newTempPassword}</span>
              </div>
              <div className="mono dim" style={{ fontSize: 11 }}>
                Give this to the member. They log in via “Log in with temporary password”, then set a new password.
                {r.matched === false && <span className="hostile"> · Warning: no roster record for this ID — add them in Users first.</span>}
              </div>
              <button className="danger ghost" onClick={() => remove(r.id)} style={{ alignSelf: 'flex-start' }}>Clear</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
