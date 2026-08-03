import { PAINT, RHQ_PAINT, colorOf } from './territory'

// Campaign replay timeline. The campaign is stored as ONE content slice
// (`content/campaign`) shaped as:
//
//   {
//     start:    { cells: <cols*rows string>, ts } | null   // frame 0
//     timeline: [ { ts, diff } ]                           // one entry per RHQ save
//   }
//
// Each timeline entry is a DIFF against the previous frame, not a full
// snapshot — a full 216x112 grid is ~24 KB, so storing every save verbatim
// would blow through Firestore's 1 MiB doc limit after ~40 saves. A diff only
// records the runs of cells that actually changed, so hundreds of ordinary
// paint sessions fit comfortably in the single doc. Frames are reconstructed
// at replay time by applying the diffs in order (see buildFrames).
//
// Diff encoding: `<index36>:<replacement>` segments joined by ';', where
// <replacement> is the literal run of new cell codes starting at that index.
// Cell codes are [.A-Za-z] so ':' and ';' can never collide with content.

export const EMPTY_CAMPAIGN = { start: null, timeline: [] }

// Stay well under Firestore's 1 MiB per-document cap; when the campaign doc
// would outgrow this, the OLDEST timeline entries are folded into the start
// state (the replay simply begins one move later — see appendSave).
const MAX_CAMPAIGN_BYTES = 700_000

/* ------------------------------ diff codec ------------------------------ */

// Encode the change from `prev` to `next` (equal-length cell strings) as
// compact runs. Returns '' when nothing changed.
export function diffCells(prev, next) {
  if (prev === next) return ''
  const runs = []
  let i = 0
  const n = next.length
  while (i < n) {
    if (prev[i] === next[i]) { i++; continue }
    let j = i + 1
    while (j < n && prev[j] !== next[j]) j++
    runs.push(i.toString(36) + ':' + next.slice(i, j))
    i = j
  }
  return runs.join(';')
}

export function applyDiff(cells, diff) {
  if (!diff) return cells
  let out = cells
  for (const seg of diff.split(';')) {
    const k = seg.indexOf(':')
    const i = parseInt(seg.slice(0, k), 36)
    const s = seg.slice(k + 1)
    out = out.slice(0, i) + s + out.slice(i + s.length)
  }
  return out
}

/* ------------------------------- timeline ------------------------------- */

// True when the campaign has a start state that fits the current grid.
export function campaignValid(campaign, cols, rows) {
  return !!(
    campaign &&
    campaign.start &&
    typeof campaign.start.cells === 'string' &&
    campaign.start.cells.length === cols * rows
  )
}

// Reconstruct every frame: [startCells, afterSave1, afterSave2, ...].
export function buildFrames(campaign) {
  const frames = [campaign.start.cells]
  let cur = campaign.start.cells
  for (const entry of campaign.timeline || []) {
    cur = applyDiff(cur, entry.diff)
    frames.push(cur)
  }
  return frames
}

// Caption for each recorded move, aligned with the transitions returned by
// buildFrames (transition k plays timeline[k]). '' when unlabelled.
export function frameLabels(campaign) {
  return (campaign.timeline || []).map((e) => e.label || '')
}

// The latest reconstructed state (what the last save left the map as).
export function latestFrame(campaign) {
  let cur = campaign.start.cells
  for (const entry of campaign.timeline || []) cur = applyDiff(cur, entry.diff)
  return cur
}

// Record a save as a new timeline point. Returns the new campaign object, or
// null when the save didn't change any cells (no point in an empty frame).
// If the doc would outgrow the Firestore size budget, the oldest entries are
// folded into the start state — history quietly loses its earliest move(s)
// rather than the save failing outright.
export function appendSave(campaign, newCells, ts = Date.now(), label = '') {
  const prev = latestFrame(campaign)
  const diff = diffCells(prev, newCells)
  if (!diff) return null
  const entry = { ts, diff }
  // Optional caption shown while this move plays back (and in the export).
  if (label && label.trim()) entry.label = label.trim().slice(0, 80)
  let next = {
    start: campaign.start,
    timeline: [...(campaign.timeline || []), entry],
  }
  while (campaignByteSize(next) > MAX_CAMPAIGN_BYTES && next.timeline.length > 1) {
    const [oldest, ...rest] = next.timeline
    next = {
      start: { cells: applyDiff(next.start.cells, oldest.diff), ts: oldest.ts },
      timeline: rest,
    }
  }
  return next
}

export function campaignByteSize(campaign) {
  // Close enough to the Firestore serialized size for budgeting purposes.
  return JSON.stringify(campaign).length
}

/* --------------------------- replay transitions -------------------------- */

// Owner-code -> display label for the conquest flash.
const LABELS = {}
;[...PAINT, RHQ_PAINT].forEach((p) => { LABELS[p.code] = p.label.toUpperCase() })

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
