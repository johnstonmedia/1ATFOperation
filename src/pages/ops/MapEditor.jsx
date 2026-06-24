import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { OpsHeader, useSaved } from './OperationsCentre'
import { Field } from './NarrativeEditor'
import AustraliaMap from '../../components/AustraliaMap'
import { COMPANIES } from '../../firebase/seed'

const OCCUPANTS = [...COMPANIES.map((c) => c.name), 'Meridian', 'Contested']

// Update which company / Meridian occupies each territory, edit zone names,
// and add or remove zones. Live preview reflects edits before saving.
export default function MapEditor() {
  const { state, updateSlice, makeId } = useData()
  const [zones, setZones] = useState(state.zones)
  const [saved, flash] = useSaved()

  const save = () => {
    updateSlice('zones', zones)
    flash()
  }
  const setZone = (id, patch) => setZones(zones.map((z) => (z.id === id ? { ...z, ...patch } : z)))
  const remove = (id) => setZones(zones.filter((z) => z.id !== id))
  const add = () =>
    setZones([
      ...zones,
      { id: makeId(), name: 'New Zone', occupant: 'Contested', coords: [[-25, 132], [-25, 138], [-30, 138], [-30, 132]] },
    ])

  return (
    <div>
      <OpsHeader title="Operational Map" sub="EDIT // ZONE CONTROL">
        <button className="ghost" onClick={add}>+ Add zone</button>
        <button className="primary" onClick={save}>{saved ? 'Saved ✓' : 'Save map'}</button>
      </OpsHeader>

      <div className="panel" style={{ marginBottom: 18 }}>
        <AustraliaMap zones={zones} height={360} />
      </div>

      <div className="col" style={{ gap: 12 }}>
        {zones.map((z) => (
          <div key={z.id} className="panel panel-pad row wrap" style={{ gap: 12, alignItems: 'flex-end' }}>
            <div className="grow" style={{ minWidth: 180 }}>
              <Field label="Zone name"><input value={z.name} onChange={(e) => setZone(z.id, { name: e.target.value })} /></Field>
            </div>
            <div style={{ minWidth: 160 }}>
              <Field label="Occupant">
                <select value={z.occupant} onChange={(e) => setZone(z.id, { occupant: e.target.value })}
                  style={{ color: z.occupant === 'Meridian' ? 'var(--hostile)' : 'var(--text)' }}>
                  {OCCUPANTS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            </div>
            <div className="grow" style={{ minWidth: 220 }}>
              <Field label="Coordinates [lat,lng] (advanced)">
                <input
                  className="mono"
                  value={JSON.stringify(z.coords)}
                  onChange={(e) => {
                    try { setZone(z.id, { coords: JSON.parse(e.target.value) }) } catch { /* keep typing */ }
                  }}
                />
              </Field>
            </div>
            <button className="danger ghost" onClick={() => remove(z.id)}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  )
}
