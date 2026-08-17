import { colorOf, coyLabelOf, isRHQCode } from './territory'

// Company name labels placed automatically on the map.
//
// The grid has no zone entities — it's a flat string of per-cell owner codes —
// so "where does A-COY's name go?" has to be derived from the cells
// themselves, every render. Doing that from a plain mean-of-coordinates
// centroid puts the label outside the territory whenever a holding is
// concave, ring-shaped or split across the map (very common here: companies
// hold a coastal strip plus an inland pocket). Instead:
//
//   1. Split the owner's cells into connected components and keep the LARGEST
//      one — the name belongs on the main holding, not floating between two.
//   2. Inside that component find the "pole of inaccessibility": the cell
//      furthest from the component's edge, by multi-source BFS inward from
//      every boundary cell. That point is always inside the shape and sits in
//      its visual middle, which is what makes the label look placed by hand.
//
// Cheap enough to run per render at 216x112 (a few passes over ~24k cells),
// and because it's derived it tracks campaign replay frame-by-frame with no
// authoring and no stored state.

// Holdings smaller than this don't get a name — a few stray brush cells
// shouldn't stamp "D-COY" across the map.
export const MIN_LABEL_CELLS = 45

// Order labels are emitted in, so overlapping draws are at least stable
// between renders rather than depending on Map iteration of a changing grid.
const CODE_ORDER = ['A', 'B', 'C', 'D', 'E', 'S', 'R', 'M']

// Owner codes the map key lists. Deliberately the FULL fixed roster rather
// than whoever currently holds ground: the key is a constant reference for
// reading the map, so it must not reshuffle or drop entries as the campaign
// replays frame-by-frame — a legend that changes under you is harder to use
// than one with an unused row. RHQ is the one conditional entry, because when
// `showRHQ` is off it isn't drawn on the map at all.
export function legendCodes({ showRHQ = true } = {}) {
  return CODE_ORDER.filter((c) => showRHQ || !isRHQCode(c))
}

// How close (in cells) a label may sit to a named place before it's pushed
// elsewhere. A place beacon already prints the owner tag next to its name, so
// a company label on top of one just says the same thing twice.
const AVOID_RADIUS = 10

// How close (in cells) a label may sit to ANOTHER COMPANY'S label before it's
// pushed elsewhere. Bigger than AVOID_RADIUS on purpose: a place only needs
// its point kept clear, but a label is a run of text ("A-COY") that needs
// real horizontal room next to a neighbour's, not just non-overlapping poles.
const LABEL_AVOID_RADIUS = 24

// Pole of inaccessibility for a membership mask, restricted to the mask's
// largest connected component. Returns { x, y, size } in cell coordinates
// (centre of the winning cell), or null when the mask is empty.
//
// `avoid` is a list of {x, y, radius} points to keep clear of (radius default
// AVOID_RADIUS): the deepest cell that isn't near one wins, and only if EVERY
// interior cell is near one does the label fall back to the plain deepest
// cell — better a slight overlap than silently dropping a company's name off
// the map.
function poleOfLargestComponent(mask, cols, rows, avoid = []) {
  const n = cols * rows
  const comp = new Int32Array(n).fill(-1)
  let bestComp = -1
  let bestSize = 0
  let compId = 0
  const queue = new Int32Array(n)

  for (let start = 0; start < n; start++) {
    if (!mask[start] || comp[start] >= 0) continue
    let head = 0, tail = 0
    queue[tail++] = start
    comp[start] = compId
    while (head < tail) {
      const i = queue[head++]
      const x = i % cols, y = (i / cols) | 0
      if (x > 0 && mask[i - 1] && comp[i - 1] < 0) { comp[i - 1] = compId; queue[tail++] = i - 1 }
      if (x < cols - 1 && mask[i + 1] && comp[i + 1] < 0) { comp[i + 1] = compId; queue[tail++] = i + 1 }
      if (y > 0 && mask[i - cols] && comp[i - cols] < 0) { comp[i - cols] = compId; queue[tail++] = i - cols }
      if (y < rows - 1 && mask[i + cols] && comp[i + cols] < 0) { comp[i + cols] = compId; queue[tail++] = i + cols }
    }
    if (tail > bestSize) { bestSize = tail; bestComp = compId }
    compId++
  }
  if (bestComp < 0) return null

  // Multi-source BFS inward from the component's boundary. Depth is the
  // (4-connected) distance to the nearest cell that isn't part of this
  // component, so the deepest cell is the most interior one.
  const depth = new Int32Array(n).fill(-1)
  let head = 0, tail = 0
  let sumX = 0, sumY = 0
  for (let i = 0; i < n; i++) {
    if (comp[i] !== bestComp) continue
    const x = i % cols, y = (i / cols) | 0
    sumX += x; sumY += y
    const edge = x === 0 || y === 0 || x === cols - 1 || y === rows - 1 ||
      comp[i - 1] !== bestComp || comp[i + 1] !== bestComp ||
      comp[i - cols] !== bestComp || comp[i + cols] !== bestComp
    if (edge) { depth[i] = 0; queue[tail++] = i }
  }
  const cx = sumX / bestSize, cy = sumY / bestSize

  const nearPlace = (x, y) =>
    avoid.some((p) => Math.hypot((p.x ?? Infinity) - x, (p.y ?? Infinity) - y) < (p.radius ?? AVOID_RADIUS))

  // Two candidates tracked at once: the best cell clear of any place, and the
  // best cell overall as a fallback for a holding that's entirely covered.
  let best = -1, bestDepth = -1, bestDist = Infinity
  let anyBest = queue[0], anyDepth = -1, anyDist = Infinity
  while (head < tail) {
    const i = queue[head++]
    const d = depth[i]
    const x = i % cols, y = (i / cols) | 0
    // Deepest wins; ties break toward the component's centroid so the label
    // doesn't jitter between two equally-deep cells across frames.
    const dist = (x - cx) ** 2 + (y - cy) ** 2
    if (d > anyDepth || (d === anyDepth && dist < anyDist)) {
      anyBest = i; anyDepth = d; anyDist = dist
    }
    if ((d > bestDepth || (d === bestDepth && dist < bestDist)) && !nearPlace(x, y)) {
      best = i; bestDepth = d; bestDist = dist
    }
    const push = (j) => { if (comp[j] === bestComp && depth[j] < 0) { depth[j] = d + 1; queue[tail++] = j } }
    if (x > 0) push(i - 1)
    if (x < cols - 1) push(i + 1)
    if (y > 0) push(i - cols)
    if (y < rows - 1) push(i + cols)
  }

  const win = best >= 0 ? best : anyBest
  return { x: (win % cols) + 0.5, y: ((win / cols) | 0) + 0.5, size: bestSize }
}

// One name label per owner present on the grid.
// Returns [{ code, label, color, x, y, size }] in cell coordinates.
// `avoid` is `territory.places` — see poleOfLargestComponent. `overrides` is
// `territory.labelOverrides` — { [code]: {x, y} } — RHQ's manually-dragged
// positions (see MapEditor's "Arrange company labels" mode): a company with
// an override skips the derived pole entirely and renders at the chosen spot
// instead, but still counts toward `minCells` (holding nothing still hides
// the label) and still feeds `labelAvoid` so later, still-automatic
// companies steer clear of it. Automatic placement can't always separate a
// tight multi-way contested cluster on its own — see CHANGELOG — so this is
// the deliberate human-in-the-loop escape hatch, not a replacement for it.
export function companyLabelPoints(cells, cols, rows, { showRHQ = true, minCells = MIN_LABEL_CELLS, avoid = [], overrides = {} } = {}) {
  if (!cells || cells.length !== cols * rows) return []
  const n = cells.length

  // Bucket every cell by its base (uppercase) owner code in one pass; the
  // light "contested" variant belongs to the same company as the solid one.
  const masks = new Map()
  for (let i = 0; i < n; i++) {
    const ch = cells[i]
    if (!ch || ch === '.') continue
    const code = ch.toUpperCase()
    if (isRHQCode(code) && !showRHQ) continue
    let m = masks.get(code)
    if (!m) { m = new Uint8Array(n); masks.set(code, m) }
    m[i] = 1
  }

  // Placed one company at a time in CODE_ORDER, each new label also kept
  // clear of every label already placed — without this, companies holding
  // adjacent or interleaved ground (the normal case at a contested border)
  // land their poles a few cells apart and the text stacks on screen. Order
  // therefore also acts as placement priority: earlier codes get first claim
  // on a contested pocket, later ones are pushed off it.
  const placeAvoid = avoid.map((p) => ({ x: p.x, y: p.y, radius: AVOID_RADIUS }))
  const labelAvoid = []
  const out = []
  for (const code of CODE_ORDER) {
    const mask = masks.get(code)
    if (!mask) continue
    const pole = poleOfLargestComponent(mask, cols, rows, [...placeAvoid, ...labelAvoid])
    if (!pole || pole.size < minCells) continue
    const manual = overrides[code]
    const x = manual ? manual.x : pole.x
    const y = manual ? manual.y : pole.y
    out.push({ code, label: coyLabelOf(code), color: colorOf(code), x, y, size: pole.size })
    labelAvoid.push({ x, y, radius: LABEL_AVOID_RADIUS })
  }
  return out
}

// Merge a transitionPlan's clusters down to ONE label per owner, placed at
// the pole of that owner's combined gains.
//
// Used by the weekly progress image: a week's worth of frames produces dozens
// of small clusters, and labelling each one buried the map under repeated
// "A-COY / A-COY / A-COY". One name per company that actually gained ground
// says the same thing once.
export function mergedGainLabels(plan, cols, rows, { minCells = MIN_LABEL_CELLS } = {}) {
  const n = cols * rows
  const masks = new Map()
  const totals = new Map()
  for (const cl of plan.clusters) {
    if (!cl.owner || cl.owner === '.') continue // ground lost to nobody has no name
    let m = masks.get(cl.owner)
    if (!m) { m = new Uint8Array(n); masks.set(cl.owner, m) }
    for (const c of cl.cells) m[c.y * cols + c.x] = 1
    totals.set(cl.owner, (totals.get(cl.owner) || 0) + cl.cells.length)
  }

  const out = []
  const labelAvoid = []
  for (const code of CODE_ORDER) {
    const mask = masks.get(code)
    if (!mask) continue
    // Threshold on the owner's TOTAL gains, not the largest blob — a company
    // that took a lot of ground in scattered pieces still earns its name.
    if ((totals.get(code) || 0) < minCells) continue
    // Same mutual avoidance as companyLabelPoints — a week's gains often
    // cluster several companies' advances around the same contested front.
    const pole = poleOfLargestComponent(mask, cols, rows, labelAvoid)
    if (!pole) continue
    out.push({ code, label: coyLabelOf(code), color: colorOf(code), x: pole.x, y: pole.y, size: totals.get(code) })
    labelAvoid.push({ x: pole.x, y: pole.y, radius: LABEL_AVOID_RADIUS })
  }
  return out
}
