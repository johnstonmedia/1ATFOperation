import { useData } from '../../context/DataContext'
import { useConfirm } from '../../context/ConfirmContext'
import { OpsHeader } from './OperationsCentre'

// Read-only record of RHQ actions (content saves, roster changes, password
// resets, distributions). Written via useAudit; stored in the `audit` collection
// which only RHQ can read or write.
export default function AuditLog() {
  const { state, updateSlice } = useData()
  const confirm = useConfirm()
  const entries = [...(state.audit || [])].sort((a, b) => (b.ts || 0) - (a.ts || 0))

  const clearAll = async () => {
    const ok = await confirm({
      title: 'Clear audit log',
      message: `Permanently delete all ${entries.length} audit entries? This cannot be undone.`,
      danger: true,
      confirmLabel: 'Clear all',
    })
    if (ok) updateSlice('audit', [])
  }

  return (
    <div>
      <OpsHeader title="Audit Log" sub="ADMIN // RHQ ACTIONS">
        {entries.length > 0 && <button className="danger ghost" onClick={clearAll}>Clear log</button>}
      </OpsHeader>

      {entries.length === 0 ? (
        <div className="panel panel-pad mono dim" style={{ fontSize: 13 }}>No recorded actions yet.</div>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {entries.map((e) => (
            <div key={e.id} className="panel panel-pad row between center wrap" style={{ gap: 10 }}>
              <div>
                <div className="head" style={{ fontSize: 14 }}>{e.action}</div>
                {e.detail && <div className="mono dim" style={{ fontSize: 11 }}>{e.detail}</div>}
              </div>
              <div className="mono dim" style={{ fontSize: 10, textAlign: 'right' }}>
                <div className="accent">{e.by}{e.byId ? ` · ${e.byId}` : ''}</div>
                <div>{e.ts ? new Date(e.ts).toLocaleString() : ''}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
