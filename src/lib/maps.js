// Map registry — the theatres the portal can run an operation over.
//
// The portal started with exactly one map (NSW) whose art, grid resolution and
// data slices were all hard-coded. It now carries several, so everything that
// used to be a constant lives here as a per-map record instead:
//
//   name / short                       display name, and a short form for
//                                      the public map-switch button
//   image / pixelWidth / pixelHeight   the pixel-art tile and its native size
//   cols / rows                        the paintable territory grid over it
//   blockFill                          a flat fill in the art that can never be
//                                      painted (ocean on NSW; none inland)
//
// Every map is DEFINED IN CODE, not authored in the Operations Centre: a map
// needs art committed to public/map and a grid sized to it, which is a repo
// change either way. What RHQ controls is which map a visitor LANDS ON
// (`activeMap` — the default) and everything painted on top of it. Visitors
// can switch to any other map from the Home page; see `otherMaps` below.
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
import { LINE_KEY } from './mapLines'

const asset = (file) => import.meta.env.BASE_URL + 'map/' + file

export const MAPS = [
  {
    id: 'nsw',
    // ⚠️ `id` is baked into stored data — slice names (`territory`) and the
    // `map` field on every campaign frame — so the DISPLAY NAME is the only
    // thing that ever changes here. Renaming an id orphans its documents.
    name: '1ATF Full Progress Map',
    short: 'Full Map',
    sub: 'NEW SOUTH WALES // FULL OPERATIONAL PICTURE',
    blurb: 'The whole operation — Meridian-held ground across New South Wales.',
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
    name: '1ATF Regional Progress Map',
    short: 'Regional Map',
    sub: 'SINGLETON MILITARY AREA // SECTOR 8 ONLY',
    blurb: 'The training area itself — Singleton Sector 8, RHQ at the Ex Admin Area. Sector 9 carries no camp activity and is outside the area shown.',
    // DEFAULT VIEW: Sector 8, not the whole sheet. Every zone the camp plan
    // touches sits west of the sector line (x 122–129); Sector 9 is empty
    // ground, and framing the map on both made the half that matters small.
    // The box is the activity envelope plus a margin, and the sector line is
    // its eastern edge — which is why that line is now drawn in the boundary's
    // yellow rather than its own green (see lib/mapLines.js). Sectors 7 and 9
    // keep their place markers as reference for what lies beyond it.
    // The traced boundaries, the zones and the imagery all still cover the
    // FULL sheet: this is where the map opens, not a crop, so a visitor can
    // still pan or zoom out to the rest.
    focus: { x0: 58, y0: 36, x1: 270, y1: 248, label: 'SECTOR 8' },
    image: asset('singleton.webp'),
    pixelWidth: 1080,
    pixelHeight: 765,
    // ⚠️ 4x the cells of the other map's grid — see DEFAULT_SINGLETON_TERRITORY
    // in seed.js. Ground here is taken a fraction of an activity area at a
    // time, and a ~59 m cell could not follow an area's outline.
    cols: 432,
    rows: 306,
    // Photographic art, so it opts out of the pixel-art filter: see
    // imageFilterFor() in lib/terrainRender.js. Enough contrast and tint to
    // sit inside the portal's palette, well short of what the flat tiles take.
    imageFilter: 'contrast(112%) sepia(20%) brightness(104%) saturate(86%)',
    // Landlocked: every cell on the sheet is ground somebody can hold.
    blockFill: null,
    blockLabel: null,
    // GEOREFERENCE — a Web Mercator (EPSG:3857) rectangle.
    //
    // The frame USED to be the paper sheet's own MGA Zone 56 rectangle, which
    // is the survey-correct frame and was the obvious choice while the art was
    // derived from the sheet. It stopped being the right one when the basemap
    // became live XYZ tiles: MGA Zone 56 is rotated 0.99° from the Web
    // Mercator grid every tile service publishes on — 180 m, about 3.7 grid
    // cells, of skew corner to corner — so tiles dropped into it would sit
    // visibly crooked under the boundaries. In a Mercator frame a tile maps in
    // with a pure linear transform and no warping at all.
    //
    // `merc` is that rectangle. `affine` converts a grid cell straight to MGA
    // easting/northing for grid references, fitted over the frame: max error
    // 2.1 m, RMS 0.46 m, against a six-figure reference's 100 m digit — so a
    // grid ref is exact and no projection library ships to the browser.
    // Checked against the surveyed Ex Admin Area point (−32.763022,
    // 151.182969), which lands on cell (104.01, 95.79).
    // ⚠️ Keep MERC_* in tools/map/build-singleton-map.py in step with `merc`.
    geo: {
      crs: 'MGA94 / Zone 56',   // what grid references are quoted in
      merc: { x0: 16823443.92, y0: -3858211.43, w: 12807.80, h: 9072.19 },
      affine: { ex: 49.906673, ey: 0.851530, e0: 324524.0163,
                nx: 0.855589, ny: -49.669915, n0: 6378191.5913 },
    },
    // Live basemap. NSW Spatial Services' public imagery of an NSW training
    // area — sub-metre where Sentinel-2 is 10 m, which is the whole point of
    // being able to zoom in. `image` above stays the floor: it renders under
    // the tiles, so it is what shows before they load and all that shows if
    // they never do (no network on camp, or the service moves). A wrong or
    // dead tile URL therefore degrades to exactly the old static map rather
    // than to a blank one.
    tiles: {
      url: 'https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Imagery/MapServer/tile/{z}/{y}/{x}',
      minZoom: 12,
      maxZoom: 19,
      attribution: 'Imagery © NSW Spatial Services (Department of Customer Service)',
    },
    // The key comes from the same module that draws the lines, so a colour
    // change can't leave the legend describing something nothing renders.
    artKeyLabel: 'BOUNDARIES',
    artKey: LINE_KEY,
  },
]

// The map whose slices keep the original, unsuffixed names.
export const PRIMARY_MAP_ID = 'nsw'

export const mapById = (id) => MAPS.find((m) => m.id === id) || MAPS[0]

// Every map except the one being viewed — what the public map switcher offers.
// Returns a list rather than "the other one" so a third map needs no new UI.
export const otherMaps = (id) => MAPS.filter((m) => m.id !== id)

export const isKnownMap = (id) => MAPS.some((m) => m.id === id)

// The map a territory object belongs to. Territory saved before this existed
// carries no `map`, which is the primary map by definition.
export const mapFor = (territory) => mapById(territory?.map)

export const mapAspect = (map) => map.pixelWidth / map.pixelHeight

/* ------------------------------ slice names ------------------------------ */

export const territorySlice = (mapId) =>
  (mapId === PRIMARY_MAP_ID ? 'territory' : `territory_${mapId}`)

export const campaignStartSlice = (mapId) =>
  (mapId === PRIMARY_MAP_ID ? 'campaignDefaultStart' : `campaignDefaultStart_${mapId}`)

// Which of a map's zones RHQ is showing — `{ show, hidden: [id] }`. The zone
// GEOMETRY is committed code (see lib/mapZones.js); only the visibility is
// content, because that is the part RHQ changes during a camp.
export const zoneVisibilitySlice = (mapId) =>
  (mapId === PRIMARY_MAP_ID ? 'zoneVisibility' : `zoneVisibility_${mapId}`)

// Whether a map has been DISTRIBUTED to the public — `{ released, at }`.
//
// A map is built, painted and its replay generated well before anyone outside
// RHQ should see it: the Regional map exists in the repo weeks before camp,
// with every day of the camp already painted on it. Distribution is therefore
// a deliberate action in the Ops Centre, not a consequence of the map
// existing. Until it is taken, the map isn't offered on Home and can't be
// reached by a saved session override either.
export const mapReleaseSlice = (mapId) =>
  (mapId === PRIMARY_MAP_ID ? 'mapRelease' : `mapRelease_${mapId}`)

// Which map a slice name belongs to, or null if it isn't map-scoped. Used by
// the Backups panel so a version of "Map: Territory" says which map it is.
export function mapOfSlice(slice) {
  for (const m of MAPS) {
    if (slice === territorySlice(m.id) || slice === campaignStartSlice(m.id)
        || slice === zoneVisibilitySlice(m.id) || slice === mapReleaseSlice(m.id)) return m
  }
  return null
}

// Every map-scoped single-value slice, in map order — store.js folds these
// into SINGLE_SLICES so each map is loaded, persisted and version-backed
// exactly like any other piece of content.
export const mapSlices = () =>
  MAPS.flatMap((m) => [territorySlice(m.id), campaignStartSlice(m.id), zoneVisibilitySlice(m.id), mapReleaseSlice(m.id)])

/**
 * Can the public see this map at all?
 *
 * The DEFAULT map always can — a default nobody is allowed to look at would
 * leave the Home page with no map on it, and RHQ choosing a map as the one
 * visitors land on IS the decision to publish it. Every other map has to be
 * distributed first, from Ops Centre → Map: Territory.
 */
export function isMapPublic(mapId, activeMapId, state) {
  if (mapId === (isKnownMap(activeMapId) ? activeMapId : PRIMARY_MAP_ID)) return true
  return !!state?.[mapReleaseSlice(mapId)]?.released
}

export const publicMaps = (activeMapId, state) =>
  MAPS.filter((m) => isMapPublic(m.id, activeMapId, state))

/**
 * Where a map with a `focus` box should OPEN: the scale that fits that box,
 * and the pan that centres it.
 *
 * Pan is in PixelMap's pre-scale units — the stage transform is
 * `scale(s) translate(x, y)` about the container centre, so a grid point lands
 * at s * (stagePoint + pan) and centring one means pan = −stagePoint. `W`/`H`
 * are the container's pixel size.
 *
 * The scale FITS (contains) the box rather than filling it, so nothing the box
 * asks for is cut off; on a frame wider than the box that means some ground
 * outside it stays visible, which is why the area's border is drawn rather
 * than assumed.
 */
export function focusView(map, W, H) {
  const f = map?.focus
  if (!f || !W || !H) return null
  const bw = Math.max(1, f.x1 - f.x0)
  const bh = Math.max(1, f.y1 - f.y0)
  const scale = Math.max(1, Math.min(map.cols / bw, map.rows / bh))
  const cx = (f.x0 + f.x1) / 2
  const cy = (f.y0 + f.y1) / 2
  return { scale, x: -W * (cx / map.cols - 0.5), y: -H * (cy / map.rows - 0.5) }
}

/* ------------------------------ georeference ----------------------------- */

// Real-world easting/northing of a grid cell, for a map that declares `geo`.
// null for one that doesn't (the NSW art is a stylised continent, not a survey).
//
// One affine, fitted over the frame, rather than a projection: converting
// Mercator to MGA properly means a Transverse Mercator series, and over 10 km
// the affine is accurate to 2.1 m worst case — two orders of magnitude inside
// the 100 m digit a six-figure grid reference actually quotes.
export function eastingNorthingOf(map, x, y) {
  const a = map?.geo?.affine
  if (!a) return null
  return { e: a.ex * x + a.ey * y + a.e0, n: a.nx * x + a.ny * y + a.n0 }
}

// Standard six-figure grid reference, e.g. "297 735" — the 100m digits of the
// easting and northing, which is how anyone on the ground would call a point in.
export function gridRefOf(map, x, y) {
  const en = eastingNorthingOf(map, x, y)
  if (!en) return null
  const part = (v) => String(Math.floor((((v % 100000) + 100000) % 100000) / 100)).padStart(3, '0')
  return `${part(en.e)} ${part(en.n)}`
}

/* ------------------------------- web mercator ----------------------------- */

// Circumference of the Web Mercator world square, in its own metres. Every XYZ
// tile scheme is this square halved z times, so it is the only constant needed
// to place a tile.
export const MERC_WORLD = 2 * Math.PI * 6378137

// Where a map's frame sits in the Mercator world, as fractions of that square
// measured from its top-left. Tiles are addressed the same way, so placing one
// is then pure arithmetic — no projection, no warp.
export function mercFrame(map) {
  const m = map?.geo?.merc
  if (!m) return null
  const half = MERC_WORLD / 2
  return { left: (m.x0 + half) / MERC_WORLD, top: (half - m.y0) / MERC_WORLD,
           width: m.w / MERC_WORLD, height: m.h / MERC_WORLD }
}

// The tile zoom whose pixels are closest to (and no coarser than) the
// resolution the map is actually being displayed at. `displayWidth` is the
// frame's on-screen width in CSS pixels, so this rises as the user zooms in —
// which is the entire point: a new zoom level is new detail, not the same
// pixels enlarged.
export function tileZoomFor(map, displayWidth) {
  const f = mercFrame(map)
  const t = map?.tiles
  if (!f || !t) return null
  const z = Math.ceil(Math.log2(displayWidth / (f.width * 256)))
  return Math.max(t.minZoom ?? 0, Math.min(t.maxZoom ?? 19, z))
}

// Every tile covering `region` (a sub-rectangle of the frame, in 0..1 frame
// fractions) at zoom `z`, each with its position as a percentage of the frame
// so the browser scales it with everything else under the map's zoom/pan
// transform. Returns [] for a map with no tile source.
export function tilesFor(map, z, region = { x0: 0, y0: 0, x1: 1, y1: 1 }) {
  const f = mercFrame(map)
  if (!f || !map?.tiles) return []
  const n = 2 ** z
  const span = 1 / n                       // one tile, as a world fraction
  const wx0 = f.left + region.x0 * f.width
  const wx1 = f.left + region.x1 * f.width
  const wy0 = f.top + region.y0 * f.height
  const wy1 = f.top + region.y1 * f.height
  const lo = (v) => Math.max(0, Math.floor(v * n))
  const hi = (v) => Math.min(n - 1, Math.ceil(v * n) - 1)
  const out = []
  for (let ty = lo(wy0); ty <= hi(wy1); ty++) {
    for (let tx = lo(wx0); tx <= hi(wx1); tx++) {
      out.push({
        key: `${z}/${tx}/${ty}`,
        url: map.tiles.url.replace('{z}', z).replace('{x}', tx).replace('{y}', ty),
        left: ((tx * span - f.left) / f.width) * 100,
        top: ((ty * span - f.top) / f.height) * 100,
        width: (span / f.width) * 100,
        height: (span / f.height) * 100,
      })
    }
  }
  return out
}

/**
 * The ONE tile set a map loads — a single fixed zoom level, chosen once and
 * never changed as the user zooms.
 *
 * ⚠️ THIS IS DELIBERATELY NOT A SLIPPY MAP. Re-requesting a deeper level on
 * every zoom step is what tile maps normally do, and here it was the bug: each
 * step swapped the imagery on screen, so zooming flickered between levels (and,
 * before that, back through the low-res static floor). What this map actually
 * needs is simpler — swap the 10 m static art for real imagery ONCE, then let
 * the browser scale it with everything else under PixelMap's transform, exactly
 * as the static image always did. One fetch, one layer, nothing to re-settle.
 *
 * The level is whatever the budget affords over the region that matters: a map
 * with a `focus` box loads only that (the rest keeps the static art, which is
 * all anyone sees out there anyway), so the budget buys detail where people
 * look. Singleton lands on z16 over Sector 8 — ~2 m/px against the static
 * image's ~12 m/px, about 144 tiles fetched once and then cached.
 */
const FIXED_MAX_TILES = 160

export function fixedTiles(map) {
  if (!map?.tiles) return null
  const f = map.focus
  const region = f
    ? { x0: f.x0 / map.cols, x1: f.x1 / map.cols, y0: f.y0 / map.rows, y1: f.y1 / map.rows }
    : undefined
  const minZ = map.tiles.minZoom ?? 0
  const maxZ = map.tiles.maxZoom ?? 19
  let best = null
  for (let z = minZ; z <= maxZ; z++) {
    const list = tilesFor(map, z, region)
    if (!list.length) continue
    if (list.length > FIXED_MAX_TILES) break
    best = { z, list }
  }
  return best
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
