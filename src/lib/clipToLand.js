import polygonClipping from 'polygon-clipping'
import { AUSTRALIA_LAND } from './australiaOutline'

// Zone polygons are stored as [lat, lng] pairs; the clipping library and the
// land outline use [lng, lat] (x, y) order, so convert on the way in and out.
const toXY = (p) => [p[1], p[0]]
const toLatLng = (p) => [p[1], p[0]]

// Clip a zone polygon to the Australian coastline so it can never extend past
// land. `coords` is an array of [lat, lng]. Returns a Leaflet multipolygon —
// an array of polygons, each `[outerRing]` of [lat, lng] points — hugging the
// coast, or null if the zone lies entirely offshore.
export function clipToLand(coords) {
  if (!Array.isArray(coords) || coords.length < 3) return null
  try {
    const result = polygonClipping.intersection([coords.map(toXY)], AUSTRALIA_LAND)
    if (!result || result.length === 0) return null
    // result is a MultiPolygon [poly][ring][pt]; keep each piece's outer ring.
    return result.map((poly) => [poly[0].map(toLatLng)])
  } catch {
    return null
  }
}
