import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useData } from '../../context/DataContext'
import { useAudit } from '../../hooks/useAudit'
import { useConfirm } from '../../context/ConfirmContext'
import { useToast } from '../../context/ToastContext'
import { useDialog } from '../../hooks/useDialog'
import { OpsHeader, useSaved } from './OperationsCentre'
import PixelMap from '../../components/PixelMap'
import MapLegend from '../../components/MapLegend'
import { PAINT, RHQ_PAINT, colorOf, coyLabelOf } from '../../lib/territory'
import { useOceanMask } from '../../lib/oceanMask'
import { sortFrames, framesValid, renumberFrames } from '../../lib/campaign'
import { exportCampaignReplay, exportProgressImage, exportSupported, downloadBlob, defaultProgressTitle } from '../../lib/replayExport'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const rid = () => Math.random().toString(36).slice(2, 9)

// Pixel-grid territory editor. Pick a colour state, paint cells on the map.
export default function MapEditor() {
  const { state, updateSlice } = useData()
  const audit = useAudit()
  const confirm = useConfirm()
  const toast = useToast()
  const [saved, flash] = useSaved()
  const [terr, setTerr] = useState(() => ({
    ...state.territory,
    places: state.territory.places || [],
    labelOverrides: state.territory.labelOverrides || {},
  }))
  const [brush, setBrush] = useState('M')
  const [size, setSize] = useState(2)
  // "Arrange company labels" is a local UI mode, not a saved setting: it just
  // switches the live canvas below into showing + dragging the derived
  // company-name labels instead of hiding them (the normal editor behaviour,
  // since a label over cells you're painting is in the way). Automatic
  // placement (companyLabels.js) can't always separate a tight multi-way
  // contested cluster on its own, so a manually-dragged position is the
  // escape hatch — it's stored per company in terr.labelOverrides and, like
  // everything else here, only reaches the site on "Save map".
  const [arrangeLabels, setArrangeLabels] = useState(false)
  // When set, the paint canvas targets this campaign frame's cells instead of
  // the live territory — { id, order, label, cells, original }. `original` is
  // the frame's cells as loaded, so we can tell if there are unsaved changes
  // before switching away. "Save map" always publishes the live territory
  // regardless of this; frame edits are staged locally via "Update Frame"
  // (see draftFrameCells below) and only reach the site via "Publish frame
  // changes".
  const [editing, setEditing] = useState(null)
  // frameId -> repainted cells that "Update Frame" has committed but that
  // haven't been pushed to the live campaignFrames collection yet. Kept
  // separate from `state.campaignFrames` (the published data) so painting a
  // frame never touches the public site until RHQ explicitly publishes it —
  // unlike every other campaign action (relabel/reorder/duplicate/delete/
  // set-default-start), which still writes immediately, same as before.
  const [draftFrameCells, setDraftFrameCells] = useState({})
  const [previewOpen, setPreviewOpen] = useState(false)

  const { cols, rows } = terr
  const oceanMask = useOceanMask(cols, rows)

  // `points` is the whole stroke segment since the last pointer event (the
  // map interpolates a continuous line between samples) — stamped in one
  // state update so long fast strokes don't rebuild the cell string per cell.
  const brushOver = (cellsStr, points, code, sz) => {
    const arr = cellsStr.split('')
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
    return arr.join('')
  }
  const paint = (points, code, sz) => {
    if (editing) setEditing((e) => ({ ...e, cells: brushOver(e.cells, points, code, sz) }))
    else setTerr((t) => ({ ...t, cells: brushOver(t.cells, points, code, sz) }))
  }
  const movePlace = (id, x, y) => setTerr((t) => ({ ...t, places: t.places.map((p) => (p.id === id ? { ...p, x, y } : p)) }))
  const moveCompanyLabel = (code, x, y) => setTerr((t) => ({ ...t, labelOverrides: { ...t.labelOverrides, [code]: { x, y } } }))
  const resetCompanyLabel = (code) => setTerr((t) => {
    const next = { ...t.labelOverrides }
    delete next[code]
    return { ...t, labelOverrides: next }
  })
  const resetAllCompanyLabels = () => setTerr((t) => ({ ...t, labelOverrides: {} }))
  const addPlace = () => setTerr((t) => ({ ...t, places: [...t.places, { id: rid(), name: 'New place', x: Math.round(cols / 2), y: Math.round(rows / 2) }] }))
  const addStronghold = () => setTerr((t) => ({ ...t, places: [...t.places, { id: rid(), name: 'Meridian Stronghold', x: Math.round(cols / 2), y: Math.round(rows / 2), hostile: true }] }))
  const setPlace = (id, patch) => setTerr((t) => ({ ...t, places: t.places.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  const delPlace = (id) => setTerr((t) => ({ ...t, places: t.places.filter((p) => p.id !== id) }))
  const clearAll = () => {
    if (editing) setEditing((e) => ({ ...e, cells: '.'.repeat(cols * rows) }))
    else setTerr((t) => ({ ...t, cells: '.'.repeat(cols * rows) }))
  }

  const save = () => {
    updateSlice('territory', terr)
    audit('Updated map territory')
    flash()
  }

  // Load a frame into the shared canvas for repainting. Warns before
  // discarding unpainted changes if switching away from a frame mid-edit.
  // `frame` is a { id, order, label, cells } row from CampaignPanel, or null
  // to stop editing (used by the row's own toggle and the banner's Cancel).
  const startEdit = async (frame) => {
    if (editing && editing.id !== frame?.id && editing.cells !== editing.original) {
      const ok = await confirm({
        title: 'Discard unsaved frame changes?',
        message: `Frame ${editing.order + 1} has painted changes that were never saved with "Update Frame". Switch anyway and lose them?`,
        danger: true,
        confirmLabel: 'Discard & switch',
      })
      if (!ok) return
    }
    if (!frame) { setEditing(null); return }
    setEditing({ id: frame.id, order: frame.order, label: frame.label || '', cells: frame.cells, original: frame.cells })
  }

  // Stage the currently-edited frame's cells locally — NOT written to
  // campaignFrames (and so not visible on the site) until RHQ clicks
  // "Publish frame changes" in the panel below. Re-opening "Edit" on this
  // frame later picks the staged cells back up (see CampaignPanel's onEdit).
  const commitFrameEdit = () => {
    if (!editing) return
    setDraftFrameCells((d) => ({ ...d, [editing.id]: editing.cells }))
    toast.push(`Frame ${editing.order + 1} updated — not live yet. Click "Publish frame changes" below to push it to the site.`)
    setEditing(null)
  }
  const clearDraftFrame = (id) => setDraftFrameCells((d) => {
    if (!(id in d)) return d
    const next = { ...d }
    delete next[id]
    return next
  })
  const clearAllDraftFrames = () => setDraftFrameCells({})

  const swatches = [...PAINT, ...(terr.showRHQ ? [RHQ_PAINT] : [])]
  // Whatever's currently on the paint canvas — the live territory, or the
  // historical frame being repainted — so "Preview Map" always shows exactly
  // what's under the brush right now, unsaved changes included.
  const canvasCells = editing ? editing.cells : terr.cells

  return (
    <div>
      <OpsHeader title="Map: Territory" sub="EDIT // PIXEL TERRITORY" updatedAt={state.contentMeta?.territory?.updatedAt}>
        <label className="row center" style={{ gap: 6, fontSize: 11 }}>
          <input type="checkbox" checked={!!terr.showRHQ} onChange={(e) => setTerr((t) => ({ ...t, showRHQ: e.target.checked }))} style={{ width: 'auto' }} /> Show RHQ on map
        </label>
        <label className="row center" style={{ gap: 6, fontSize: 11 }} title="Shows the derived company-name labels on the canvas below and lets you drag any of them to a fixed spot — for when a tight multi-way contested cluster overlaps no matter what.">
          <input type="checkbox" checked={arrangeLabels} onChange={(e) => setArrangeLabels(e.target.checked)} style={{ width: 'auto' }} /> Arrange company labels manually
        </label>
        <button className="ghost" onClick={() => setPreviewOpen(true)} title="See exactly what recruits would see on the Home page, including unsaved changes">
          Preview Map
        </button>
        <button className="primary" onClick={save} disabled={!!editing} title={editing ? 'Exit frame editing to save the live map' : undefined}>{saved ? 'Saved ✓' : 'Save map'}</button>
      </OpsHeader>

      {previewOpen && (
        <PreviewMapModal territory={{ ...terr, cells: canvasCells }} onClose={() => setPreviewOpen(false)} />
      )}

      {editing && (
        <div className="panel panel-pad row between center wrap" style={{ gap: 10, marginBottom: 10, borderColor: 'var(--accent)', background: 'rgba(54,224,192,0.06)' }}>
          <div className="mono accent" style={{ fontSize: 12 }}>
            EDITING {editing.order === 0 ? 'START FRAME' : `FRAME ${editing.order + 1}`} — painting here updates this historical frame, not the live map. "Update Frame" only saves your place in this editor — it stays off the site until you publish it below.
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="ghost" onClick={() => startEdit(null)}>Cancel</button>
            <button className="primary" onClick={commitFrameEdit} title="Stores your painting so you can keep working — does not push it to the site">Update Frame</button>
          </div>
        </div>
      )}

      <div className="mono dim" style={{ fontSize: 11, marginBottom: 10 }}>
        Pick a colour, then paint on the map — one finger/click paints, the +/- buttons zoom, two-finger drag or middle/right-mouse drag pans while zoomed. Ocean tiles (shaded dark) can't be painted. "Full" is solid/firmly held; "Contested" is the lighter, newly-gained/loosely-held variant. Erase removes.
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

      {arrangeLabels && (
        <div className="mono dim" style={{ fontSize: 11, marginBottom: 8 }}>
          Drag any company name below to fix its position — automatic placement keeps every other company clear of it. Companies you haven't dragged keep placing themselves automatically, including around a dragged one.
        </div>
      )}
      <PixelMap
        territory={{ ...terr, cells: canvasCells }}
        edit brush={brush} brushSize={size} onPaint={paint} onMovePlace={movePlace}
        showCompanyLabels={arrangeLabels}
        onMoveCompanyLabel={arrangeLabels ? moveCompanyLabel : undefined}
      />

      <CampaignPanel
        frames={state.campaignFrames}
        defaultStartId={state.campaignDefaultStart}
        terr={terr}
        territory={state.territory}
        editing={editing}
        onStartEdit={startEdit}
        onForceClearEdit={() => setEditing(null)}
        draftFrameCells={draftFrameCells}
        onClearDraftFrame={clearDraftFrame}
        onClearAllDraftFrames={clearAllDraftFrames}
      />

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

      {arrangeLabels && (
        <div className="panel panel-pad col" style={{ gap: 8, marginTop: 14 }}>
          <div className="row between center wrap" style={{ gap: 8 }}>
            <strong className="head" style={{ fontSize: 14 }}>Company label positions</strong>
            {Object.keys(terr.labelOverrides).length > 0 && (
              <button className="ghost" onClick={resetAllCompanyLabels}>Reset all to automatic</button>
            )}
          </div>
          {Object.keys(terr.labelOverrides).length === 0 && (
            <div className="mono dim" style={{ fontSize: 12 }}>
              All company labels are placed automatically. Drag a label on the map above to fix its position here.
            </div>
          )}
          {Object.keys(terr.labelOverrides).map((code) => (
            <div key={code} className="row center wrap" style={{ gap: 8 }}>
              <span className="tag mono" style={{ fontSize: 11, color: colorOf(code), borderColor: colorOf(code) }}>{coyLabelOf(code)}</span>
              <span className="mono dim" style={{ fontSize: 10 }}>manually positioned — drag it again to fine-tune</span>
              <button className="ghost" style={{ marginLeft: 'auto' }} onClick={() => resetCompanyLabel(code)}>Reset to automatic</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Read-only, full-size render of exactly what's on the paint canvas right
// now — same PixelMap (showCompanyLabels on) + MapLegend the public Home
// page uses at rest, fed the in-progress `terr`/`editing` state instead of
// the saved territory slice, so RHQ can sanity-check a stroke before "Save
// map" publishes it. Portalled to <body>: mounted from inside the sticky
// nav rail / fixed drawer, whose stacking contexts would otherwise trap a
// `position: fixed` modal under page content (see LoginModal for the same
// note).
function PreviewMapModal({ territory, onClose }) {
  const dialogRef = useDialog(onClose)
  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(2,4,9,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'auto',
    }}>
      <div ref={dialogRef} className="panel panel-pad" onClick={(e) => e.stopPropagation()} role="dialog"
        aria-modal="true" aria-label="Map preview" style={{ width: 860, maxWidth: '100%' }}>
        <div className="row between center">
          <h2 className="accent" style={{ margin: 0, fontSize: 17 }}>PREVIEW — WHAT RECRUITS SEE</h2>
          <button className="ghost" onClick={onClose} aria-label="Close" style={{ padding: '4px 10px' }}>✕</button>
        </div>
        <div className="mono dim" style={{ fontSize: 11, margin: '8px 0 14px' }}>
          The Home page map exactly as it would render right now — territory, place labels and derived
          company names included — with any unsaved painting still applied. Nothing here is published;
          close this and click “Save map” when it looks right.
        </div>
        <div className="col" style={{ gap: 10 }}>
          <PixelMap territory={territory} showCompanyLabels />
          <MapLegend showRHQ={territory.showRHQ} />
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Campaign replay controls: every frame is its own document, so each can be
// repainted (via "Edit" -> the shared canvas above), relabelled, duplicated
// (the way to insert a new frame mid-sequence), reordered or deleted
// independently — no more diff-chain, no more "re-recording the start wipes
// everything after it".
function CampaignPanel({
  frames, defaultStartId, terr, territory, editing, onStartEdit, onForceClearEdit,
  draftFrameCells, onClearDraftFrame, onClearAllDraftFrames,
}) {
  const { updateSlice } = useData()
  const audit = useAudit()
  const confirm = useConfirm()
  const toast = useToast()
  const { cols, rows } = terr
  const sorted = sortFrames(frames || [])
  const active = framesValid(frames, cols, rows)
  const count = sorted.length
  const hasRecentFrame = sorted.some((f) => f.ts >= Date.now() - WEEK_MS)
  const draftIds = Object.keys(draftFrameCells)
  const draftCount = draftIds.length
  // The live map is the source for the NEXT frame, not part of the replay
  // itself (see CampaignReplayMap) — so if it's diverged from the last
  // recorded frame, the public site is showing something already out of
  // date until RHQ deliberately captures it.
  const liveDrift = active && territory.cells !== sorted[sorted.length - 1].cells

  const [exporting, setExporting] = useState(false)
  const [exportPct, setExportPct] = useState(0)
  const [exportErr, setExportErr] = useState('')
  const job = useRef(null)

  const [imgBusy, setImgBusy] = useState(false)
  const [imgErr, setImgErr] = useState('')
  // Headline printed across the top of the weekly image. Seeded with the
  // generated "PROGRESS UPDATE — 28 Jul TO 4 Aug" wording and editable, so a
  // week's image can be titled for what actually happened. Blank falls back to
  // the generated text at render time.
  const [imgTitle, setImgTitle] = useState('')
  useEffect(() => {
    if (hasRecentFrame) setImgTitle((t) => t || defaultProgressTitle({ frames: sorted }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRecentFrame])

  const persist = (nextSorted, message, detail) => {
    updateSlice('campaignFrames', renumberFrames(nextSorted))
    audit(message, detail)
  }

  // Push every staged "Update Frame" edit to the live campaignFrames
  // collection in one write — the only point at which a repainted frame
  // actually reaches the public site.
  const publishDraftFrames = () => {
    if (!draftCount) return
    const next = sorted.map((f) => (f.id in draftFrameCells ? { ...f, cells: draftFrameCells[f.id], updatedAt: Date.now() } : f))
    updateSlice('campaignFrames', next)
    audit('Published campaign frame changes', `${draftCount} frame${draftCount === 1 ? '' : 's'}`)
    toast.push(`${draftCount} frame${draftCount === 1 ? '' : 's'} published to the site.`)
    onClearAllDraftFrames()
  }

  // Snapshot the current live painting as a new frame at the end.
  const addFromLive = () => {
    const frame = { id: rid(), order: count, cells: terr.cells, label: '', ts: Date.now(), updatedAt: Date.now() }
    persist([...sorted, frame], count === 0 ? 'Added campaign start frame' : 'Added campaign frame from live map', `frame ${count + 1}`)
    toast.push(count === 0 ? 'Start frame recorded.' : `Frame ${count + 1} recorded.`)
  }

  // Insert a copy of frame i right after it — the way to add a step mid-sequence.
  const duplicate = (i) => {
    const copy = { ...sorted[i], id: rid(), ts: Date.now(), updatedAt: Date.now() }
    const next = [...sorted.slice(0, i + 1), copy, ...sorted.slice(i + 1)]
    persist(next, 'Duplicated campaign frame', `frame ${i + 1}`)
    toast.push(`Frame ${i + 1} duplicated.`)
  }

  const relabel = (i, label) => {
    const next = sorted.map((f, k) => (k === i ? { ...f, label, updatedAt: Date.now() } : f))
    updateSlice('campaignFrames', next)
    audit('Relabelled campaign frame', `frame ${i + 1}`)
  }

  const move = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= sorted.length) return
    const next = [...sorted]
    ;[next[i], next[j]] = [next[j], next[i]]
    persist(next, 'Reordered campaign frames', `frame ${i + 1} moved ${dir < 0 ? 'earlier' : 'later'}`)
  }

  const del = async (i) => {
    const f = sorted[i]
    const ok = await confirm({
      title: 'Delete campaign frame',
      message: `Remove frame ${i + 1}${f.label ? ` (“${f.label}”)` : ''}? This cannot be undone.`,
      danger: true,
      confirmLabel: 'Delete frame',
    })
    if (!ok) return
    if (editing?.id === f.id) onForceClearEdit()
    onClearDraftFrame(f.id)
    if (defaultStartId === f.id) updateSlice('campaignDefaultStart', null)
    persist(sorted.filter((_, k) => k !== i), 'Deleted campaign frame', `frame ${i + 1}`)
    toast.push(`Frame ${i + 1} deleted.`)
  }

  const clearAll = async () => {
    const ok = await confirm({
      title: 'Clear campaign replay',
      message: 'Remove every recorded frame? The public map goes back to showing the current state with no replay animation. This cannot be undone.',
      danger: true,
      confirmLabel: 'Clear replay',
    })
    if (!ok) return
    onForceClearEdit()
    onClearAllDraftFrames()
    updateSlice('campaignFrames', [])
    updateSlice('campaignDefaultStart', null)
    audit('Cleared campaign replay history')
  }

  // Where the public replay's AUTO-PLAY begins (earlier frames stay archived
  // and reachable via the replay's own "jump to frame" picker). Clicking the
  // current default again clears it back to "earliest frame" (the original
  // behaviour).
  const setDefaultStart = (id) => {
    const next = defaultStartId === id ? null : id
    updateSlice('campaignDefaultStart', next)
    audit(next ? 'Set campaign default start frame' : 'Cleared campaign default start frame')
    toast.push(next ? 'Default start frame set.' : 'Default start cleared — replay starts from the earliest frame again.')
  }

  const doExportImage = async () => {
    setImgErr('')
    setImgBusy(true)
    try {
      const { blob } = await exportProgressImage({ territory, frames: sorted, title: imgTitle })
      downloadBlob(blob, `campaign-progress-${new Date().toISOString().slice(0, 10)}.png`)
      audit('Exported weekly progress image')
    } catch (e) {
      setImgErr(e?.message || 'Image export failed.')
    } finally {
      setImgBusy(false)
    }
  }

  const doExport = async () => {
    setExportErr('')
    setExporting(true)
    setExportPct(0)
    // Export replays against the SAVED territory (what the public sees), not
    // unsaved editor strokes.
    job.current = exportCampaignReplay({ territory, frames: sorted, onProgress: setExportPct })
    try {
      const { blob, ext } = await job.current.promise
      downloadBlob(blob, `campaign-replay.${ext}`)
      audit('Exported campaign replay', `${count} frames, .${ext}`)
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
        {active && <span className="mono dim" style={{ fontSize: 10 }}>{count} FRAME{count === 1 ? '' : 'S'} RECORDED</span>}
      </div>
      <div className="mono dim" style={{ fontSize: 11 }}>
        {active
          ? 'Replay is live — visitors watch the conquest animate through every recorded frame below when the map loads (or jump to any frame themselves via the picker on the Home page). Each frame can be repainted, relabelled, reordered, duplicated or deleted independently. "Set as Default Start" picks which frame the auto-play begins from — earlier frames stay archived and reachable via the picker either way. The live map above is only ever a starting point for the NEXT frame — it doesn\'t appear in the replay itself until you add it.'
          : 'No frames recorded yet. Paint the map above, then add it as the campaign start frame — you can add more as the campaign advances.'}
      </div>

      {liveDrift && (
        <div className="row between center wrap" style={{ gap: 10, padding: '8px 10px', border: '1px solid var(--accent)', borderRadius: 6, background: 'rgba(54,224,192,0.06)' }}>
          <span className="mono accent" style={{ fontSize: 11 }}>
            ⚠ Live map has changed since the last recorded frame — the public replay won't show this until you add it.
          </span>
          <button className="ghost" onClick={addFromLive} style={{ flex: '0 0 auto' }}>+ Add Frame from Live Map</button>
        </div>
      )}

      {draftCount > 0 && (
        <div className="row between center wrap" style={{ gap: 10, padding: '8px 10px', border: '1px solid var(--accent)', borderRadius: 6, background: 'rgba(54,224,192,0.06)' }}>
          <span className="mono accent" style={{ fontSize: 11 }}>
            ● {draftCount} frame{draftCount === 1 ? '' : 's'} repainted but not published — the site still shows the old version.
          </span>
          <button className="primary" onClick={publishDraftFrames} style={{ flex: '0 0 auto' }}>Publish frame changes</button>
        </div>
      )}

      <div className="row wrap center" style={{ gap: 8 }}>
        <button className="primary" onClick={addFromLive} title="Snapshot the current live painting as a new frame at the end of the timeline.">
          + Add Frame from Live Map
        </button>
        {active && <button className="danger ghost" onClick={clearAll}>Clear replay history</button>}
        {active && (
          <button
            className="ghost"
            onClick={doExportImage}
            disabled={!hasRecentFrame || imgBusy}
            title={!hasRecentFrame ? 'No frames recorded in the last 7 days' : 'Download a still image highlighting this week’s gains'}
          >
            {imgBusy ? 'Rendering…' : '🖼 Export Weekly Update Image'}
          </button>
        )}
        {active && !exporting && (
          <button
            className="ghost"
            onClick={doExport}
            disabled={count === 0 || !exportSupported()}
            title={!exportSupported() ? 'This browser cannot record video' : count === 0 ? 'No frames recorded yet' : 'Render the replay to a video file'}
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
      {active && hasRecentFrame && (
        <label className="row center wrap" style={{ gap: 8 }}>
          <span className="mono dim" style={{ fontSize: 10, letterSpacing: 1, flex: '0 0 auto' }}>IMAGE HEADLINE</span>
          <input
            value={imgTitle}
            onChange={(e) => setImgTitle(e.target.value)}
            placeholder={defaultProgressTitle({ frames: sorted })}
            maxLength={90}
            style={{ flex: '1 1 240px' }}
            title="Printed across the top of the weekly update image. Leave blank for the generated dates."
          />
        </label>
      )}
      {imgErr && <div className="mono" style={{ fontSize: 11, color: 'var(--hostile)' }}>{imgErr}</div>}

      {active && (
        <div className="col" style={{ gap: 4, marginTop: 4 }}>
          <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2 }}>FRAMES</div>
          {sorted.map((f, i) => (
            <FrameRow
              key={f.id}
              f={f}
              index={i}
              isFirst={i === 0}
              isLast={i === sorted.length - 1}
              isEditing={editing?.id === f.id}
              isDefaultStart={defaultStartId === f.id}
              hasDraft={f.id in draftFrameCells}
              onMove={(dir) => move(i, dir)}
              onEdit={() => onStartEdit(editing?.id === f.id ? null : { id: f.id, order: i, label: f.label || '', cells: draftFrameCells[f.id] ?? f.cells })}
              onDuplicate={() => duplicate(i)}
              onDelete={() => del(i)}
              onRelabel={(label) => relabel(i, label)}
              onSetDefaultStart={() => setDefaultStart(f.id)}
            />
          ))}
        </div>
      )}

      {exporting && (
        <div className="mono dim" style={{ fontSize: 10 }}>
          The video records in real time — keep this tab visible until it finishes. MP4 where the browser supports it, otherwise WebM.
        </div>
      )}
      {exportErr && <div className="mono" style={{ fontSize: 11, color: 'var(--hostile)' }}>{exportErr}</div>}
    </div>
  )
}

// One frame row. Keeps its own local label text so typing doesn't fire a
// Firestore write per keystroke — the label only commits (onRelabel) when
// the field loses focus or Enter is pressed, and only if it actually changed.
function FrameRow({ f, index, isFirst, isLast, isEditing, isDefaultStart, hasDraft, onMove, onEdit, onDuplicate, onDelete, onRelabel, onSetDefaultStart }) {
  const [label, setLabel] = useState(f.label || '')
  useEffect(() => { setLabel(f.label || '') }, [f.label])
  const commit = () => { if (label !== (f.label || '')) onRelabel(label) }

  return (
    <div className="row center wrap" style={{ gap: 8, borderTop: '1px solid var(--line)', paddingTop: 6,
      background: isEditing ? 'rgba(54,224,192,0.08)' : undefined }}>
      <span className="mono accent" style={{ fontSize: 11, flex: '0 0 auto' }}>{index === 0 ? 'START' : String(index + 1).padStart(2, '0')}</span>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
        placeholder={index === 0 ? 'Campaign baseline' : 'e.g. Week 3 — Bravo retakes Singleton'}
        maxLength={80}
        style={{ flex: '1 1 160px' }}
      />
      {isDefaultStart && <span className="tag" style={{ fontSize: 9, flex: '0 0 auto', color: 'var(--accent)', borderColor: 'var(--accent)' }}>DEFAULT START</span>}
      {hasDraft && <span className="tag mono" style={{ fontSize: 9, flex: '0 0 auto', color: 'var(--accent)', borderColor: 'var(--accent)' }} title="Repainted but not yet published — the site still shows the old version">● UNPUBLISHED</span>}
      <span className="mono dim" style={{ fontSize: 10, flex: '0 0 auto' }}>{new Date(f.ts).toLocaleDateString()}</span>
      <div className="row" style={{ gap: 4, flex: '0 0 auto' }}>
        <button className="ghost" style={{ padding: '3px 8px' }} onClick={() => onMove(-1)} disabled={isFirst} title="Move earlier">↑</button>
        <button className="ghost" style={{ padding: '3px 8px' }} onClick={() => onMove(1)} disabled={isLast} title="Move later">↓</button>
        <button className={isEditing ? 'primary' : 'ghost'} style={{ padding: '3px 8px' }} onClick={onEdit} title="Load this frame into the canvas above to repaint it">
          {isEditing ? 'Editing…' : 'Edit'}
        </button>
        <button className="ghost" style={{ padding: '3px 8px' }} onClick={onDuplicate} title="Insert a copy of this frame right after it">Duplicate</button>
        <button className={isDefaultStart ? 'primary' : 'ghost'} style={{ padding: '3px 8px' }} onClick={onSetDefaultStart}
          title={isDefaultStart ? 'Clear default start — the public replay will start from the earliest frame again' : "Public replay's auto-play will start from here (earlier frames stay archived, still reachable via its frame picker)"}>
          {isDefaultStart ? 'Default ✓' : 'Set as Default Start'}
        </button>
        <button className="danger ghost" style={{ padding: '3px 8px' }} onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}
