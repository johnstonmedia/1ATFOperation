import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useAudit } from '../../hooks/useAudit'
import { OpsHeader, useSaved } from './OperationsCentre'
import { Field } from './NarrativeEditor'
import AustraliaMap, { centroid } from '../../components/AustraliaMap'
import { COMPANIES } from '../../firebase/seed'
import { AU_STATE_NAMES } from '../../lib/australiaStates'

const OCCUPANTS = [...COMPANIES.map((c) => c.name), 'Meridian', 'Contested']

// Build a default shape centred on the continent.
function rectAt(lat = -25, lng = 134, dLat = 3, dLng = 4) {
  return [[lat + dLat, lng - dLng], [lat + dLat, lng + dLng], [lat - dLat, lng + dLng], [lat - dLat, lng - dLng]]
}

// Drag zones to position them, drag the corner handles to reshape. Zones are
// either rectangles (corner drag keeps them square) or custom polygons. Arrows
// connect zones: dotted = intended plan, solid = current movement.
export default function MapEditor() {
  const { state, updateSlice, makeId } = useData()
  const [zones, setZones] = useState(state.zones)
  const [arrows, setArrows] = useState(state.arrows || [])
  const [selId, setSelId] = useState(zones[0]?.id || null)
  const [saved, flash] = useSaved()
  const confirm = useConfirm()
  const audit = useAudit()

  const save = () => {
    updateSlice('zones', zones)
    updateSlice('arrows', arrows)
    audit('Updated operational map', `${zones.length} zones, ${arrows.length} movement lines`)
    flash()
  }

  const setZone = (id, patch) => setZones((zs) => zs.map((z) => (z.id === id ? { ...z, ...patch } : z)))
  const onEditChange = (updated) => setZones((zs) => zs.map((z) => (z.id === updated.id ? updated : z)))
  const removeZone = async (id) => {
    const z = zones.find((x) => x.id === id)
    const ok = await confirm({
      title: 'Remove zone',
      message: `Remove “${z?.name || 'this zone'}” and any movement lines using it? This applies when you next save the map.`,
      danger: true,
      confirmLabel: 'Remove',
    })
    if (!ok) return
    setZones((zs) => zs.filter((x) => x.id !== id))
    setArrows((as) => as.filter((a) => a.from !== id && a.to !== id))
    if (selId === id) setSelId(null)
  }
  // A custom zone starts life as a rectangle and is freely reshaped.
  const addCustom = () => {
    const id = makeId()
    setZones((zs) => [...zs, { id, name: 'New Zone', occupant: 'Contested', shape: 'custom', coords: rectAt() }])
    setSelId(id)
  }
  // A state zone snaps to the borders of the selected state(s).
  const addState = () => {
    const id = makeId()
    setZones((zs) => [...zs, { id, name: 'New State Zone', occupant: 'Contested', shape: 'state', states: [] }])
    setSelId(id)
  }

  const sel = zones.find((z) => z.id === selId)
  const isCustom = (z) => z && z.shape !== 'state' && Array.isArray(z.coords)
  const toggleState = (z, name) => {
    const have = z.states || []
    setZone(z.id, { states: have.includes(name) ? have.filter((s) => s !== name) : [...have, name] })
  }

  // custom-polygon vertex add/remove
  const addVertex = () => {
    if (!isCustom(sel)) return
    const c = centroid(sel.coords)
    setZone(sel.id, { coords: [...sel.coords, [c[0] - 1, c[1] + 1]] })
  }
  const removeVertex = () => {
    if (!isCustom(sel) || sel.coords.length <= 3) return
    setZone(sel.id, { coords: sel.coords.slice(0, -1) })
  }

  return (
    <div>
      <OpsHeader title="Operational Map" sub="EDIT // ZONES & MOVEMENTS" updatedAt={state.contentMeta?.zones?.updatedAt}>
        <button className="ghost" onClick={addCustom}>+ Custom</button>
        <button className="ghost" onClick={addState}>+ State(s)</button>
        <button className="primary" onClick={save}>{saved ? 'Saved ✓' : 'Save map'}</button>
      </OpsHeader>

      <div className="mono dim" style={{ fontSize: 11, marginBottom: 10 }}>
        Custom zones start as a rectangle — drag the ✥ handle to move the whole shape, or the round handles to reshape it.
        State zones snap to the selected borders. Fills hug the coastline and never overlap; same-occupant zones share one border.
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <AustraliaMap zones={zones} arrows={arrows} height={420} editId={selId} onEditChange={onEditChange} onZoneClick={(z) => setSelId(z.id)} />
      </div>

      {/* Zone list / editor */}
      <div className="col" style={{ gap: 10, marginBottom: 22 }}>
        {zones.map((z) => (
          <div
            key={z.id}
            className="panel panel-pad row wrap"
            style={{ gap: 12, alignItems: 'flex-end', borderColor: z.id === selId ? 'var(--accent)' : 'var(--line)' }}
          >
            <button className={z.id === selId ? 'primary' : 'ghost'} onClick={() => setSelId(z.id)} style={{ alignSelf: 'center' }}>
              {z.id === selId ? 'Editing' : 'Select'}
            </button>
            <div className="grow" style={{ minWidth: 160 }}>
              <Field label="Zone name"><input value={z.name} onChange={(e) => setZone(z.id, { name: e.target.value })} /></Field>
            </div>
            <div style={{ minWidth: 150 }}>
              <Field label="Occupant">
                <select value={z.occupant} onChange={(e) => setZone(z.id, { occupant: e.target.value })}
                  style={{ color: z.occupant === 'Meridian' ? 'var(--hostile)' : 'var(--text)' }}>
                  {OCCUPANTS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            </div>
            <span className="tag">{z.shape === 'state' ? 'STATE(S)' : 'CUSTOM'}</span>
            <button className="danger ghost" onClick={() => removeZone(z.id)}>Remove</button>
            {z.shape === 'state' && (
              <div className="col" style={{ gap: 4, flexBasis: '100%' }}>
                <label className="mono dim" style={{ fontSize: 10 }}>States / territories</label>
                <div className="row wrap" style={{ gap: 6 }}>
                  {AU_STATE_NAMES.map((s) => {
                    const on = (z.states || []).includes(s)
                    return (
                      <button
                        key={s}
                        className={on ? 'primary' : 'ghost'}
                        onClick={() => toggleState(z, s)}
                        style={{ padding: '4px 9px', fontSize: 11 }}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
        {isCustom(sel) && (
          <div className="row" style={{ gap: 8 }}>
            <button className="ghost" onClick={addVertex}>+ Add corner to “{sel.name}”</button>
            <button className="ghost" onClick={removeVertex} disabled={sel.coords.length <= 3}>− Remove corner</button>
          </div>
        )}
      </div>

      {/* Arrows / movements */}
      <ArrowsEditor zones={zones} arrows={arrows} setArrows={setArrows} makeId={makeId} />
    </div>
  )
}

function ArrowsEditor({ zones, arrows, setArrows, makeId }) {
  const [draft, setDraft] = useState({ from: '', to: '', type: 'current' })
  const nameOf = (id) => zones.find((z) => z.id === id)?.name || '—'

  const add = () => {
    if (!draft.from || !draft.to || draft.from === draft.to) return
    setArrows([...arrows, { id: makeId(), ...draft }])
    setDraft({ from: '', to: '', type: 'current' })
  }
  const remove = (id) => setArrows(arrows.filter((a) => a.id !== id))

  return (
    <div className="panel panel-pad col" style={{ gap: 12 }}>
      <div className="row between center wrap" style={{ gap: 8 }}>
        <strong className="head">Movement Lines</strong>
        <span className="mono dim" style={{ fontSize: 11 }}>dotted = planned · solid = current</span>
      </div>

      <div className="row wrap" style={{ gap: 10, alignItems: 'flex-end' }}>
        <div style={{ minWidth: 150 }}>
          <Field label="From zone">
            <select value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })}>
              <option value="">—</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ minWidth: 150 }}>
          <Field label="To zone">
            <select value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })}>
              <option value="">—</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ minWidth: 150 }}>
          <Field label="Type">
            <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              <option value="current">Current (solid)</option>
              <option value="planned">Planned (dotted)</option>
            </select>
          </Field>
        </div>
        <button className="ghost" onClick={add}>+ Add line</button>
      </div>

      <div className="col" style={{ gap: 6 }}>
        {arrows.length === 0 && <div className="mono dim" style={{ fontSize: 12 }}>No movement lines yet.</div>}
        {arrows.map((a) => (
          <div key={a.id} className="row between center" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <span className="mono" style={{ fontSize: 13 }}>
              {nameOf(a.from)} <span className="accent">→</span> {nameOf(a.to)}
              <span className="dim"> · {a.type === 'planned' ? 'planned' : 'current'}</span>
            </span>
            <button className="danger ghost" onClick={() => remove(a.id)} style={{ padding: '4px 10px' }}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  )
}
