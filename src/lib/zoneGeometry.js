import polygonClipping from 'polygon-clipping'
import { AUSTRALIA_LAND } from './australiaOutline'
import { AU_STATES } from './australiaStates'

// Geometry helpers for the operational map. Zones come in two kinds:
//   - custom: a free polygon (created as a rectangle), clipped to the coastline.
//   - state:  the union of one or more Australian state/territory outlines.
// Everything here works in polygon-clipping's [x, y] = [lng, lat] order; Leaflet
// wants [lat, lng], so we convert at the edges.

const toXY = (p) => [p[1], p[0]]
const toLatLng = (p) => [p[1], p[0]]

// Convert a polygon-clipping MultiPolygon to Leaflet positions (preserving holes).
export function mpToLatLng(mp) {
  return mp.map((poly) => poly.map((ring) => ring.map(toLatLng)))
}

function ringArea(ring) {
  let a = 0
  for (let i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
  }
  return Math.abs(a / 2)
}
function mpArea(mp) {
  return mp.reduce((s, poly) => s + ringArea(poly[0]), 0)
}

// Centre of a MultiPolygon: centroid of the largest piece's outer ring.
function mpCenter(mp) {
  let best = mp[0][0]
  let bestA = -1
  for (const poly of mp) {
    const a = ringArea(poly[0])
    if (a > bestA) { bestA = a; best = poly[0] }
  }
  const n = best.length || 1
  const s = best.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
  return [s[1] / n, s[0] / n] // [lat, lng]
}

// Base geometry for a zone as a polygon-clipping MultiPolygon (or null).
export function zoneBaseMP(zone) {
  if (zone.shape === 'state') {
    const mps = (zone.states || []).map((s) => AU_STATES[s]).filter(Boolean)
    if (!mps.length) return null
    try {
      return mps.length === 1 ? mps[0] : polygonClipping.union(...mps)
    } catch {
      return null
    }
  }
  // custom (default) — a polygon clipped to the Australian coastline.
  const coords = zone.coords
  if (!Array.isArray(coords) || coords.length < 3) return null
  try {
    const r = polygonClipping.intersection([coords.map(toXY)], AUSTRALIA_LAND)
    return r && r.length ? r : null
  } catch {
    return null
  }
}

export function zoneCenter(zone) {
  const mp = zoneBaseMP(zone)
  return mp ? mpCenter(mp) : null
}

// Resolve all zones into render geometry:
//   - fills:   one entry per zone, with overlaps removed so a smaller zone of a
//              DIFFERENT occupant "punches" the larger one (containment → hole).
//              Same-occupant overlaps are left to merge.
//   - strokes: one outline per occupant (union of that occupant's fills), so
//              adjacent same-occupant zones lose their internal dividing border.
//   - centers: zone id → [lat, lng] for arrow endpoints.
export function composeZones(zones) {
  const items = zones
    .map((zone, idx) => ({ zone, idx, base: zoneBaseMP(zone) }))
    .filter((i) => i.base)
  items.forEach((i) => { i.area = mpArea(i.base) })

  // A zone is "on top of" another if it is smaller (ties broken by later index).
  const onTopOf = (a, b) => a.area < b.area || (a.area === b.area && a.idx > b.idx)

  const fills = []
  const centers = {}
  for (const i of items) {
    centers[i.zone.id] = mpCenter(i.base)
    const cutters = items.filter(
      (o) => o !== i && onTopOf(o, i) && o.zone.occupant !== i.zone.occupant,
    )
    let geom = i.base
    if (cutters.length) {
      try {
        geom = polygonClipping.difference(i.base, ...cutters.map((c) => c.base))
      } catch {
        geom = i.base
      }
    }
    if (geom && geom.length) fills.push({ zone: i.zone, geom })
  }

  const byOcc = {}
  for (const f of fills) (byOcc[f.zone.occupant] ||= []).push(f.geom)
  const strokes = Object.entries(byOcc).map(([occupant, geoms]) => {
    let geom = geoms[0]
    if (geoms.length > 1) {
      try { geom = polygonClipping.union(...geoms) } catch { geom = geoms[0] }
    }
    return { occupant, geom }
  })

  return { fills, strokes, centers }
}
