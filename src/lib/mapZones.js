// Camp zones — the activity areas, night locations and headquarters a map
// carries, as named polygons over the ground.
//
// These are the things cadets actually go TO, as opposed to territory (ground
// held) and map lines (administrative boundaries). Keeping them a separate
// layer matters because they are the unit of PROGRESS: "Alpha has been through
// the ropes course" is a fact about a zone, not about a cell.
//
// GEOMETRY IS CODE, VISIBILITY IS CONTENT. The outlines come from the BIV26
// Google Earth project via tools/map/kml-to-zones.py and are committed — they
// change once a year when the camp plan does, which is a repo change. Whether
// a zone is SHOWN is RHQ's call at any moment, so that lives in a per-map
// `zones` content slice instead (see zonesSlice() in lib/maps.js).
import singleton from '../data/singleton-zones.json'

const ZONES = { singleton: singleton.zones }

// One style per kind. Deliberately outside the company palette: a zone is a
// place, not an owner, and must never be mistaken for held ground. Company
// colours arrive on top as territory hatch.
export const ZONE_STYLE = {
  activity: { color: '#36e0c0', fill: 0.10, label: 'Activity area' },
  nl:       { color: '#4ea8ff', fill: 0.09, label: 'Night location' },
  hq:       { color: '#f39c12', fill: 0.12, label: 'Headquarters' },
}

export const KIND_ORDER = ['hq', 'activity', 'nl']

export const zonesFor = (mapId) => ZONES[mapId] || []

// A map's zones as RHQ has them configured. `slice` is the stored
// `{ show, hidden }`; a missing slice means everything shows, so a map works
// the moment its zones are committed without RHQ having to opt in.
export function visibleZones(mapId, slice) {
  const all = zonesFor(mapId)
  if (!all.length) return []
  if (slice && slice.show === false) return []
  const hidden = new Set((slice && slice.hidden) || [])
  return all.filter((z) => !hidden.has(z.id))
}

export const zoneCount = (mapId) => zonesFor(mapId).length

// Group for the ops list and the map key, in a stable order.
export function zonesByKind(mapId) {
  const all = zonesFor(mapId)
  return KIND_ORDER
    .map((kind) => ({ kind, style: ZONE_STYLE[kind], zones: all.filter((z) => z.kind === kind) }))
    .filter((g) => g.zones.length)
}
