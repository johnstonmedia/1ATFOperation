// Version history for the editable content slices.
//
// Every save through DataContext.updateSlice first files the value it is about
// to overwrite into the `backups` collection, so RHQ can look at — and roll
// back to — any recent state of the map, the narrative, the briefings and so
// on. Nothing here is public: unlike `content/*`, backups are RHQ-read-only
// (see firestore.rules), which is also why the staff password slice is safe to
// keep here.
//
// WHAT IS AND ISN'T COVERED, deliberately:
//   ✓ every single-value slice in store.js SINGLE_SLICES — the map, all the
//     text, branding, intel, the replay start frame, staff access.
//   ✗ `roster`. It is the one collection holding personal data (names, ID
//     numbers, emails, plain-text temp passwords). Copying it into a second
//     collection on every edit would multiply that exposure for no operational
//     gain, so roster edits are NOT versioned. Use the Users spreadsheet
//     export before a bulk import instead.
//   ✗ `campaignFrames`. It is already an explicit, editable history — each
//     frame is its own document RHQ can duplicate, reorder or delete. Copying
//     the whole set on every change would also push a single backup document
//     near Firestore's 1 MiB limit.
//
// Restores are themselves ordinary saves, so restoring backs up what you are
// replacing first — an undo of the undo is always available.

import { FIREBASE_ENABLED, db } from '../firebase/config'

// Versions kept per slice. Older ones are pruned as new ones arrive. Painting
// the map produces the biggest documents (~24 KB of cells each), so this is a
// deliberate ceiling on storage rather than an arbitrary round number.
export const BACKUP_KEEP = 20

// Firestore's hard per-document limit is 1 MiB; stay well under it so a backup
// can never be the thing that makes a save fail.
const MAX_BACKUP_BYTES = 600 * 1024

const LS_KEY = '1atf-backups'

export const SLICE_LABELS = {
  narrative: 'Map: Narrative',
  territory: 'Map: Territory',
  classified: 'Welcome Page',
  branding: 'Branding & Assets',
  companyPages: 'Company Pages',
  video: 'Home Video',
  intel: 'Intercepted Intelligence',
  intelIntro: 'Intel Introduction',
  briefings: 'Briefings',
  campaignDefaultStart: 'Replay Start Frame',
  staffAccess: 'Staff Centre Access',
}
export const sliceLabel = (s) => SLICE_LABELS[s] || s

/* ------------------------------ local mode ------------------------------ */

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]')
  } catch {
    return []
  }
}
function writeLocal(rows) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rows))
  } catch {
    /* quota — the oldest are pruned below, so this only bites on huge values */
  }
}

/* -------------------------------- public -------------------------------- */

const newest = (rows) => [...rows].sort((a, b) => (b.ts || 0) - (a.ts || 0))

// File the value a slice is about to lose. Returns the stored record, or null
// when there was nothing worth keeping. NEVER throws: a failed backup must not
// stop RHQ from saving their work.
export async function recordBackup({ slice, value, by = '', byId = '' }) {
  if (value === undefined) return null
  let json
  try {
    json = JSON.stringify(value)
  } catch {
    return null // circular / unserialisable — nothing sane to store
  }
  if (json === undefined) return null
  const size = json.length
  if (size > MAX_BACKUP_BYTES) return null

  const record = { slice, value, ts: Date.now(), by, byId, size }
  try {
    if (!FIREBASE_ENABLED) {
      const rows = readLocal()
      rows.push({ id: `bk-${record.ts}-${Math.random().toString(36).slice(2, 8)}`, ...record })
      writeLocal(prunedLocal(rows, slice))
      return record
    }
    const { collection, addDoc } = await import('firebase/firestore')
    await addDoc(collection(db, 'backups'), record)
    await prune(slice)
    return record
  } catch {
    return null
  }
}

// True when the value is identical to the last thing filed for this slice, so
// repeated Saves with no edits don't fill the history with duplicates.
export async function isDuplicateOfLatest(slice, value) {
  try {
    const rows = await listBackups({ slice, limit: 1 })
    if (!rows.length) return false
    return JSON.stringify(rows[0].value) === JSON.stringify(value)
  } catch {
    return false
  }
}

// Newest first. `slice` filters to one slice; omit for everything.
export async function listBackups({ slice = '', limit: cap = 250 } = {}) {
  if (!FIREBASE_ENABLED) {
    const rows = newest(readLocal().filter((r) => !slice || r.slice === slice))
    return rows.slice(0, cap)
  }
  const { collection, getDocs, query, where, orderBy, limit } = await import('firebase/firestore')
  // Single-field filters/orders only — a `where` + `orderBy` on different
  // fields would need a composite index created by hand in the console, and
  // this project's standing problem is console steps nobody performs. Slice
  // filtering is done client-side instead; the volume is capped and tiny.
  const q = slice
    ? query(collection(db, 'backups'), where('slice', '==', slice))
    : query(collection(db, 'backups'), orderBy('ts', 'desc'), limit(cap))
  const snap = await getDocs(q)
  const rows = []
  snap.forEach((d) => rows.push({ id: d.id, ...d.data() }))
  return newest(rows).slice(0, cap)
}

export async function deleteBackup(id) {
  if (!FIREBASE_ENABLED) {
    writeLocal(readLocal().filter((r) => r.id !== id))
    return
  }
  const { doc, deleteDoc } = await import('firebase/firestore')
  await deleteDoc(doc(db, 'backups', id))
}

function prunedLocal(rows, slice) {
  const forSlice = newest(rows.filter((r) => r.slice === slice))
  const doomed = new Set(forSlice.slice(BACKUP_KEEP).map((r) => r.id))
  return rows.filter((r) => !doomed.has(r.id))
}

// Drop everything past BACKUP_KEEP for one slice. Best-effort.
async function prune(slice) {
  try {
    const { collection, getDocs, query, where, doc, deleteDoc } = await import('firebase/firestore')
    const snap = await getDocs(query(collection(db, 'backups'), where('slice', '==', slice)))
    const rows = []
    snap.forEach((d) => rows.push({ id: d.id, ts: d.data().ts || 0 }))
    const doomed = newest(rows).slice(BACKUP_KEEP)
    await Promise.all(doomed.map((r) => deleteDoc(doc(db, 'backups', r.id))))
  } catch {
    /* pruning is housekeeping — never surface it */
  }
}

/* ------------------------------- summaries ------------------------------- */

export function formatSize(n) {
  if (!n && n !== 0) return '—'
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)

// One line describing how a backed-up value differs from what is live now, so
// the list answers "what would restoring this actually change?" without making
// RHQ open every entry.
export function describeChange(slice, backup, current) {
  if (JSON.stringify(backup) === JSON.stringify(current)) return 'Identical to what is live now'

  if (slice === 'territory') {
    const a = backup?.cells || ''
    const b = current?.cells || ''
    const parts = []
    if (a.length === b.length) {
      let changed = 0
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) changed++
      parts.push(`${changed.toLocaleString()} cell${changed === 1 ? '' : 's'} differ`)
    } else {
      parts.push('different grid size')
    }
    const pa = backup?.places?.length || 0
    const pb = current?.places?.length || 0
    if (pa !== pb) parts.push(`${pa} place name${pa === 1 ? '' : 's'} vs ${pb} now`)
    return parts.join(' · ')
  }

  if (Array.isArray(backup) && Array.isArray(current)) {
    const idsA = new Set(backup.map((x) => x?.id).filter(Boolean))
    const idsB = new Set(current.map((x) => x?.id).filter(Boolean))
    const gone = [...idsA].filter((x) => !idsB.has(x)).length
    const added = [...idsB].filter((x) => !idsA.has(x)).length
    const bits = [`${backup.length} item${backup.length === 1 ? '' : 's'} vs ${current.length} now`]
    if (gone) bits.push(`${gone} since removed`)
    if (added) bits.push(`${added} added since`)
    return bits.join(' · ')
  }

  if (isObj(backup) && isObj(current)) {
    const keys = [...new Set([...Object.keys(backup), ...Object.keys(current)])]
    const diff = keys.filter((k) => JSON.stringify(backup[k]) !== JSON.stringify(current[k]))
    if (!diff.length) return 'Differs only in ordering'
    const shown = diff.slice(0, 4).join(', ')
    return `Changed: ${shown}${diff.length > 4 ? ` +${diff.length - 4} more` : ''}`
  }

  return 'Differs from what is live now'
}

// A whole-portal export: every current slice in one JSON file, for keeping off
// the platform entirely. The counterpart to per-slice rollback — it is what
// survives the Firebase project itself going away.
export function buildFullExport(state, slices) {
  const content = {}
  for (const s of slices) content[s] = state?.[s]
  return {
    exportedAt: new Date().toISOString(),
    note: '1ATF portal content export. Roster and personal data are deliberately excluded.',
    content,
    campaignFrames: state?.campaignFrames || [],
  }
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
