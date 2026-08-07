import { useState, useEffect, useCallback, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useToast } from '../../context/ToastContext'
import { useAudit } from '../../hooks/useAudit'
import { OpsHeader } from './OperationsCentre'
import {
  BACKUP_KEEP, buildFullExport, describeChange, deleteBackup, downloadJson,
  formatSize, listBackups, sliceLabel, SLICE_LABELS,
} from '../../lib/backups'

// Backups — the version history of everything RHQ edits.
//
// Entries are written automatically: every save files the value it replaced
// (see DataContext.updateSlice), so this fills itself with no discipline
// required. Restoring is an ordinary save, which means it backs up what you
// are replacing first — the undo is always undoable.
//
// Nothing here is public. `backups` is RHQ-read-only under firestore.rules,
// unlike the `content/*` documents it snapshots.

const when = (t) => (t ? new Date(t).toLocaleString() : '—')
const BACKED_UP_SLICES = Object.keys(SLICE_LABELS)

export default function BackupsPanel() {
  const { state, updateSlice } = useData()
  const confirm = useConfirm()
  const { push } = useToast()
  const audit = useAudit()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState(null) // backup being previewed

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listBackups({}))
      setFailed(false)
    } catch {
      setRows([])
      setFailed(true)
    }
    setLoading(false)
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const shown = useMemo(
    () => (filter ? rows.filter((r) => r.slice === filter) : rows),
    [rows, filter],
  )
  // Which slices actually have history, for the filter buttons.
  const counts = useMemo(() => {
    const c = {}
    for (const r of rows) c[r.slice] = (c[r.slice] || 0) + 1
    return c
  }, [rows])

  const restore = async (row) => {
    const ok = await confirm({
      title: `Restore ${sliceLabel(row.slice)}`,
      message: `Replace the live ${sliceLabel(row.slice)} with this version from ${when(row.ts)}? The current version is backed up first, so this can be undone.`,
      confirmLabel: 'Restore',
      danger: true,
    })
    if (!ok) return
    await updateSlice(row.slice, row.value)
    audit('Restored from backup', `${sliceLabel(row.slice)} — version from ${when(row.ts)}`)
    push(`${sliceLabel(row.slice)} restored`)
    setOpen(null)
    setTimeout(refresh, 600) // let the new backup of the replaced value land
  }

  const remove = async (row) => {
    const ok = await confirm({
      title: 'Delete this backup',
      message: `Permanently delete the ${sliceLabel(row.slice)} version from ${when(row.ts)}? This does not affect the live site.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    await deleteBackup(row.id)
    push('Backup deleted')
    refresh()
  }

  const exportAll = () => {
    downloadJson(
      `1ATF-content-${new Date().toISOString().slice(0, 10)}.json`,
      buildFullExport(state, BACKED_UP_SLICES),
    )
    audit('Exported full content backup')
  }

  if (open) {
    return (
      <BackupPreview
        row={open}
        current={state?.[open.slice]}
        onBack={() => setOpen(null)}
        onRestore={() => restore(open)}
      />
    )
  }

  return (
    <div>
      <OpsHeader title="Backups" sub={`ADMIN // VERSION HISTORY (${rows.length})`}>
        <button className="ghost" onClick={refresh}>Refresh</button>
        <button className="primary" onClick={exportAll}>Download everything</button>
      </OpsHeader>

      <div className="mono dim" style={{ fontSize: 11, marginBottom: 14, maxWidth: 760, lineHeight: 1.7 }}>
        Every save files the version it replaced, automatically — the map, the narrative,
        the briefings, intel, branding. Open one to see what it holds, or restore it to
        put it back live. Restoring backs up the current version first, so it can be undone.
        The most recent <span className="accent">{BACKUP_KEEP}</span> versions of each
        section are kept; older ones drop off as new saves arrive.
        <br />
        <span className="dim">
          The roster is deliberately not versioned here — it holds members’ personal
          details, and copying it on every edit would spread that further for no gain.
          Use “Download temp passwords” in Users before a bulk import instead.
        </span>
      </div>

      {failed && (
        <div className="panel panel-pad mono" style={{ fontSize: 12, borderColor: 'var(--hostile)', color: 'var(--hostile)', marginBottom: 14 }}>
          Could not read the backup history. If this project’s Firestore rules have not
          been republished since the <span className="mono">backups</span> block was added,
          that is why — see HANDOVER §0. Saves still record backups regardless; only this
          list is blocked.
        </div>
      )}

      <div className="row wrap" style={{ gap: 6, marginBottom: 14 }}>
        <button className={filter ? 'ghost' : 'primary'} onClick={() => setFilter('')} style={{ fontSize: 11 }}>
          All ({rows.length})
        </button>
        {BACKED_UP_SLICES.filter((s) => counts[s]).map((s) => (
          <button key={s} className={filter === s ? 'primary' : 'ghost'} onClick={() => setFilter(s)} style={{ fontSize: 11 }}>
            {sliceLabel(s)} ({counts[s]})
          </button>
        ))}
      </div>

      {loading && <div className="panel panel-pad mono dim" style={{ fontSize: 13 }}>Loading…</div>}
      {!loading && !shown.length && !failed && (
        <div className="panel panel-pad mono dim" style={{ fontSize: 13, lineHeight: 1.7 }}>
          No backups yet. One is filed the first time you save a change to any section —
          there is nothing to keep until something is replaced.
        </div>
      )}

      <div className="col" style={{ gap: 10 }}>
        {shown.map((r) => (
          <div key={r.id} className="panel panel-pad row between center wrap" style={{ gap: 12 }}>
            <div style={{ minWidth: 240 }}>
              <div className="row center wrap" style={{ gap: 8 }}>
                <span className="tag">{sliceLabel(r.slice)}</span>
                <span className="mono dim" style={{ fontSize: 11 }}>{when(r.ts)}</span>
              </div>
              <div className="mono dim" style={{ fontSize: 11, marginTop: 6 }}>
                {describeChange(r.slice, r.value, state?.[r.slice])}
              </div>
              <div className="mono dim" style={{ fontSize: 10, marginTop: 2 }}>
                {formatSize(r.size)}{r.by ? ` · replaced by ${r.by}` : ''}
              </div>
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              <button className="ghost" onClick={() => setOpen(r)} style={{ fontSize: 11 }}>Open</button>
              <button className="ghost" onClick={() => downloadJson(`1ATF-${r.slice}-${r.ts}.json`, r.value)} style={{ fontSize: 11 }}>Download</button>
              <button className="primary" onClick={() => restore(r)} style={{ fontSize: 11 }}>Restore</button>
              <button className="danger ghost" onClick={() => remove(r)} style={{ fontSize: 11 }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// A single version, side by side with what is live. Text slices show their
// fields; the map shows its grid rendered rather than 24,000 characters of
// letters, which would tell RHQ nothing.
function BackupPreview({ row, current, onBack, onRestore }) {
  return (
    <div>
      <OpsHeader title={sliceLabel(row.slice)} sub={`BACKUP // ${when(row.ts).toUpperCase()}`}>
        <button className="ghost" onClick={onBack}>← Back to list</button>
        <button className="primary" onClick={onRestore}>Restore this version</button>
      </OpsHeader>

      <div className="panel panel-pad col" style={{ marginBottom: 14, maxWidth: 900 }}>
        <div className="mono dim" style={{ fontSize: 11, lineHeight: 1.7 }}>
          Compared with what is live now: <span className="accent">{describeChange(row.slice, row.value, current)}</span>
          <br />
          Saved {when(row.ts)}{row.by ? ` · replaced by ${row.by}` : ''} · {formatSize(row.size)}
        </div>
      </div>

      <div className="panel panel-pad col" style={{ maxWidth: 900 }}>
        <div className="mono accent" style={{ fontSize: 10, letterSpacing: 2 }}>CONTENT OF THIS VERSION</div>
        <ValueView slice={row.slice} value={row.value} />
      </div>
    </div>
  )
}

function ValueView({ slice, value }) {
  // The territory grid is one enormous string of cell letters — dumping it is
  // useless. Summarise it and let Restore + the map editor do the looking.
  if (slice === 'territory') {
    const cells = value?.cells || ''
    const held = {}
    for (const ch of cells) {
      if (ch === '.') continue
      const k = ch.toUpperCase()
      held[k] = (held[k] || 0) + 1
    }
    return (
      <div className="col" style={{ gap: 8 }}>
        <div className="mono dim" style={{ fontSize: 12 }}>
          {value?.cols} × {value?.rows} grid · {(value?.places?.length || 0)} place name{(value?.places?.length || 0) === 1 ? '' : 's'} · RHQ marker {value?.showRHQ ? 'shown' : 'hidden'}
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          {Object.entries(held).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
            <span key={k} className="tag mono" style={{ fontSize: 11 }}>{k}: {n.toLocaleString()} cells</span>
          ))}
        </div>
        {value?.places?.length > 0 && (
          <div className="mono dim" style={{ fontSize: 11, lineHeight: 1.7 }}>
            {value.places.map((p) => p.name).join(' · ')}
          </div>
        )}
      </div>
    )
  }
  return (
    <pre
      className="mono"
      style={{ fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 520, overflow: 'auto', margin: 0 }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}
