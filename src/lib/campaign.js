import { PAINT, RHQ_PAINT, TASKFORCE_CODE, colorOf, coyLabelOf } from './territory'

// Campaign replay frames. The campaign is stored as its OWN Firestore
// collection (`campaignFrames`), one document per frame:
//
//   { id, order, cells: <cols*rows string>, label, ts, updatedAt }
//
// Each frame is a FULL snapshot, not a diff — unlike the old single-doc
// diff-chain, every frame is independently readable and editable: RHQ can
// jump to frame 5 and repaint it without needing to replay anything before
// it, reorder frames, duplicate one to insert a new step, or delete one, all
// as plain per-document operations. `order` is kept as a contiguous 0..N-1
// index (see renumberFrames) so "the sequence" is just "sort by order".

/* ------------------------- carrying an edit forward ---------------------- */
//
// Ground taken on Monday is still held on Wednesday. So when RHQ repaints a
// frame, what they painted should appear on every frame AFTER it too —
// otherwise correcting the map means repainting the same ground once per
// remaining day of camp, and forgetting one leaves the replay showing ground
// being taken and then quietly given back.
//
// ⚠️ THIS IS NOT THE OLD DIFF CHAIN, and must not become it. Frames stay FULL
// independent snapshots; this copies only the CELLS THE EDIT CHANGED onto the
// later frames, once, at the moment RHQ commits the edit. Everything else
// those frames say is untouched, which is the whole reason the collection
// stopped being a chain (see the CHANGELOG for v2.2). Handing a later frame
// the whole grid would wipe every day that came after the one being edited.

// Index -> new character, for the cells an edit actually changed. An empty
// map (including for mismatched lengths) means "nothing to carry".
export function frameEditDiff(before, after) {
  const diff = new Map()
  if (typeof before !== 'string' || typeof after !== 'string') return diff
  if (before.length !== after.length) return diff
  for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) diff.set(i, after[i])
  return diff
}

const isRHQCell = (ch) => ch === 'R' || ch === 'r'

/**
 * Apply an edit's changed cells to another frame.
 *
 * `finalise` is for the LAST frame of the campaign, which is the one that has
 * to end with 1ATF holding everything: ground carried into it arrives as the
 * task force's own solid code rather than in the colour of whichever company
 * took it. An ERASE stays an erase — turning "nothing here" into held ground
 * would be inventing a claim RHQ didn't make — and RHQ's own ground is never
 * overpainted, the same rule campFrames.js paints by.
 */
export function applyFrameDiff(cells, diff, { finalise = false } = {}) {
  if (!diff?.size || typeof cells !== 'string') return cells
  const arr = cells.split('')
  for (const [i, ch] of diff) {
    if (i >= arr.length) continue
    if (isRHQCell(arr[i]) && !isRHQCell(ch)) continue
    arr[i] = finalise && ch !== '.' && !isRHQCell(ch) ? TASKFORCE_CODE : ch
  }
  return arr.join('')
}

/* -------------------------------- ordering ------------------------------- */

export function sortFrames(frames) {
  return [...(frames || [])].sort((a, b) => a.order - b.order)
}

// Re-assign contiguous order values 0..N-1 to an array already in the
// desired sequence. Call this right before persisting any structural change
// (add/duplicate/delete/reorder) so order never drifts or collides.
export function renumberFrames(frames) {
  return frames.map((f, i) => ({ ...f, order: i }))
}

// True when there's at least one frame and every frame's cell string fits
// the current grid resolution (a frame recorded against an old map size
// can't be replayed over the current art — see store.js normalizeFrames).
export function framesValid(frames, cols, rows) {
  return Array.isArray(frames) && frames.length > 0 &&
    frames.every((f) => typeof f.cells === 'string' && f.cells.length === cols * rows)
}

// Ordered cell-strings, frame 0 = the campaign start state.
export function frameCells(frames) {
  return sortFrames(frames).map((f) => f.cells)
}

// Caption per transition, aligned with frameCells: transition k plays INTO
// frame k+1, captioned with that frame's label. Frame 0 (the start state)
// has no caption of its own.
export function frameCaptions(frames) {
  return sortFrames(frames).slice(1).map((f) => f.label || '')
}

// Whether each frame, in order, should apply RHQ's manually-dragged company
// label positions (`territory.labelOverrides` — see MapEditor's "Arrange
// company labels" mode). There's only ONE set of override coordinates, not
// one per frame; this just says which frames borrow them. Left unset (the
// default), a frame always places company names automatically
// (companyLabels.js) — so dragging a label into place for one frame doesn't
// silently drag it in every other frame of the replay too, which is what
// happened before this flag existed. Aligned with frameCells()/frameCaptions().
export function frameUsesLabelOverrides(frames) {
  return sortFrames(frames).map((f) => !!f.useLabelOverrides)
}

/**
 * Which camp zones each frame hides, in order — or `null` for "whatever the
 * map is set to".
 *
 * ⚠️ `null` IS THE DEFAULT AND IT MEANS INHERIT, not "hide nothing". A frame
 * with no `hiddenZones` field follows the map-level `zoneVisibility` slice,
 * which is how every frame written before this existed keeps behaving exactly
 * as it did. Only a frame RHQ has actually customised carries its own list,
 * and that list REPLACES the map's rather than adding to it — the frame owns
 * its selection outright, so what you tick on a frame is what that frame
 * shows, whatever the map default later becomes.
 *
 * Aligned with frameCells()/frameCaptions()/frameUsesLabelOverrides().
 */
export function frameHiddenZones(frames) {
  return sortFrames(frames).map((f) => (Array.isArray(f.hiddenZones) ? f.hiddenZones : null))
}

/**
 * The frames the PUBLIC replay may show: everything not held back.
 *
 * Camp is generated all at once — every day of it is painted and stored
 * before camp starts (see lib/campFrames.js). Releasing that wholesale would
 * hand cadets the ending on day one, so each frame carries a `hidden` flag and
 * RHQ reveals them one at a time as camp runs. The Ops Centre always works on
 * the full set; only Home filters.
 *
 * Frames saved before the flag existed have no `hidden` and are visible, which
 * is the behaviour they already had.
 */
export function releasedFrames(frames) {
  return (frames || []).filter((f) => !f.hidden)
}

/* --------------------------- replay transitions -------------------------- */

// Owner-code -> display label for the conquest flash.
// Conquest flashes use the same unit-style labels the persistent map beacons
// do ("A-COY"), so the name that flashes during a capture is the one that
// stays on the zone afterwards.
const LABELS = {}
;[...PAINT, RHQ_PAINT].forEach((p) => { LABELS[p.code] = coyLabelOf(p.code) || p.label.toUpperCase() })

// Analyse one frame transition for animation. Changed cells are grouped into
// contiguous clusters per new owner (8-connected, so one brush stroke stays
// one cluster), and each cluster's cells get a "wave rank": a multi-source
// BFS distance from the cluster's seed cells. Seeds are the changed cells
// that touch territory the SAME owner already held in the previous frame —
// so the wave visually spreads outward from the owner's existing front line.
// A cluster with no such contact (an air-drop into fresh ground) seeds from
// the cell nearest its centroid instead.
//
// Returns { clusters: [{ owner, color, label, cx, cy, size, cells: [{x, y, r}],
// maxRank }] }. `owner` is '.' for abandoned/lost-to-nobody ground (rendered
// as a dark sweep, no label).
export function transitionPlan(prevCells, nextCells, cols, rows) {
  const changed = []
  const changedAt = new Int32Array(cols * rows).fill(-1) // index -> pos in `changed`
  for (let i = 0; i < nextCells.length; i++) {
    if (prevCells[i] !== nextCells[i]) {
      changedAt[i] = changed.length
      changed.push(i)
    }
  }
  if (!changed.length) return { clusters: [] }

  const ownerOf = (i) => {
    const ch = nextCells[i]
    return ch === '.' ? '.' : ch.toUpperCase()
  }

  const seen = new Uint8Array(changed.length)
  const clusters = []

  for (let c = 0; c < changed.length; c++) {
    if (seen[c]) continue
    // Flood the 8-connected cluster of same-owner changed cells.
    const owner = ownerOf(changed[c])
    const member = [] // indices into `changed`
    const stack = [c]
    seen[c] = 1
    while (stack.length) {
      const cur = stack.pop()
      member.push(cur)
      const i = changed[cur]
      const x = i % cols, y = (i / cols) | 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
        const p = changedAt[ny * cols + nx]
        if (p < 0 || seen[p] || ownerOf(changed[p]) !== owner) continue
        seen[p] = 1
        stack.push(p)
      }
    }

    // Seeds: cells bordering (4-conn) prior same-owner territory.
    const rank = new Int32Array(member.length).fill(-1)
    const posOf = new Map() // cell index -> position in `member`
    let sx = 0, sy = 0
    member.forEach((m, k) => {
      const i = changed[m]
      posOf.set(i, k)
      sx += i % cols
      sy += (i / cols) | 0
    })
    const cx = sx / member.length, cy = sy / member.length
    const queue = []
    if (owner !== '.') {
      member.forEach((m, k) => {
        const i = changed[m]
        const x = i % cols, y = (i / cols) | 0
        const near = (nx, ny) => {
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return false
          const ch = prevCells[ny * cols + nx]
          return ch !== '.' && ch.toUpperCase() === owner
        }
        if (near(x - 1, y) || near(x + 1, y) || near(x, y - 1) || near(x, y + 1)) {
          rank[k] = 0
          queue.push(k)
        }
      })
    }
    if (!queue.length) {
      // No contact with existing territory — ripple out from the centroid.
      let best = 0, bestD = Infinity
      member.forEach((m, k) => {
        const i = changed[m]
        const d = (i % cols - cx) ** 2 + (((i / cols) | 0) - cy) ** 2
        if (d < bestD) { bestD = d; best = k }
      })
      rank[best] = 0
      queue.push(best)
    }
    let maxRank = 0
    for (let q = 0; q < queue.length; q++) {
      const k = queue[q]
      const i = changed[member[k]]
      const x = i % cols, y = (i / cols) | 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        const p = posOf.get((y + dy) * cols + (x + dx))
        if (p === undefined || rank[p] >= 0) continue
        rank[p] = rank[k] + 1
        if (rank[p] > maxRank) maxRank = rank[p]
        queue.push(p)
      }
    }

    clusters.push({
      owner,
      color: owner === '.' ? null : colorOf(owner),
      label: owner === '.' ? null : LABELS[owner] || owner,
      cx, cy,
      size: member.length,
      maxRank,
      cells: member.map((m, k) => {
        const i = changed[m]
        return { x: i % cols, y: (i / cols) | 0, r: Math.max(0, rank[k]) }
      }),
    })
  }

  return { clusters }
}

// Per-transition play time: slower for a short campaign, compressed for a
// long one so a full auto-replay never drags past ~20 s of animation.
export function transitionDuration(count, base = 18000) {
  return Math.min(1800, Math.max(750, base / Math.max(1, count)))
}
