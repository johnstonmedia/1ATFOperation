// Turn a zone's outline into the grid cells it covers.
//
// Zones are stored as polygons (real ground, from the Earth project) while
// territory is a flat string of cells. Painting "Alpha took the ropes course"
// therefore needs the polygon filled onto the grid — that is all this does.
//
// Results are cached per zone id: a camp's frames rasterise the same two dozen
// polygons once each, then reuse them for every day.
const cache = new Map()

// Even-odd fill by cell CENTRE. Centres rather than corners because a zone
// should claim the cells it actually sits on, not every cell it clips a corner
// of — the activity areas are small enough that over-claiming visibly bloats
// them against the imagery.
export function zoneCells(zone, cols, rows) {
  const key = `${zone.id}:${cols}x${rows}`
  const hit = cache.get(key)
  if (hit) return hit

  const poly = zone.cells || []
  const out = []
  if (poly.length >= 3) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const [x, y] of poly) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    const x0 = Math.max(0, Math.floor(minX)), x1 = Math.min(cols - 1, Math.ceil(maxX))
    const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(rows - 1, Math.ceil(maxY))
    for (let y = y0; y <= y1; y++) {
      const cy = y + 0.5
      for (let x = x0; x <= x1; x++) {
        const cx = x + 0.5
        let inside = false
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [xi, yi] = poly[i]
          const [xj, yj] = poly[j]
          if ((yi > cy) !== (yj > cy) && cx < ((xj - xi) * (cy - yi)) / (yj - yi) + xi) inside = !inside
        }
        if (inside) out.push(y * cols + x)
      }
    }
  }
  // A zone smaller than a cell (the eating areas) fills nothing above, so it
  // claims the single cell under its label instead — otherwise it could never
  // be painted at all.
  if (!out.length && zone.label) {
    const x = Math.floor(zone.label[0]), y = Math.floor(zone.label[1])
    if (x >= 0 && x < cols && y >= 0 && y < rows) out.push(y * cols + x)
  }
  cache.set(key, out)
  return out
}

/**
 * A zone's cells in CONQUEST ORDER: nearest the zone's label point first,
 * spreading outward.
 *
 * This is what lets a zone be partly taken. The plan says NAVEX is visited 13
 * times; after 2 of them, 2/13 of NAVEX's cells are painted — and they have to
 * be the SAME 2/13 every render, growing outward rather than jumping about, or
 * the map flickers between frames and reads as noise instead of progress.
 *
 * Ordered by squared distance from the label point (which is where the zone's
 * name is drawn, so ground appears under its own label first), ties broken by
 * cell index so the order is fully determined. That produces a roughly circular
 * spread — the same shape the replay's conquest wave makes — without needing a
 * BFS over an irregular polygon.
 */
const orderCache = new Map()

export function zoneCellsOrdered(zone, cols, rows) {
  const key = `${zone.id}:${cols}x${rows}`
  const hit = orderCache.get(key)
  if (hit) return hit
  const cells = zoneCells(zone, cols, rows)
  const lx = zone.label ? zone.label[0] : 0
  const ly = zone.label ? zone.label[1] : 0
  const ranked = [...cells].sort((a, b) => {
    const ax = (a % cols) + 0.5, ay = Math.floor(a / cols) + 0.5
    const bx = (b % cols) + 0.5, by = Math.floor(b / cols) + 0.5
    const da = (ax - lx) ** 2 + (ay - ly) ** 2
    const db = (bx - lx) ** 2 + (by - ly) ** 2
    return da - db || a - b
  })
  orderCache.set(key, ranked)
  return ranked
}

/**
 * Which cells belong to visit `i` of `total`, as [start, end) into the ordered
 * list. Split so every visit gets a share and the shares tile the zone exactly
 * — the last visit always finishes it, whatever the rounding.
 */
export function visitSlice(count, i, total) {
  if (total <= 0) return [0, 0]
  return [Math.floor((count * i) / total), Math.floor((count * (i + 1)) / total)]
}
