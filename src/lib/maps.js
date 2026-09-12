// Map registry — the theatres the portal can run an operation over.
//
// The portal started with exactly one map (NSW) whose art, grid resolution and
// data slices were all hard-coded. It now carries several, so everything that
// used to be a constant lives here as a per-map record instead:
//
//   image / pixelWidth / pixelHeight   the pixel-art tile and its native size
//   cols / rows                        the paintable territory grid over it
//   blockFill                          a flat fill in the art that can never be
//                                      painted (ocean on NSW; none inland)
//
// Every map is DEFINED IN CODE, not authored in the Operations Centre: a map
// needs art committed to public/map and a grid sized to it, which is a repo
// change either way. What RHQ controls is which map each visitor sees
// (`activeMap`) and everything painted on top of it.
//
// STORAGE. Each map keeps its own territory, its own replay frames and its own
// default start frame — nothing is shared, so painting Singleton can never
// disturb the NSW campaign. The primary map keeps the original, unsuffixed
// slice names so existing Firestore documents keep working untouched; every
// other map gets a `<slice>_<mapId>` document beside them. Both are ordinary
// `content/*` docs, which the existing rules already cover — adding a map
// needs no Firestore rules change.
//
// Replay frames are the exception to that pattern: they are a top-level
// COLLECTION rather than a content doc, so rather than mint a collection (and
// a rules block) per map, every frame carries a `map` field and the collection
// is filtered client-side. A frame written before this existed has no `map`
// field at all, which reads as the primary map — exactly what it was.

// Grid sizing rule, for anyone adding a map: cols/rows must divide the art's
// pixel size exactly (here, one cell per 3x3 block of source pixels), so the
// paintable grid stays aligned to the pixel art instead of straddling it.
const asset = (file) => import.meta.env.BASE_URL + 'map/' + file

export const MAPS = [
  {
    id: 'nsw',
    name: 'NSW Campaign',
    sub: 'NEW SOUTH WALES // NATIONAL OPERATION',
    blurb: 'The continental operation — Meridian-held ground across New South Wales.',
    image: asset('nsw-terrain.png'),
    pixelWidth: 648,
    pixelHeight: 336,
    cols: 216,
    rows: 112,
    // Flat ocean fill in the art. Cells that sample as majority-ocean can't be
    // painted (see lib/unpaintableMask.js).
    blockFill: '#3c82b4',
    blockLabel: 'Ocean',
  },
  {
    id: 'singleton',
    name: 'Singleton Military Area',
    sub: 'AREAS 8 & 9 // AUSPEC0196',
    blurb: 'The training area itself — Areas 8 and 9, RHQ at the Ex Admin Area.',
    image: asset('singleton.png'),
    pixelWidth: 648,
    pixelHeight: 459,
    cols: 216,
    rows: 153,
    // Landlocked: every cell on the sheet is ground somebody can hold.
    blockFill: null,
    blockLabel: null,
    // GEOREFERENCE. The sheet prints a 1000m MGA Zone 56 grid, and fitting a
    // comb to those lines pins the art to real ground: 195.25 source px per
    // kilometre, which is 20.5928 grid cells per km at this resolution. Two
    // independent checks: the north edge lands on the New England Highway
    // alignment, and a surveyed point supplied for the Ex Admin Area
    // (-32.762633, 151.182543) falls on cell (103.31, 95.32) — the cell it was
    // already seeded at.
    //
    // Only the linear easting/northing is kept here, because a grid reference
    // is all this map needs; converting to lat/lon would mean carrying a
    // projection library for no operational gain.
    geo: {
      crs: 'MGA94 / Zone 56',   // EPSG:28356
      cellsPerKm: 20.5928,
      originE: 324739,          // easting  at cell x = 0
      originN: 6378195,         // northing at cell y = 0 (north edge; y runs south)
    },
    // What the art's colours mean, shown as a terrain key under the map.
    // These mirror the palette in tools/map/derive-singleton-map.py, which is
    // the source of truth — change them together or the key starts lying.
    // The wording is the sheet's own legend wording.
    terrainKey: [
      { color: '#c0bb74', label: 'Cleared' },
      { color: '#a4b86e', label: 'Grass' },
      { color: '#89ab68', label: 'Scrub / scattered trees' },
      { color: '#6d9a5e', label: 'Woodland' },
      { color: '#5c8a55', label: 'Woodland, dense' },
      { color: '#c4ae8c', label: 'Cultivated land' },
      { color: '#ad8a63', label: 'Steep / broken ground' },
      { color: '#e48a34', label: 'Road, hard surface' },
      { color: '#d8a860', label: 'Road, loose surface' },
      { color: '#967c55', label: 'Track / trail' },
      { color: '#7d8a9e', label: 'Railway' },
      { color: '#4d87ad', label: 'Watercourse / dam' },
      { color: '#9c95c6', label: 'Sector boundary' },
      { color: '#c284a4', label: 'Defence area boundary' },
    ],
  },
]

// The map whose slices keep the original, unsuffixed names.
export const PRIMARY_MAP_ID = 'nsw'

export const mapById = (id) => MAPS.find((m) => m.id === id) || MAPS[0]

// The map a territory object belongs to. Territory saved before this existed
// carries no `map`, which is the primary map by definition.
export const mapFor = (territory) => mapById(territory?.map)

export const mapAspect = (map) => map.pixelWidth / map.pixelHeight

/* ------------------------------ slice names ------------------------------ */

export const territorySlice = (mapId) =>
  (mapId === PRIMARY_MAP_ID ? 'territory' : `territory_${mapId}`)

export const campaignStartSlice = (mapId) =>
  (mapId === PRIMARY_MAP_ID ? 'campaignDefaultStart' : `campaignDefaultStart_${mapId}`)

// Which map a slice name belongs to, or null if it isn't map-scoped. Used by
// the Backups panel so a version of "Map: Territory" says which map it is.
export function mapOfSlice(slice) {
  for (const m of MAPS) {
    if (slice === territorySlice(m.id) || slice === campaignStartSlice(m.id)) return m
  }
  return null
}

// Every map-scoped single-value slice, in map order — store.js folds these
// into SINGLE_SLICES so each map is loaded, persisted and version-backed
// exactly like any other piece of content.
export const mapSlices = () => MAPS.flatMap((m) => [territorySlice(m.id), campaignStartSlice(m.id)])

/* ------------------------------ georeference ----------------------------- */

// Real-world easting/northing of a grid cell, for a map that declares `geo`.
// null for one that doesn't (the NSW art is a stylised continent, not a survey).
export function eastingNorthingOf(map, x, y) {
  const g = map?.geo
  if (!g) return null
  return {
    e: g.originE + (x / g.cellsPerKm) * 1000,
    n: g.originN - (y / g.cellsPerKm) * 1000,
  }
}

// Standard six-figure grid reference, e.g. "297 735" — the 100m digits of the
// easting and northing, which is how anyone on the ground would call a point in.
export function gridRefOf(map, x, y) {
  const en = eastingNorthingOf(map, x, y)
  if (!en) return null
  const part = (v) => String(Math.floor((((v % 100000) + 100000) % 100000) / 100)).padStart(3, '0')
  return `${part(en.e)} ${part(en.n)}`
}

/* ---------------------------- campaign frames ---------------------------- */

export const frameMapId = (frame) => frame?.map || PRIMARY_MAP_ID

// This map's frames only. The collection holds every map's history together.
export const framesForMap = (frames, mapId) =>
  (frames || []).filter((f) => frameMapId(f) === mapId)

// Put one map's frames back into the whole-collection array. persistCollection
// deletes any document missing from what it is handed, so every write of
// `campaignFrames` has to carry the other maps' frames through untouched.
export const withMapFrames = (frames, mapId, rows) => [
  ...(frames || []).filter((f) => frameMapId(f) !== mapId),
  ...rows.map((f) => ({ ...f, map: mapId })),
]
