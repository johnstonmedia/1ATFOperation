import { Fragment, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Polygon, Polyline, Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { COMPANIES } from '../firebase/seed'
import { composeZones, mpToLatLng, zoneBaseMP, arrowEndpoints } from '../lib/zoneGeometry'

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
  html: '<div title="Drag to reshape the zone" style="width:14px;height:14px;background:#36e0c0;border:2px solid #04121b;border-radius:50%;box-shadow:0 0 6px rgba(54,224,192,0.8)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})
const moveIcon = L.divIcon({
  className: 'zone-handle',
  html: '<div title="Drag to move the whole zone" style="width:26px;height:26px;border:2px solid #4ea8ff;border-radius:50%;background:rgba(78,168,255,0.25);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px">✥</div>',
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

export default function AustraliaMap({
  zones = [],
  arrows = [],
  height = 520,
  onZoneClick,
  editId = null,
  onEditChange,
}) {
  const zoneById = (id) => zones.find((z) => z.id === id)
  const dragRef = useRef(null) // live state for the move handle

  // Resolve zones into render geometry: overlaps removed, same-occupant seams
  // dissolved, plus centres for arrow endpoints. Memoised so dragging only pays
  // the cost when geometry actually changes.
  const { fills, strokes } = useMemo(() => composeZones(zones), [zones])

  // Border-hugging endpoints for each movement line (memoised — geometry only
  // changes when zones or arrows change).
  const arrowSegs = useMemo(() => {
    const byId = (id) => zones.find((z) => z.id === id)
    return arrows
      .map((ar) => {
        const from = byId(ar.from)
        const to = byId(ar.to)
        if (!from || !to) return null
        const seg = arrowEndpoints(from, to)
        return seg ? { ar, from, seg } : null
      })
      .filter(Boolean)
  }, [arrows, zones])

  return (
    <div
      role="region"
      aria-label="Operational map of Australia"
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
        maxZoom={14}
        maxBounds={AU_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap &copy; CARTO"
          maxZoom={20}
          noWrap
        />

        {/* Zone fills — overlaps already resolved; no per-zone border (seams
            between same-occupant zones are removed by the occupant outline). */}
        {fills.map(({ zone: z, geom }) => {
          const col = colorFor(z.occupant)
          return (
            <Polygon
              key={z.id}
              positions={mpToLatLng(geom)}
              eventHandlers={{ click: () => onZoneClick && onZoneClick(z) }}
              pathOptions={{
                stroke: false,
                fillColor: col,
                fillOpacity: z.occupant === 'Meridian' ? 0.35 : 0.22,
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

        {/* One outline per occupant — adjacent same-occupant zones share a single
            border, so the darker dividing line between them disappears. */}
        {strokes.map(({ occupant, geom }) => (
          <Polygon
            key={`stroke-${occupant}`}
            positions={mpToLatLng(geom)}
            interactive={false}
            pathOptions={{
              color: colorFor(occupant),
              weight: 2,
              fill: false,
              dashArray: occupant === 'Contested' ? '6 6' : null,
            }}
          />
        ))}

        {/* Movement arrows — each hugs the border it crosses so many attackers on
            one target fan out instead of converging on a single point. */}
        {arrowSegs.map(({ ar, from, seg }) => {
          const { a, b } = seg
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

        {/* Editing handles — only custom zones are reshaped here; state zones
            take fixed borders, so they expose no handles. */}
        {editId &&
          onEditChange &&
          (() => {
            const z = zoneById(editId)
            if (!z) return null
            // White outline of the selected zone so it stands out while editing.
            const baseMP = zoneBaseMP(z)
            const highlight = baseMP && (
              <Polygon
                positions={mpToLatLng(baseMP)}
                interactive={false}
                pathOptions={{ color: '#fff', weight: 2, fill: false }}
              />
            )
            if (z.shape === 'state' || !Array.isArray(z.coords)) return highlight
            const center = centroid(z.coords)
            return (
              <>
                {highlight}
                <Marker
                  position={center}
                  icon={moveIcon}
                  draggable
                  eventHandlers={{
                    dragstart: (e) => { dragRef.current = { coords: z.coords, last: e.target.getLatLng() } },
                    drag: (e) => {
                      const st = dragRef.current
                      if (!st) return
                      const p = e.target.getLatLng()
                      const dLat = p.lat - st.last.lat
                      const dLng = p.lng - st.last.lng
                      st.coords = st.coords.map(([la, ln]) => [clampLat(la + dLat), clampLng(ln + dLng)])
                      st.last = p
                      onEditChange({ ...z, coords: st.coords })
                    },
                    dragend: () => { dragRef.current = null },
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
                        onEditChange({ ...z, coords: z.coords.map((c, idx) => (idx === i ? ll : c)) })
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
