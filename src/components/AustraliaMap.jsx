import { Fragment, useMemo, useRef, useEffect } from 'react'
import { MapContainer, ImageOverlay, Polygon, Polyline, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { COMPANIES, CAPITALS } from '../firebase/seed'
import { composeZones, mpToLatLng, zoneBaseMP, zoneCenter, arrowEndpoints } from '../lib/zoneGeometry'

// Exposes the Leaflet map instance to the parent (so the editor can add a zone
// centred on whatever the user is currently looking at).
function MapRef({ onMap }) {
  const map = useMap()
  useEffect(() => { if (onMap) onMap(map) }, [map, onMap])
  return null
}

function capitalIcon(name) {
  return L.divIcon({
    className: 'capital-dot',
    html: `<div style="display:flex;align-items:center;gap:4px;white-space:nowrap"><span style="width:6px;height:6px;border-radius:50%;background:#fff;box-shadow:0 0 5px #fff;display:inline-block"></span><span style="color:#dff;font:600 10px 'JetBrains Mono',monospace;text-shadow:0 1px 3px #000">${name}</span></div>`,
    iconSize: [0, 0],
    iconAnchor: [3, 3],
  })
}
function hqIcon(name, color) {
  return L.divIcon({
    className: 'hq-marker',
    html: `<div style="display:flex;align-items:center;gap:5px;white-space:nowrap"><span style="width:14px;height:14px;background:${color};border:2px solid #04121b;transform:rotate(45deg);box-shadow:0 0 7px ${color};display:inline-block"></span><span style="color:#fff;font:700 11px 'JetBrains Mono',monospace;text-shadow:0 1px 3px #000">HQ · ${name}</span></div>`,
    iconSize: [0, 0],
    iconAnchor: [7, 7],
  })
}

// Operating area: a slice of NSW (Lithgow/Blue Mountains across Sydney to the
// Hunter). The map is a fixed terrain image over these bounds — swap the image
// at public/map/nsw-terrain.jpg and nudge these bounds so landmarks line up.
const AU_BOUNDS = [
  [-34.70, 148.90],
  [-32.55, 152.50],
]
const AU_CENTER = [-33.6, 150.7]
const MAP_IMAGE = import.meta.env.BASE_URL + 'map/nsw-terrain.jpeg'

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

// Fits the view to the region on load and forbids zooming out past it.
function LockToRegion() {
  const map = useMap()
  useEffect(() => {
    const b = L.latLngBounds(AU_BOUNDS)
    map.fitBounds(b)
    map.setMinZoom(map.getBoundsZoom(b))
    map.setMaxBounds(b.pad(0.03))
  }, [map])
  return null
}

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
function conquestBadge(text, color) {
  return L.divIcon({
    className: 'conquest-badge',
    html: `<div style="background:${color};color:#04121b;font:700 10px 'JetBrains Mono',monospace;padding:2px 7px;border-radius:10px;white-space:nowrap;border:1px solid rgba(0,0,0,0.45);box-shadow:0 1px 4px rgba(0,0,0,0.5)">${text}</div>`,
    iconSize: [10, 10],
    iconAnchor: [0, 0],
  })
}

export default function AustraliaMap({
  zones = [],
  arrows = [],
  markers = [],
  height = 520,
  onZoneClick,
  editId = null,
  onEditChange,
  onMarkerMove,
  onMap,
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

  // Gradual conquest: a target zone tinted toward the attacker's colour by the
  // line's progress. If several lines target one zone, the furthest wins.
  const conquests = useMemo(() => {
    const m = {}
    for (const ar of arrows) {
      const p = ar.progress || 0
      if (p <= 0) continue
      const from = zones.find((z) => z.id === ar.from)
      const to = zones.find((z) => z.id === ar.to)
      if (!from || !to) continue
      if (!m[ar.to] || p > m[ar.to].progress) m[ar.to] = { toId: ar.to, occupant: from.occupant, progress: p }
    }
    return Object.values(m)
  }, [arrows, zones])

  return (
    <div
      role="region"
      aria-label="Operational map (NSW area)"
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
        zoom={9}
        maxZoom={15}
        maxBounds={AU_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%', background: '#0a0f1a' }}
      >
        <ImageOverlay url={MAP_IMAGE} bounds={AU_BOUNDS} />
        <LockToRegion />
        <MapRef onMap={onMap} />

        {/* Capital-city reference dots. */}
        {CAPITALS.map((c) => (
          <Marker key={c.name} position={[c.lat, c.lng]} icon={capitalIcon(c.name)} interactive={false} />
        ))}

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

        {/* Gradual conquest tint on target zones. */}
        {conquests.map((c) => {
          const z = zones.find((x) => x.id === c.toId)
          const mp = z && zoneBaseMP(z)
          const center = z && zoneCenter(z)
          if (!mp) return null
          const col = colorFor(c.occupant)
          return (
            <Fragment key={`cq-${c.toId}`}>
              <Polygon positions={mpToLatLng(mp)} interactive={false} pathOptions={{ stroke: false, fillColor: col, fillOpacity: 0.55 * (c.progress / 100) }} />
              {center && <Marker position={center} icon={conquestBadge(`${c.occupant} ${c.progress}%`, col)} interactive={false} />}
            </Fragment>
          )
        })}

        {/* Movement arrows — each hugs the border it crosses so many attackers on
            one target fan out instead of converging on a single point. Dotted
            while planned; solid once advancing (progress > 0). */}
        {arrowSegs.map(({ ar, from, seg }) => {
          const { a, b } = seg
          const advancing = (ar.progress || 0) > 0 || ar.type === 'current'
          // Line colour follows the occupant of the zone being advanced FROM, so
          // an Alpha-held zone pushing outward draws an Alpha-blue line.
          const color = colorFor(from.occupant)
          return (
            <Fragment key={ar.id}>
              <Polyline
                positions={[a, b]}
                pathOptions={{ color, weight: 3, dashArray: advancing ? null : '6 10', opacity: 0.9 }}
              />
              <Marker position={b} icon={arrowHeadIcon(bearingDeg(a, b), color)} interactive={false} />
            </Fragment>
          )
        })}

        {/* HQ / point markers — draggable to reposition while editing. */}
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={hqIcon(m.name || 'HQ', colorFor(m.occupant))}
            draggable={Boolean(onMarkerMove)}
            eventHandlers={onMarkerMove ? { dragend: (e) => { const p = e.target.getLatLng(); onMarkerMove(m.id, p.lat, p.lng) } } : undefined}
          />
        ))}

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
