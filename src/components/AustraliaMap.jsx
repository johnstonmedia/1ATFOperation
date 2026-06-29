import { Fragment } from 'react'
import { MapContainer, TileLayer, Polygon, Polyline, Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { COMPANIES } from '../firebase/seed'

// Bounds clamp the viewport to the Australian continent.
const AU_BOUNDS = [
  [-44.5, 112.0],
  [-9.5, 154.5],
]
const AU_CENTER = [-25.6, 134.4]

const OCCUPANT_COLORS = {
  Meridian: '#ff3b46',
  Contested: '#ffcf4a',
}
function colorFor(occupant) {
  if (OCCUPANT_COLORS[occupant]) return OCCUPANT_COLORS[occupant]
  return COMPANIES.find((x) => x.name === occupant)?.accent || '#36e0c0'
}

const clampLat = (v) => Math.max(AU_BOUNDS[0][0], Math.min(AU_BOUNDS[1][0], v))
const clampLng = (v) => Math.max(AU_BOUNDS[0][1], Math.min(AU_BOUNDS[1][1], v))

export function centroid(coords) {
  const n = coords.length || 1
  const s = coords.reduce((a, c) => [a[0] + c[0], a[1] + c[1]], [0, 0])
  return [s[0] / n, s[1] / n]
}

function bearingDeg(from, to) {
  const dLat = to[0] - from[0]
  const dLng = (to[1] - from[1]) * Math.cos((((from[0] + to[0]) / 2) * Math.PI) / 180)
  return (Math.atan2(dLng, dLat) * 180) / Math.PI // 0 = north (up)
}

const vertexIcon = L.divIcon({
  className: 'zone-handle',
  html: '<div style="width:14px;height:14px;background:#36e0c0;border:2px solid #04121b;border-radius:50%;box-shadow:0 0 6px rgba(54,224,192,0.8)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})
const moveIcon = L.divIcon({
  className: 'zone-handle',
  html: '<div style="width:26px;height:26px;border:2px solid #4ea8ff;border-radius:50%;background:rgba(78,168,255,0.25);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px">✥</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
})
function arrowHeadIcon(angle, color) {
  return L.divIcon({
    className: 'arrow-head',
    html: `<div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:14px solid ${color};transform:rotate(${angle}deg);transform-origin:50% 60%"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 8],
  })
}

// Recompute an axis-aligned rectangle's 4 corners when corner `i` is dragged,
// keeping the opposite corner fixed. Corner order: [NW, NE, SE, SW].
function resizeRect(coords, i, ll) {
  const opp = coords[(i + 2) % 4]
  const n = Math.max(ll[0], opp[0])
  const s = Math.min(ll[0], opp[0])
  const w = Math.min(ll[1], opp[1])
  const e = Math.max(ll[1], opp[1])
  return [[n, w], [n, e], [s, e], [s, w]]
}

export default function AustraliaMap({
  zones = [],
  arrows = [],
  height = 520,
  onZoneClick,
  editId = null,
  onEditChange,
}) {
  const zoneById = (id) => zones.find((z) => z.id === id)

  return (
    <div
      style={{
        height,
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: 'inset 0 0 60px rgba(0,0,0,0.6)',
      }}
    >
      <MapContainer
        center={AU_CENTER}
        zoom={4}
        minZoom={4}
        maxZoom={9}
        maxBounds={AU_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap &copy; CARTO"
          noWrap
        />

        {/* Zones */}
        {zones.map((z) => {
          const col = colorFor(z.occupant)
          const isEdit = z.id === editId
          return (
            <Polygon
              key={z.id}
              positions={z.coords}
              eventHandlers={{ click: () => onZoneClick && onZoneClick(z) }}
              pathOptions={{
                color: isEdit ? '#fff' : col,
                weight: isEdit ? 3 : 2,
                fillColor: col,
                fillOpacity: z.occupant === 'Meridian' ? 0.35 : 0.22,
                dashArray: z.occupant === 'Contested' ? '6 6' : null,
              }}
            >
              <Tooltip sticky>
                <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  <strong>{z.name}</strong>
                  <br />
                  <span style={{ color: z.occupant === 'Meridian' ? '#ff3b46' : '#36e0c0' }}>{z.occupant}</span>
                </div>
              </Tooltip>
            </Polygon>
          )
        })}

        {/* Movement arrows */}
        {arrows.map((ar) => {
          const from = zoneById(ar.from)
          const to = zoneById(ar.to)
          if (!from || !to) return null
          const a = centroid(from.coords)
          const b = centroid(to.coords)
          const planned = ar.type === 'planned'
          // Line colour follows the occupant of the zone being advanced FROM, so
          // an Alpha-held zone pushing outward draws an Alpha-blue line.
          const color = colorFor(from.occupant)
          return (
            <Fragment key={ar.id}>
              <Polyline
                positions={[a, b]}
                pathOptions={{ color, weight: 3, dashArray: planned ? '6 10' : null, opacity: 0.9 }}
              />
              <Marker position={b} icon={arrowHeadIcon(bearingDeg(a, b), color)} interactive={false} />
            </Fragment>
          )
        })}

        {/* Editing handles for the selected zone */}
        {editId &&
          onEditChange &&
          (() => {
            const z = zoneById(editId)
            if (!z) return null
            return (
              <>
                <Marker
                  position={centroid(z.coords)}
                  icon={moveIcon}
                  draggable
                  eventHandlers={{
                    dragend: (e) => {
                      const c = centroid(z.coords)
                      const p = e.target.getLatLng()
                      const dLat = p.lat - c[0]
                      const dLng = p.lng - c[1]
                      onEditChange({
                        ...z,
                        coords: z.coords.map(([la, ln]) => [clampLat(la + dLat), clampLng(ln + dLng)]),
                      })
                    },
                  }}
                />
                {z.coords.map((pt, i) => (
                  <Marker
                    key={i}
                    position={pt}
                    icon={vertexIcon}
                    draggable
                    eventHandlers={{
                      drag: (e) => {
                        const ll = [clampLat(e.target.getLatLng().lat), clampLng(e.target.getLatLng().lng)]
                        if (z.shape === 'rect') {
                          onEditChange({ ...z, coords: resizeRect(z.coords, i, ll) })
                        } else {
                          onEditChange({ ...z, coords: z.coords.map((c, idx) => (idx === i ? ll : c)) })
                        }
                      },
                    }}
                  />
                ))}
              </>
            )
          })()}
      </MapContainer>
    </div>
  )
}
