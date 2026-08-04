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

// Pole of inaccessibility for a membership mask, restricted to the mask's
// largest connected component. Returns { x, y, size } in cell coordinates
// (centre of the winning cell), or null when the mask is empty.
function poleOfLargestComponent(mask, cols, rows) {
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

  let best = queue[0]
  let bestDepth = 0
  let bestDist = Infinity
  while (head < tail) {
    const i = queue[head++]
    const d = depth[i]
    const x = i % cols, y = (i / cols) | 0
    // Deepest wins; ties break toward the component's centroid so the label
    // doesn't jitter between two equally-deep cells across frames.
    const dist = (x - cx) ** 2 + (y - cy) ** 2
    if (d > bestDepth || (d === bestDepth && dist < bestDist)) {
      best = i; bestDepth = d; bestDist = dist
    }
    const push = (j) => { if (comp[j] === bestComp && depth[j] < 0) { depth[j] = d + 1; queue[tail++] = j } }
    if (x > 0) push(i - 1)
    if (x < cols - 1) push(i + 1)
    if (y > 0) push(i - cols)
    if (y < rows - 1) push(i + cols)
  }

  return { x: (best % cols) + 0.5, y: ((best / cols) | 0) + 0.5, size: bestSize }
}

// One name label per owner present on the grid.
// Returns [{ code, label, color, x, y, size }] in cell coordinates.
export function companyLabelPoints(cells, cols, rows, { showRHQ = true, minCells = MIN_LABEL_CELLS } = {}) {
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

  const out = []
  for (const code of CODE_ORDER) {
    const mask = masks.get(code)
    if (!mask) continue
    const pole = poleOfLargestComponent(mask, cols, rows)
    if (!pole || pole.size < minCells) continue
    out.push({ code, label: coyLabelOf(code), color: colorOf(code), x: pole.x, y: pole.y, size: pole.size })
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
  for (const code of CODE_ORDER) {
    const mask = masks.get(code)
    if (!mask) continue
    // Threshold on the owner's TOTAL gains, not the largest blob — a company
    // that took a lot of ground in scattered pieces still earns its name.
    if ((totals.get(code) || 0) < minCells) continue
    const pole = poleOfLargestComponent(mask, cols, rows)
    if (!pole) continue
    out.push({ code, label: coyLabelOf(code), color: colorOf(code), x: pole.x, y: pole.y, size: totals.get(code) })
  }
  return out
}
