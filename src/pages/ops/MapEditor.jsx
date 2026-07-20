import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useAudit } from '../../hooks/useAudit'
import { OpsHeader, useSaved } from './OperationsCentre'
import PixelMap from '../../components/PixelMap'
import { PAINT, RHQ_PAINT, colorOf } from '../../lib/territory'

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

  const paint = (x, y, code, sz) => {
    setTerr((t) => {
      const arr = t.cells.split('')
      const r = Math.floor((sz - 1) / 2)
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) arr[ny * cols + nx] = code
      }
      return { ...t, cells: arr.join('') }
    })
  }
  const movePlace = (id, x, y) => setTerr((t) => ({ ...t, places: t.places.map((p) => (p.id === id ? { ...p, x, y } : p)) }))
  const addPlace = () => setTerr((t) => ({ ...t, places: [...t.places, { id: rid(), name: 'New place', x: Math.round(cols / 2), y: Math.round(rows / 2) }] }))
  const setPlace = (id, patch) => setTerr((t) => ({ ...t, places: t.places.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  const delPlace = (id) => setTerr((t) => ({ ...t, places: t.places.filter((p) => p.id !== id) }))
  const clearAll = () => setTerr((t) => ({ ...t, cells: '.'.repeat(cols * rows) }))

  const save = () => { updateSlice('territory', terr); audit('Updated map territory'); flash() }

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
        Pick a colour, then paint on the map. The top row of each pair is solid (firmly held); the “·” one is the lighter, newly-gained/loosely-held variant. Erase removes.
      </div>

      <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
        {swatches.flatMap((p) => [p.code, p.code.toLowerCase()].map((code) => {
          const active = brush === code
          const light = code === code.toLowerCase()
          return (
            <button key={code} onClick={() => setBrush(code)} title={`${p.label}${light ? ' (light)' : ''}`}
              style={{ padding: '6px 9px', border: active ? '2px solid #fff' : '1px solid var(--line)', background: colorOf(code), color: '#04121b', fontSize: 11, fontFamily: 'var(--mono)', borderRadius: 4, cursor: 'pointer' }}>
              {p.code}{light ? '·' : ''}
            </button>
          )
        }))}
        <button onClick={() => setBrush('.')} style={{ padding: '6px 12px', border: brush === '.' ? '2px solid #fff' : '1px solid var(--line)', background: 'transparent', color: 'var(--text)', fontSize: 11, borderRadius: 4, cursor: 'pointer' }}>Erase</button>
      </div>
      <div className="row center" style={{ gap: 8, marginBottom: 12 }}>
        <span className="mono dim" style={{ fontSize: 11 }}>Brush size</span>
        {[1, 2, 3, 5].map((s) => <button key={s} className={size === s ? 'primary' : 'ghost'} onClick={() => setSize(s)} style={{ padding: '3px 9px' }}>{s}</button>)}
        <button className="danger ghost" onClick={clearAll} style={{ marginLeft: 'auto' }}>Clear all</button>
      </div>

      <PixelMap territory={terr} edit brush={brush} brushSize={size} onPaint={paint} onMovePlace={movePlace} height={460} />

      <div className="panel panel-pad col" style={{ gap: 8, marginTop: 14 }}>
        <div className="row between center"><strong className="head" style={{ fontSize: 14 }}>Place names</strong><button className="ghost" onClick={addPlace}>+ Add place</button></div>
        {terr.places.length === 0 && <div className="mono dim" style={{ fontSize: 12 }}>No place labels.</div>}
        {terr.places.map((p) => (
          <div key={p.id} className="row center" style={{ gap: 8 }}>
            <input value={p.name} onChange={(e) => setPlace(p.id, { name: e.target.value })} />
            <span className="mono dim" style={{ fontSize: 10 }}>drag its dot on the map</span>
            <button className="danger ghost" onClick={() => delPlace(p.id)}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  )
}
