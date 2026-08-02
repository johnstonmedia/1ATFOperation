import { useState, useRef } from 'react'
import { useData } from '../../context/DataContext'
import { useAudit } from '../../hooks/useAudit'
import { useConfirm } from '../../context/ConfirmContext'
import { OpsHeader, useSaved } from './OperationsCentre'
import PixelMap from '../../components/PixelMap'
import { PAINT, RHQ_PAINT, colorOf } from '../../lib/territory'
import { useOceanMask } from '../../lib/oceanMask'
import { EMPTY_CAMPAIGN, campaignValid, appendSave } from '../../lib/campaign'
import { exportCampaignReplay, exportSupported, downloadBlob } from '../../lib/replayExport'

const rid = () => Math.random().toString(36).slice(2, 9)

// Pixel-grid territory editor. Pick a colour state, paint cells on the map.
export default function MapEditor() {
  const { state, updateSlice } = useData()
  const audit = useAudit()
  const [saved, flash] = useSaved()
  const [terr, setTerr] = useState(() => ({ ...state.territory, places: state.territory.places || [] }))
  const [brush, setBrush] = useState('M')
  const [size, setSize] = useState(2)

  const { cols, rows } = terr
  const oceanMask = useOceanMask(cols, rows)

  // `points` is the whole stroke segment since the last pointer event (the
  // map interpolates a continuous line between samples) — stamped in one
  // state update so long fast strokes don't rebuild the cell string per cell.
  const paint = (points, code, sz) => {
    setTerr((t) => {
      const arr = t.cells.split('')
      // NxN brush, e.g. size=2 covers cells [-1,0] relative to (x,y) so a 2x2
      // block actually paints 2x2 (previously floor((sz-1)/2) collapsed even
      // sizes like 2 down to a single cell).
      const half = Math.floor(sz / 2)
      for (const { x, y } of points) {
        for (let dy = -half; dy < sz - half; dy++) for (let dx = -half; dx < sz - half; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue
          if (code !== '.' && oceanMask && oceanMask[ny * cols + nx]) continue // can't paint ocean
          arr[ny * cols + nx] = code
        }
      }
      return { ...t, cells: arr.join('') }
    })
  }
  const movePlace = (id, x, y) => setTerr((t) => ({ ...t, places: t.places.map((p) => (p.id === id ? { ...p, x, y } : p)) }))
  const addPlace = () => setTerr((t) => ({ ...t, places: [...t.places, { id: rid(), name: 'New place', x: Math.round(cols / 2), y: Math.round(rows / 2) }] }))
  const addStronghold = () => setTerr((t) => ({ ...t, places: [...t.places, { id: rid(), name: 'Meridian Stronghold', x: Math.round(cols / 2), y: Math.round(rows / 2), hostile: true }] }))
  const setPlace = (id, patch) => setTerr((t) => ({ ...t, places: t.places.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  const delPlace = (id) => setTerr((t) => ({ ...t, places: t.places.filter((p) => p.id !== id) }))
  const clearAll = () => setTerr((t) => ({ ...t, cells: '.'.repeat(cols * rows) }))

  // Saving the map also records the change as a campaign-replay move (when a
  // start state has been selected and any cells actually changed).
  const campaign = state.campaign
  const save = () => {
    updateSlice('territory', terr)
    audit('Updated map territory')
    if (campaignValid(campaign, cols, rows)) {
      const next = appendSave(campaign, terr.cells)
      if (next) {
        updateSlice('campaign', next)
        audit('Recorded campaign move', `move ${next.timeline.length}`)
      }
    }
    flash()
  }

  const swatches = [...PAINT, ...(terr.showRHQ ? [RHQ_PAINT] : [])]

  return (
    <div>
      <OpsHeader title="Map: Territory" sub="EDIT // PIXEL TERRITORY" updatedAt={state.contentMeta?.territory?.updatedAt}>
        <label className="row center" style={{ gap: 6, fontSize: 11 }}>
          <input type="checkbox" checked={!!terr.showRHQ} onChange={(e) => setTerr((t) => ({ ...t, showRHQ: e.target.checked }))} style={{ width: 'auto' }} /> Show RHQ on map
        </label>
        <button className="primary" onClick={save}>{saved ? 'Saved ✓' : 'Save map'}</button>
      </OpsHeader>

      <div className="mono dim" style={{ fontSize: 11, marginBottom: 10 }}>
        Pick a colour, then paint on the map — one finger/click paints, pinch or scroll zooms (anchored under your fingers/cursor), two-finger drag or middle/right-mouse drag pans while zoomed. Ocean tiles (shaded dark) can't be painted. "Full" is solid/firmly held; "Contested" is the lighter, newly-gained/loosely-held variant. Erase removes.
      </div>

      {[{ label: 'Full', variant: (c) => c }, { label: 'Contested', variant: (c) => c.toLowerCase() }].map(({ label, variant }) => (
        <div key={label} className="row wrap center" style={{ gap: 6, marginBottom: 8 }}>
          <span className="mono dim" style={{ fontSize: 10, width: 66, flex: '0 0 auto' }}>{label}</span>
          {swatches.map((p) => {
            const code = variant(p.code)
            const active = brush === code
            const light = label === 'Contested'
            return (
              <button key={code} onClick={() => setBrush(code)} title={`${p.label}${light ? ' (light)' : ''}`}
                style={{ padding: '6px 9px', border: active ? '2px solid #fff' : '1px solid var(--line)', background: colorOf(code), color: '#04121b', fontSize: 11, fontFamily: 'var(--mono)', borderRadius: 4, cursor: 'pointer' }}>
                {p.code}{light ? '·' : ''}
              </button>
            )
          })}
          {label === 'Full' && (
            <button onClick={() => setBrush('.')} style={{ padding: '6px 12px', border: brush === '.' ? '2px solid #fff' : '1px solid var(--line)', background: 'transparent', color: 'var(--text)', fontSize: 11, borderRadius: 4, cursor: 'pointer' }}>Erase</button>
          )}
        </div>
      ))}
      <div className="row center" style={{ gap: 8, marginBottom: 12 }}>
        <span className="mono dim" style={{ fontSize: 11 }}>Brush size</span>
        {[1, 2, 3, 5].map((s) => <button key={s} className={size === s ? 'primary' : 'ghost'} onClick={() => setSize(s)} style={{ padding: '3px 9px' }}>{s}</button>)}
        <button className="danger ghost" onClick={clearAll} style={{ marginLeft: 'auto' }}>Clear all</button>
      </div>

      <PixelMap territory={terr} edit brush={brush} brushSize={size} onPaint={paint} onMovePlace={movePlace} />

      <CampaignPanel campaign={campaign} terr={terr} territory={state.territory} />

      <div className="panel panel-pad col" style={{ gap: 8, marginTop: 14 }}>
        <div className="row between center wrap" style={{ gap: 8 }}>
          <strong className="head" style={{ fontSize: 14 }}>Place names</strong>
          <div className="row" style={{ gap: 8 }}>
            <button className="ghost" onClick={addPlace}>+ Add place</button>
            <button className="ghost" style={{ borderColor: 'var(--hostile)', color: 'var(--hostile)' }} onClick={addStronghold}>+ Add Meridian stronghold</button>
          </div>
        </div>
        {terr.places.length === 0 && <div className="mono dim" style={{ fontSize: 12 }}>No place labels.</div>}
        {terr.places.map((p) => (
          <div key={p.id} className="row center wrap" style={{ gap: 8 }}>
            <input value={p.name} onChange={(e) => setPlace(p.id, { name: e.target.value })} style={{ flex: '1 1 160px' }} />
            <label className="row center" style={{ gap: 4, flex: '0 0 auto' }}>
              <input type="checkbox" checked={!!p.hostile} onChange={(e) => setPlace(p.id, { hostile: e.target.checked })} style={{ width: 'auto' }} />
              <span className="mono" style={{ fontSize: 10, color: p.hostile ? 'var(--hostile)' : 'var(--text-dim)' }}>Meridian stronghold</span>
            </label>
            <span className="mono dim" style={{ fontSize: 10 }}>drag its dot on the map</span>
            <button className="danger ghost" onClick={() => delPlace(p.id)}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// Campaign replay controls: select/reset the start state, see how many moves
// have been recorded, and export the whole replay as a video. Lives with the
// map editor because every "Save map" is what appends a replay move.
function CampaignPanel({ campaign, terr, territory }) {
  const { updateSlice } = useData()
  const audit = useAudit()
  const confirm = useConfirm()
  const { cols, rows } = terr
  const active = campaignValid(campaign, cols, rows)
  const moves = active ? campaign.timeline.length : 0

  const [exporting, setExporting] = useState(false)
  const [exportPct, setExportPct] = useState(0)
  const [exportErr, setExportErr] = useState('')
  const job = useRef(null)

  const selectStart = async () => {
    const ok = await confirm({
      title: 'Select start state',
      message: active
        ? `Set the map AS CURRENTLY PAINTED HERE as the new campaign start state? The existing replay history (${moves} recorded move${moves === 1 ? '' : 's'}) will be erased.`
        : 'Set the map AS CURRENTLY PAINTED HERE as the campaign start state? Every save from now on becomes a step in the public replay animation.',
      danger: active,
      confirmLabel: 'Select start state',
    })
    if (!ok) return
    updateSlice('campaign', { start: { cells: terr.cells, ts: Date.now() }, timeline: [] })
    audit(active ? 'Reset campaign start state' : 'Selected campaign start state')
  }

  const clearHistory = async () => {
    const ok = await confirm({
      title: 'Clear campaign replay',
      message: 'Remove the start state and all recorded moves? The public map goes back to showing the current state with no replay animation. This cannot be undone.',
      danger: true,
      confirmLabel: 'Clear replay',
    })
    if (!ok) return
    updateSlice('campaign', EMPTY_CAMPAIGN)
    audit('Cleared campaign replay history')
  }

  const doExport = async () => {
    setExportErr('')
    setExporting(true)
    setExportPct(0)
    // Export replays against the SAVED territory (what the public sees), not
    // unsaved editor strokes.
    job.current = exportCampaignReplay({ territory, campaign, onProgress: setExportPct })
    try {
      const { blob, ext } = await job.current.promise
      downloadBlob(blob, `campaign-replay.${ext}`)
      audit('Exported campaign replay', `${moves} moves, .${ext}`)
    } catch (e) {
      if (!e?.cancelled) setExportErr(e?.message || 'Export failed.')
    } finally {
      setExporting(false)
      job.current = null
    }
  }

  return (
    <div className="panel panel-pad col" style={{ gap: 8, marginTop: 14 }}>
      <div className="row between center wrap" style={{ gap: 8 }}>
        <strong className="head" style={{ fontSize: 14 }}>Campaign replay</strong>
        {active && (
          <span className="mono dim" style={{ fontSize: 10 }}>
            START {new Date(campaign.start.ts).toLocaleDateString()} · {moves} MOVE{moves === 1 ? '' : 'S'} RECORDED
          </span>
        )}
      </div>
      <div className="mono dim" style={{ fontSize: 11 }}>
        {active
          ? 'Replay is live: every "Save map" that changes cells records a move, and visitors watch the conquest animate from the start state when the map loads.'
          : 'No start state selected. Pick one to start recording campaign history — each later save becomes a step in an animated conquest replay shown to visitors.'}
      </div>
      <div className="row wrap center" style={{ gap: 8 }}>
        <button className="ghost" onClick={selectStart}>{active ? 'Re-select start state' : 'Select Start State'}</button>
        {active && <button className="danger ghost" onClick={clearHistory}>Clear replay history</button>}
        {active && !exporting && (
          <button
            className="ghost"
            onClick={doExport}
            disabled={moves === 0 || !exportSupported()}
            title={!exportSupported() ? 'This browser cannot record video' : moves === 0 ? 'No moves recorded yet' : 'Render the replay to a video file'}
          >
            ⬇ Export Campaign Replay
          </button>
        )}
        {exporting && (
          <>
            <span className="mono accent" style={{ fontSize: 11 }}>RENDERING… {Math.round(exportPct * 100)}%</span>
            <button className="danger ghost" onClick={() => job.current?.cancel()}>Cancel</button>
          </>
        )}
      </div>
      {exporting && (
        <div className="mono dim" style={{ fontSize: 10 }}>
          The video records in real time — keep this tab visible until it finishes. MP4 where the browser supports it, otherwise WebM.
        </div>
      )}
      {exportErr && <div className="mono" style={{ fontSize: 11, color: 'var(--hostile)' }}>{exportErr}</div>}
    </div>
  )
}
