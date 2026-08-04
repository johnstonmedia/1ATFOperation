// Video file uploads for the Ops Centre.
//
// The portal otherwise ships every asset from the repo's public/ folder (see
// BrandingEditor), but a briefing video is content RHQ changes weekly and
// cannot commit from a browser — so this is the one place that uses Firebase
// Storage. Nothing else in the app writes to the bucket.
//
// ⚠️ Requires TWO manual console actions before it works live:
//   1. Firebase Console → Storage → enable the default bucket.
//   2. Publish storage.rules (repo root) → Storage → Rules.
// Until then uploads fail with a permission error; pasting a link still works,
// which is why the link field was kept alongside the drop zone.
//
// In LOCAL MODE there is no bucket, so a dropped file becomes a temporary
// object URL — good enough to exercise the UI, useless as published content.
// The drop zone says so loudly.

import { FIREBASE_ENABLED, app } from '../firebase/config'

// Firebase Storage's own cap is 5 TB; this is a sanity limit so nobody
// accidentally pushes a 4 GB camera original into a 5 GB free-tier bucket and
// waits half an hour to find out. Mirrored in storage.rules — change both.
export const MAX_VIDEO_BYTES = 512 * 1024 * 1024

// Formats every browser can play. Anything else uploads fine but may not
// play back for cadets, so the UI warns rather than blocks.
const SAFE_TYPES = /^video\/(mp4|webm|ogg)$/i
const VIDEO_EXT = /\.(mp4|webm|ogg|ogv|mov|m4v|avi|mkv)$/i

export function isVideoFile(file) {
  if (!file) return false
  return (file.type || '').startsWith('video/') || VIDEO_EXT.test(file.name || '')
}

export function formatBytes(n) {
  if (!n && n !== 0) return ''
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// Returns an error string when the file can't be used at all, else null.
export function validateVideo(file) {
  if (!isVideoFile(file)) return 'That is not a video file. Drop an .mp4, .webm or .mov.'
  if (file.size > MAX_VIDEO_BYTES) {
    return `That file is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_VIDEO_BYTES)}. Export it smaller, or upload it to YouTube and paste the link.`
  }
  return null
}

// Returns a warning string for files that will upload but may not play for
// every cadet, else null.
export function playbackWarning(file) {
  const type = file?.type || ''
  if (type && SAFE_TYPES.test(type)) return null
  const name = file?.name || 'That file'
  return `${name} is not MP4/WebM — it will upload, but some phones and browsers will not play it. MP4 (H.264) is the safe choice.`
}

// Storage object path for a dropped file. Timestamped so re-uploading the same
// filename never overwrites a video that is still published somewhere.
function objectPath(folder, file) {
  const clean = (file.name || 'video')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-80)
  return `${folder}/${Date.now()}-${clean}`
}

async function storageApi() {
  const mod = await import('firebase/storage')
  return { mod, storage: mod.getStorage(app) }
}

// Upload a video and resolve to { url, path, local }. `onProgress` is called
// with 0..1. Returns a `cancel()` on the object passed to `onStart` so the UI
// can abort a long upload.
export async function uploadVideo(file, { folder = 'briefings', onProgress, onStart } = {}) {
  const invalid = validateVideo(file)
  if (invalid) {
    const err = new Error(invalid)
    err.appCode = 'VALIDATION'
    throw err
  }

  if (!FIREBASE_ENABLED) {
    // LOCAL MODE: no bucket. Hand back an object URL so the editor is testable.
    onProgress?.(1)
    return { url: URL.createObjectURL(file), path: '', local: true }
  }

  const { mod, storage } = await storageApi()
  const path = objectPath(folder, file)
  const task = mod.uploadBytesResumable(mod.ref(storage, path), file, {
    contentType: file.type || 'video/mp4',
    // Long cache: the path is timestamped, so a given URL never changes content.
    cacheControl: 'public, max-age=31536000',
  })
  onStart?.({ cancel: () => task.cancel() })

  await new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => onProgress?.(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0),
      reject,
      resolve,
    )
  })
  return { url: await mod.getDownloadURL(task.snapshot.ref), path, local: false }
}

// Best-effort removal of a previously uploaded object. Never throws: a failed
// cleanup must not block the RHQ user from publishing the new video, it just
// leaves a file in the bucket.
export async function deleteUploadedVideo(path) {
  if (!path || !FIREBASE_ENABLED) return false
  try {
    const { mod, storage } = await storageApi()
    await mod.deleteObject(mod.ref(storage, path))
    return true
  } catch {
    return false
  }
}
