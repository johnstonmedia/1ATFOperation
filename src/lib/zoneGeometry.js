import polygonClipping from 'polygon-clipping'
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
  // custom (default) — a free polygon, used as drawn (no coastline clipping on
  // the local NSW map).
  const coords = zone.coords
  if (!Array.isArray(coords) || coords.length < 3) return null
  return [[coords.map(toXY)]]
}

export function zoneCenter(zone) {
  const mp = zoneBaseMP(zone)
  return mp ? mpCenter(mp) : null
}

// Ray-cast point-in-polygon over a MultiPolygon's outer rings. pt is [x, y].
function pointInMP(pt, mp) {
  for (const poly of mp) {
    const ring = poly[0]
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]
      if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi)) {
        inside = !inside
      }
    }
    if (inside) return true
  }
  return false
}

// Endpoints for a movement line so it hugs the shared border rather than running
// to the target's centre. Walking the centre-to-centre line, we find where it
// leaves the origin zone and where it enters the target, then place the start
// just inside the origin near that border and the end just across it into the
// target. Different attackers cross at different points, so the lines fan out.
// Returns { a, b } as [lat, lng], or null.
export function arrowEndpoints(fromZone, toZone) {
  const fromMP = zoneBaseMP(fromZone)
  const toMP = zoneBaseMP(toZone)
  if (!fromMP || !toMP) return null
  const ca = mpCenter(fromMP) // [lat, lng]
  const cb = mpCenter(toMP)
  const A = [ca[1], ca[0]] // [x, y] = [lng, lat]
  const B = [cb[1], cb[0]]
  const at = (t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]

  const N = 80
  let exitFrom = null // last t still inside the origin zone
  let entryTo = null // first t inside the target zone
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const p = at(t)
    if (pointInMP(p, fromMP)) exitFrom = t
    if (entryTo === null && pointInMP(p, toMP)) entryTo = t
  }
  const border = entryTo !== null ? entryTo : exitFrom !== null ? exitFrom : 0.5
  const fromEdge = exitFrom !== null ? exitFrom : border

  const dist = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1
  // Offset ~18% of the run, but never more than ~0.9° so long attacks still end
  // near the border instead of deep inside the target.
  const dFrac = Math.min(0.18, 0.9 / dist)
  const o = at(Math.max(0, fromEdge - dFrac)) // just inside the origin
  const e = at(Math.min(1, border + dFrac)) // just across into the target
  return { a: [o[1], o[0]], b: [e[1], e[0]] }
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
