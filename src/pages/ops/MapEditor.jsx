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
import { useUnpaintableMask } from '../../lib/unpaintableMask'
import { MAPS, mapById, mapFor, gridRefOf, territorySlice, campaignStartSlice, framesForMap, withMapFrames, zoneVisibilitySlice, mapReleaseSlice } from '../../lib/maps'
import { visibleZones, zonesByKind, zoneCount } from '../../lib/mapZones'
import { zoneProgress } from '../../lib/campPlan'
import { hasCampPlan, campDays } from '../../lib/campPlan'
import { buildCampFrames } from '../../lib/campFrames'
import { sortFrames, framesValid, renumberFrames } from '../../lib/campaign'
import { exportCampaignReplay, exportProgressImage, exportSupported, downloadBlob, defaultProgressTitle } from '../../lib/replayExport'
import { exportFramesPdf, framesPdfSupported } from '../../lib/framesPdf'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const rid = () => Math.random().toString(36).slice(2, 9)

// Editable copy of a saved territory slice, with the optional collections
// filled in so the editor never has to null-check them.
const loadTerr = (t) => ({ ...t, places: t.places || [], labelOverrides: t.labelOverrides || {} })

// Pixel-grid territory editor. Pick a colour state, paint cells on the map.
//
// The portal carries several maps (lib/maps.js). This editor works on ONE at a
// time — `mapId` below — and everything it writes is that map's own slice, so
// painting one map can never disturb another. Which map visitors LAND on is a
// separate, deliberate choice (the `activeMap` slice, set from the switcher
// at the top of this page): switching what you're editing does not change
// what visitors are looking at.
export default function MapEditor() {
  const { state, updateSlice } = useData()
  const audit = useAudit()
  const confirm = useConfirm()
  const toast = useToast()
  const [saved, flash] = useSaved()
  // Start on whichever map is live to the public — the one most likely to be
  // the reason RHQ opened this page.
  const [mapId, setMapId] = useState(() => mapById(state.activeMap).id)
  const map = mapById(mapId)
  const terrSlice = territorySlice(mapId)
  const startSlice = campaignStartSlice(mapId)
  const zoneSlice = zoneVisibilitySlice(mapId)
  // The editor shows exactly what visitors would see, so hiding a zone here is
  // previewed immediately rather than guessed at.
  const editorZones = visibleZones(map, state[zoneSlice])
  const savedTerr = state[terrSlice]
  const [terr, setTerr] = useState(() => loadTerr(savedTerr))
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
  const unpaintable = useUnpaintableMask(map, cols, rows)
  const mapFrames = framesForMap(state.campaignFrames, mapId)

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
        if (code !== '.' && unpaintable && unpaintable[ny * cols + nx]) continue // e.g. ocean
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
    updateSlice(terrSlice, { ...terr, map: mapId })
    audit('Updated map territory', map.name)
    flash()
  }

  // Switch which map this editor is working on. Everything local to the
  // previous map (its in-progress painting, its staged frame edits, which
  // frame was open) is discarded, so confirm first if any of it is unsaved.
  const switchMap = async (nextId) => {
    if (nextId === mapId) return
    const dirtyPaint = JSON.stringify(terr) !== JSON.stringify(loadTerr(savedTerr))
    const dirtyFrames = Object.keys(draftFrameCells).length > 0
    if (dirtyPaint || dirtyFrames || editing) {
      const ok = await confirm({
        title: `Leave ${map.name}?`,
        message: `${map.name} has changes that haven't been published${dirtyFrames ? ' (including repainted frames)' : ''}. Switching map discards them.`,
        danger: true,
        confirmLabel: 'Discard & switch',
      })
      if (!ok) return
    }
    setEditing(null)
    setDraftFrameCells({})
    setArrangeLabels(false)
    setTerr(loadTerr(state[territorySlice(nextId)]))
    setMapId(nextId)
  }

  // Publish this map to the portal. The one control here that changes what a
  // signed-out visitor sees, so it is deliberately explicit rather than a
  // side effect of switching which map you're editing.
  const makeLive = async () => {
    if (state.activeMap === mapId) return
    const ok = await confirm({
      title: 'Change the public map',
      message: `Make ${map.name} the map visitors land on, instead of ${mapById(state.activeMap).name}? They can still switch to the other one from the Home page, and nothing painted on either map is changed.`,
      confirmLabel: 'Show this map',
    })
    if (!ok) return
    updateSlice('activeMap', mapId)
    audit('Changed the default public map', map.name)
    toast.push(`${map.name} is now the default map on the Home page.`)
  }

  // DISTRIBUTION. A map that isn't the default is invisible to the public
  // until this is switched on — the Regional map is built, painted and has
  // every day of camp generated onto it long before anyone outside RHQ should
  // be looking at it. Withdrawing puts it straight back out of reach.
  const released = !!state[mapReleaseSlice(mapId)]?.released
  const setReleased = async (next) => {
    const ok = await confirm({
      title: next ? 'Distribute this map' : 'Withdraw this map',
      message: next
        ? `Put ${map.name} on the Home page for everyone? Visitors will get a button to switch to it, and everything saved on it — territory, places and every released replay frame — becomes public.`
        : `Take ${map.name} back off the Home page? Visitors lose the button to it immediately. Nothing painted on it is changed, and you can distribute it again at any time.`,
      confirmLabel: next ? 'Distribute' : 'Withdraw',
      danger: !next,
    })
    if (!ok) return
    await updateSlice(mapReleaseSlice(mapId), { released: next, at: Date.now() })
    audit(next ? 'Distributed a map to the portal' : 'Withdrew a map from the portal', map.name)
    toast.push(next ? `${map.name} is now visible on the Home page.` : `${map.name} is no longer visible to visitors.`)
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
      <OpsHeader title="Map: Territory" sub={`EDIT // ${map.sub}`} updatedAt={state.contentMeta?.[terrSlice]?.updatedAt}>
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

      <MapSwitcher maps={MAPS} mapId={mapId} liveId={state.activeMap} onSwitch={switchMap} onMakeLive={makeLive}
        released={released} onRelease={setReleased}
        releasedIds={MAPS.filter((m) => state[mapReleaseSlice(m.id)]?.released).map((m) => m.id)} />

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
        Pick a colour, then paint on the map — one finger/click paints, the +/- buttons zoom, two-finger drag or middle/right-mouse drag pans while zoomed.
        {map.blockFill ? ` ${map.blockLabel} tiles (shaded dark) can't be painted.` : ''} "Full" is solid/firmly held; "Contested" is the lighter, newly-gained/loosely-held variant. Erase removes.
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
        key={`canvas-${mapId}`}
        territory={{ ...terr, cells: canvasCells }}
        edit brush={brush} brushSize={size} onPaint={paint} onMovePlace={movePlace}
        zones={editorZones}
        showCompanyLabels={arrangeLabels}
        onMoveCompanyLabel={arrangeLabels ? moveCompanyLabel : undefined}
      />

      <ZonesPanel
        key={`zones-${mapId}`}
        mapId={mapId}
        slice={state[zoneSlice]}
        onChange={(next) => { updateSlice(zoneSlice, next); audit('Changed zones shown', map.name) }}
      />

      <CampaignPanel
        key={`campaign-${mapId}`}
        mapId={mapId}
        allFrames={state.campaignFrames}
        frames={mapFrames}
        startSlice={startSlice}
        defaultStartId={state[startSlice]}
        terr={terr}
        territory={savedTerr}
        zones={editorZones}
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
            {gridRefOf(map, p.x, p.y)
              ? <span className="mono accent" style={{ fontSize: 10 }} title={`${map.geo.crs} grid reference`}>GR {gridRefOf(map, p.x, p.y)}</span>
              : null}
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

// Which map you're editing, and which one the public is looking at — two
// different things, shown together so the difference is impossible to miss.
// Only RHQ ever sees this: the public portal has no map switcher at all, it
// just renders whatever `activeMap` names.
function MapSwitcher({ maps, mapId, liveId, onSwitch, onMakeLive, released, onRelease, releasedIds = [] }) {
  const isLive = liveId === mapId
  return (
    <div className="panel panel-pad col" style={{ gap: 10, marginBottom: 12 }}>
      <div className="row between center wrap" style={{ gap: 8 }}>
        <strong className="head" style={{ fontSize: 14 }}>Map</strong>
        <span className="mono dim" style={{ fontSize: 10, letterSpacing: 1 }}>
          EACH MAP KEEPS ITS OWN TERRITORY, PLACES AND REPLAY
        </span>
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        {maps.map((m) => {
          const active = m.id === mapId
          return (
            <button
              key={m.id}
              onClick={() => onSwitch(m.id)}
              className={active ? 'primary' : 'ghost'}
              style={{ textAlign: 'left', padding: '8px 12px', flex: '1 1 240px' }}
              title={m.blurb}
            >
              <div className="row center" style={{ gap: 8 }}>
                <span style={{ fontWeight: 700 }}>{m.name}</span>
                {m.id === liveId
                  ? <span className="tag" style={{ fontSize: 9, color: 'var(--accent)', borderColor: 'var(--accent)' }}>DEFAULT</span>
                  : (
                    <span className="tag" style={{ fontSize: 9, ...(releasedIds.includes(m.id)
                      ? {} : { color: 'var(--hostile)', borderColor: 'var(--hostile)' }) }}>
                      {releasedIds.includes(m.id) ? 'DISTRIBUTED' : 'NOT DISTRIBUTED'}
                    </span>
                  )}
              </div>
              <div className="mono" style={{ fontSize: 10, opacity: 0.75, marginTop: 3 }}>{m.sub}</div>
            </button>
          )
        })}
      </div>
      <div className="row between center wrap" style={{ gap: 10 }}>
        {/* Three states, and the copy must never leave RHQ guessing which one
            they are in, because it decides whether what they save is public.
            The DEFAULT map is always public — it is the one visitors land on.
            Any other map is public only once DISTRIBUTED, and then everything
            saved on it is public too. */}
        <span className="mono dim" style={{ fontSize: 11 }}>
          {isLive
            ? 'Visitors land on this map. Everything you save here goes straight to the Home page.'
            : released
              ? 'DISTRIBUTED — visitors land on the map marked DEFAULT but can switch to this one, so anything you save here is public too.'
              : 'NOT DISTRIBUTED — nobody outside the Operations Centre can open this map yet. Build it here, then distribute it when it should go out.'}
        </span>
        <div className="row center wrap" style={{ gap: 8, flex: '0 0 auto' }}>
          {!isLive && (
            <button className={released ? 'ghost' : 'primary'} onClick={() => onRelease(!released)}>
              {released ? 'Withdraw from the portal' : 'Distribute to the portal'}
            </button>
          )}
          {!isLive && (
            <button className="ghost" onClick={onMakeLive}>Make this the default map</button>
          )}
        </div>
      </div>
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
          <MapLegend showRHQ={territory.showRHQ} map={mapFor(territory)} />
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
  mapId, allFrames, frames, startSlice, defaultStartId, terr, territory, zones = [],
  editing, onStartEdit, onForceClearEdit,
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
  // How much of the replay is still held back from the public (see toggleHidden).
  const hiddenCount = sorted.filter((f) => f.hidden).length
  // Zone percentages for one frame, read off the camp plan at THAT frame's own
  // day. Generated frames carry `day`; a hand-painted one doesn't, and gets no
  // readout rather than a made-up one.
  const progressAt = (f) => (typeof f?.day === 'number' ? zoneProgress(mapId, f.day) : null)

  const [exporting, setExporting] = useState(false)
  const [exportPct, setExportPct] = useState(0)
  const [exportErr, setExportErr] = useState('')
  const job = useRef(null)

  const [imgBusy, setImgBusy] = useState(false)
  const [imgErr, setImgErr] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfErr, setPdfErr] = useState('')
  // Headline printed across the top of the weekly image. Seeded with the
  // generated "PROGRESS UPDATE — 28 Jul TO 4 Aug" wording and editable, so a
  // week's image can be titled for what actually happened. Blank falls back to
  // the generated text at render time.
  const [imgTitle, setImgTitle] = useState('')
  useEffect(() => {
    if (hasRecentFrame) setImgTitle((t) => t || defaultProgressTitle({ frames: sorted }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRecentFrame])

  // `campaignFrames` is one collection shared by every map, and persisting it
  // deletes any document not in what we hand over — so each write rebuilds
  // THIS map's frames and carries every other map's through untouched. Orders
  // are renumbered within the map, not across the collection.
  const writeFrames = (rows) => updateSlice('campaignFrames', withMapFrames(allFrames, mapId, rows))

  const persist = (nextSorted, message, detail) => {
    writeFrames(renumberFrames(nextSorted))
    audit(message, detail)
  }

  // Push every staged "Update Frame" edit to the live campaignFrames
  // collection in one write — the only point at which a repainted frame
  // actually reaches the public site.
  const publishDraftFrames = () => {
    if (!draftCount) return
    const next = sorted.map((f) => (f.id in draftFrameCells ? { ...f, cells: draftFrameCells[f.id], updatedAt: Date.now() } : f))
    writeFrames(next)
    audit('Published campaign frame changes', `${draftCount} frame${draftCount === 1 ? '' : 's'}`)
    toast.push(`${draftCount} frame${draftCount === 1 ? '' : 's'} published to the site.`)
    onClearAllDraftFrames()
  }

  // Build the whole replay from the camp plan — one frame per camp day, ground
  // painted from the schedule (see lib/campFrames.js). Only possible because
  // the plan is settled in advance; this GENERATES the campaign rather than
  // recording it. Every generated frame is an ordinary frame afterwards, so
  // RHQ can repaint, relabel or delete any of them.
  const buildFromPlan = async () => {
    const built = buildCampFrames(mapId, terr)
    if (!built.length) return
    if (count) {
      const ok = await confirm({
        title: 'Replace the replay?',
        message: `Building from the camp plan replaces all ${count} frame${count === 1 ? '' : 's'} on this map with ${built.length} — one per camp day. Anything painted by hand into the existing frames is lost.`,
        confirmLabel: 'Replace frames',
      })
      if (!ok) return
    }
    // Everything past the camp-start frame is HELD BACK. The whole camp is
    // painted here in one go, and publishing all of it at once would show
    // cadets the last day of camp before the first one has happened — RHQ
    // reveals a day at a time from the rows below.
    writeFrames(built.map((f, i) => ({ ...f, id: rid(), map: mapId, hidden: i > 0, ts: Date.now(), updatedAt: Date.now() })))
    onClearAllDraftFrames()
    audit('Built campaign frames from the camp plan', `${built.length} frames`)
    toast.push(`${built.length} frames built — only the camp start is visible; reveal each day as it happens.`)
  }

  // Snapshot the current live painting as a new frame at the end.
  const addFromLive = () => {
    const frame = { id: rid(), map: mapId, order: count, cells: terr.cells, label: '', ts: Date.now(), updatedAt: Date.now() }
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
    writeFrames(next)
    audit('Relabelled campaign frame', `frame ${i + 1}`)
  }

  // Whether this ONE frame borrows the current manually-dragged company
  // label positions (terr.labelOverrides, set above via "Arrange company
  // labels manually") instead of placing names automatically. There's only
  // one set of dragged coordinates — this just decides which frames use it,
  // so fixing a label for one historical frame doesn't drag it out of place
  // on every other frame of the replay too.
  const toggleLabelOverrides = (i) => {
    const next = sorted.map((f, k) => (k === i ? { ...f, useLabelOverrides: !f.useLabelOverrides, updatedAt: Date.now() } : f))
    writeFrames(next)
    audit(sorted[i].useLabelOverrides ? 'Disabled manual company labels on campaign frame' : 'Enabled manual company labels on campaign frame', `frame ${i + 1}`)
  }

  // RELEASE. Camp is generated in full before it starts, so every frame after
  // the first is held back and RHQ reveals them one at a time as camp runs —
  // otherwise the whole campaign lands on the Home page on day one. Hidden
  // frames are ordinary frames here; only the public replay filters them out
  // (releasedFrames in lib/campaign.js).
  const toggleHidden = (i) => {
    const next = sorted.map((f, k) => (k === i ? { ...f, hidden: !f.hidden, updatedAt: Date.now() } : f))
    writeFrames(next)
    if (sorted[i].hidden) syncLiveTo(next)
    audit(sorted[i].hidden ? 'Released a campaign frame' : 'Held back a campaign frame', `frame ${i + 1}`)
    toast.push(sorted[i].hidden ? `Frame ${i + 1} is now visible on the Home page.` : `Frame ${i + 1} is hidden from visitors.`)
  }

  // THE LIVE MAP FOLLOWS THE LAST RELEASED FRAME.
  //
  // The live territory is what the exports treat as the campaign's present
  // and what the static map shows when there is no replay. With the whole camp
  // generated in advance the live map is still the blank camp-start board, so
  // an exported video played the campaign forward and then ended by wiping
  // every gain off the map. Releasing a frame is the moment the unit's actual
  // position moves, so that is where the live map is brought up to it.
  const syncLiveTo = (rows) => {
    const shown = sortFrames(rows).filter((f) => !f.hidden)
    const last = shown[shown.length - 1]
    if (!last || last.cells === territory.cells) return
    updateSlice(territorySlice(mapId), { ...territory, cells: last.cells })
  }

  // Release everything up to and including frame i — the ordinary end-of-day
  // action, since revealing day 3 without days 1 and 2 would leave the replay
  // jumping over ground nobody saw taken.
  const releaseThrough = (i) => {
    const next = sorted.map((f, k) => ({ ...f, hidden: k > i, updatedAt: Date.now() }))
    writeFrames(next)
    syncLiveTo(next)
    audit('Released campaign frames up to a point', `frames 1-${i + 1} of ${sorted.length}`)
    toast.push(`Frames 1–${i + 1} are now visible; the rest stay hidden.`)
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
    if (defaultStartId === f.id) updateSlice(startSlice, null)
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
    writeFrames([])
    updateSlice(startSlice, null)
    audit('Cleared campaign replay history')
  }

  // Where the public replay's AUTO-PLAY begins (earlier frames stay archived
  // and reachable via the replay's own "jump to frame" picker). Clicking the
  // current default again clears it back to "earliest frame" (the original
  // behaviour).
  const setDefaultStart = (id) => {
    const next = defaultStartId === id ? null : id
    updateSlice(startSlice, next)
    audit(next ? 'Set campaign default start frame' : 'Cleared campaign default start frame')
    toast.push(next ? 'Default start frame set.' : 'Default start cleared — replay starts from the earliest frame again.')
  }

  const doExportImage = async () => {
    setImgErr('')
    setImgBusy(true)
    try {
      const { blob } = await exportProgressImage({ territory, frames: sorted, title: imgTitle, zones, zoneProgress: progressAt(sorted[sorted.length - 1]) })
      downloadBlob(blob, `campaign-progress-${new Date().toISOString().slice(0, 10)}.png`)
      audit('Exported weekly progress image')
    } catch (e) {
      setImgErr(e?.message || 'Image export failed.')
    } finally {
      setImgBusy(false)
    }
  }

  // Every frame, one page each, with the key printed on all of them — the
  // wall-board version of the replay. Pages are rendered at print resolution
  // through the same canvas renderers the video uses (see lib/framesPdf.js).
  const doExportPdf = async () => {
    setPdfErr('')
    setPdfBusy(true)
    try {
      const { blob, pages } = await exportFramesPdf({
        territory, frames: sorted, zones, progressFor: (i) => progressAt(sorted[i]),
      })
      downloadBlob(blob, `campaign-frames-${new Date().toISOString().slice(0, 10)}.pdf`)
      audit('Exported campaign frames as PDF', `${pages} pages`)
      toast.push(`${pages}-page PDF downloaded.`)
    } catch (e) {
      setPdfErr(e?.message || 'PDF export failed.')
    } finally {
      setPdfBusy(false)
    }
  }

  const doExport = async () => {
    setExportErr('')
    setExporting(true)
    setExportPct(0)
    // Export replays against the SAVED territory (what the public sees), not
    // unsaved editor strokes.
    job.current = exportCampaignReplay({
      territory, frames: sorted, zones,
      // Each frame's zone readout is that frame's own camp day, so the export
      // tells the same story the page does rather than stamping today's
      // percentages onto every frame.
      progressFor: (i) => progressAt(sorted[i]),
      onProgress: setExportPct,
    })
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
        {active && (
          <span className="mono dim" style={{ fontSize: 10 }}>
            {count} FRAME{count === 1 ? '' : 'S'} RECORDED
            {hiddenCount > 0 && <span style={{ color: 'var(--accent)' }}> — {count - hiddenCount} RELEASED, {hiddenCount} HELD BACK</span>}
          </span>
        )}
      </div>
      <div className="mono dim" style={{ fontSize: 11 }}>
        {active
          ? 'Replay is live — visitors watch the conquest animate through every RELEASED frame below when the map loads (or jump to any frame themselves via the picker on the Home page). Each frame can be repainted, relabelled, reordered, duplicated or deleted independently. "Set as Default Start" picks which frame the auto-play begins from — earlier frames stay archived and reachable via the picker either way. The live map above is only ever a starting point for the NEXT frame — it doesn\'t appear in the replay itself until you add it. Frames built from the camp plan arrive HIDDEN: use "Reveal" (or "Reveal to here") at the end of each day so progress comes out a day at a time rather than all at once.'
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
        {hasCampPlan(mapId) && (
          <button
            className="ghost"
            onClick={buildFromPlan}
            title={`Generate one frame per camp day from the plan — ground painted by who is scheduled where. Replaces any existing frames.`}
          >
            ⚙ Build {campDays(mapId).length + 1} Frames from Camp Plan
          </button>
        )}
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
        {active && (
          <button
            className="ghost"
            onClick={doExportPdf}
            disabled={count === 0 || pdfBusy || !framesPdfSupported()}
            title={count === 0 ? 'No frames recorded yet' : 'Print every frame to a PDF, one page each, with a key'}
          >
            {pdfBusy ? 'Rendering…' : `🖨 Export ${count} Frame${count === 1 ? '' : 's'} as PDF`}
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
              onToggleLabelOverrides={() => toggleLabelOverrides(i)}
              onToggleHidden={() => toggleHidden(i)}
              onReleaseThrough={() => releaseThrough(i)}
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
      {pdfErr && <div className="mono" style={{ fontSize: 11, color: 'var(--hostile)' }}>{pdfErr}</div>}
    </div>
  )
}

// One frame row. Keeps its own local label text so typing doesn't fire a
// Firestore write per keystroke — the label only commits (onRelabel) when
// the field loses focus or Enter is pressed, and only if it actually changed.
function FrameRow({ f, index, isFirst, isLast, isEditing, isDefaultStart, hasDraft, onMove, onEdit, onDuplicate, onDelete, onRelabel, onSetDefaultStart, onToggleLabelOverrides, onToggleHidden, onReleaseThrough }) {
  const [label, setLabel] = useState(f.label || '')
  useEffect(() => { setLabel(f.label || '') }, [f.label])
  const commit = () => { if (label !== (f.label || '')) onRelabel(label) }

  return (
    <div className="row center wrap" style={{ gap: 8, borderTop: '1px solid var(--line)', paddingTop: 6,
      background: isEditing ? 'rgba(54,224,192,0.08)' : undefined, opacity: f.hidden && !isEditing ? 0.62 : 1 }}>
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
      {f.hidden && <span className="tag mono" style={{ fontSize: 9, flex: '0 0 auto', opacity: 0.8 }} title="Held back — visitors don't see this frame on the Home page yet">◌ HIDDEN</span>}
      {hasDraft && <span className="tag mono" style={{ fontSize: 9, flex: '0 0 auto', color: 'var(--accent)', borderColor: 'var(--accent)' }} title="Repainted but not yet published — the site still shows the old version">● UNPUBLISHED</span>}
      <label className="row center" style={{ gap: 4, flex: '0 0 auto' }}
        title="When checked, this frame shows company labels at the positions dragged in “Arrange company labels manually” above. Unchecked (default), this frame always places labels automatically — a manual position only ever applies to the frames it's turned on for.">
        <input type="checkbox" checked={!!f.useLabelOverrides} onChange={onToggleLabelOverrides} style={{ width: 'auto' }} />
        <span className="mono dim" style={{ fontSize: 10 }}>Manual labels</span>
      </label>
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
        {/* Reveal/hide this one frame; the second button is the end-of-day
            action — bring the replay forward to here and leave the rest held
            back, so the public timeline never has a gap in it. */}
        <button className={f.hidden ? 'ghost' : 'primary'} style={{ padding: '3px 8px' }} onClick={onToggleHidden}
          title={f.hidden ? 'Show this frame on the Home page' : 'Hide this frame from visitors again'}>
          {f.hidden ? 'Reveal' : 'Visible ✓'}
        </button>
        {f.hidden && (
          <button className="ghost" style={{ padding: '3px 8px' }} onClick={onReleaseThrough}
            title="Reveal every frame up to and including this one, and hide everything after it">
            Reveal to here
          </button>
        )}
        <button className="danger ghost" style={{ padding: '3px 8px' }} onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}


// Show / hide the map's camp zones (activity areas, night locations, HQ).
//
// The OUTLINES are committed code — they come from the BIV26 Earth project via
// tools/map/kml-to-zones.py — so there is nothing to edit here, only what is
// on display. That split is deliberate: the ground doesn't move during a camp,
// but what RHQ wants shown at any moment does.
//
// A missing slice means everything shows. So committing a map's zones is
// enough to get them on the map; RHQ only touches this to take something off.
function ZonesPanel({ mapId, slice, onChange }) {
  const groups = zonesByKind(mapId)
  const total = zoneCount(mapId)
  if (!total) return null
  const show = slice?.show !== false
  const hidden = new Set(slice?.hidden || [])
  const shownCount = show ? total - hidden.size : 0

  const setHidden = (next) => onChange({ show, hidden: [...next] })
  const toggleZone = (id) => {
    const next = new Set(hidden)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setHidden(next)
  }
  const toggleKind = (zones) => {
    const next = new Set(hidden)
    const anyShown = zones.some((z) => !next.has(z.id))
    zones.forEach((z) => (anyShown ? next.add(z.id) : next.delete(z.id)))
    setHidden(next)
  }

  return (
    <div className="panel panel-pad col" style={{ gap: 10, marginTop: 14 }}>
      <div className="row between center wrap" style={{ gap: 8 }}>
        <span className="tag">ZONES</span>
        <span className="mono dim" style={{ fontSize: 11 }}>
          {shownCount} of {total} shown — outlines come from the camp Earth project; this controls what is on display
        </span>
        <button
          className={show ? 'ghost' : 'primary'}
          onClick={() => onChange({ show: !show, hidden: [...hidden] })}
          style={{ flex: '0 0 auto' }}
        >
          {show ? 'Hide all zones' : 'Show zones'}
        </button>
      </div>
      {show && groups.map(({ kind, style, zones }) => (
        <div key={kind} className="col" style={{ gap: 6 }}>
          <div className="row center" style={{ gap: 8 }}>
            <span aria-hidden="true" style={{
              width: 12, height: 12, borderRadius: 2, background: style.color,
              opacity: 0.5, border: `1px solid ${style.color}`, flex: '0 0 auto',
            }} />
            <span className="mono" style={{ fontSize: 11, letterSpacing: 1 }}>{style.label.toUpperCase()}</span>
            <button className="ghost" onClick={() => toggleKind(zones)}
              style={{ padding: '1px 8px', fontSize: 10, flex: '0 0 auto' }}>
              {zones.some((z) => !hidden.has(z.id)) ? 'hide all' : 'show all'}
            </button>
          </div>
          <div className="row wrap" style={{ gap: 6 }}>
            {zones.map((z) => {
              const on = !hidden.has(z.id)
              return (
                <button
                  key={z.id}
                  onClick={() => toggleZone(z.id)}
                  title={on ? `Hide ${z.name}` : `Show ${z.name}`}
                  className="ghost"
                  style={{
                    padding: '2px 9px', fontSize: 11, flex: '0 0 auto',
                    opacity: on ? 1 : 0.4,
                    borderColor: on ? style.color : 'var(--line)',
                    color: on ? style.color : 'var(--text-dim)',
                    textDecoration: on ? 'none' : 'line-through',
                  }}
                >
                  {z.name}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
