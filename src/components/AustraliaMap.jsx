import { MapContainer, TileLayer, Polygon, Tooltip } from 'react-leaflet'
import { COMPANIES } from '../firebase/seed'

// Bounds clamp the viewport to the Australian continent — the user can zoom
// to regions but never pan off Australia.
const AU_BOUNDS = [
  [-44.5, 112.0], // south-west
  [-9.5, 154.5], // north-east
]
const AU_CENTER = [-25.6, 134.4]

const OCCUPANT_COLORS = {
  Meridian: { color: '#ff3b46', fill: '#ff3b46' },
  Contested: { color: '#ffcf4a', fill: '#ffcf4a' },
}
function colorFor(occupant) {
  if (OCCUPANT_COLORS[occupant]) return OCCUPANT_COLORS[occupant]
  const c = COMPANIES.find((x) => x.name === occupant)
  const col = c?.accent || '#36e0c0'
  return { color: col, fill: col }
}

export default function AustraliaMap({ zones = [], height = 520, onZoneClick }) {
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
        zoomControl={true}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
          noWrap
        />
        {zones.map((z) => {
          const c = colorFor(z.occupant)
          return (
            <Polygon
              key={z.id}
              positions={z.coords}
              eventHandlers={{ click: () => onZoneClick && onZoneClick(z) }}
              pathOptions={{
                color: c.color,
                weight: 2,
                fillColor: c.fill,
                fillOpacity: z.occupant === 'Meridian' ? 0.35 : 0.22,
                dashArray: z.occupant === 'Contested' ? '6 6' : null,
              }}
            >
              <Tooltip sticky>
                <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  <strong>{z.name}</strong>
                  <br />
                  <span style={{ color: z.occupant === 'Meridian' ? '#ff3b46' : '#36e0c0' }}>
                    {z.occupant}
                  </span>
                </div>
              </Tooltip>
            </Polygon>
          )
        })}
      </MapContainer>
    </div>
  )
}
