import { useCallback, useEffect, useRef, useState } from 'react'
import VideoEmbed from './VideoEmbed'
import { useToast } from '../context/ToastContext'
import { useData } from '../context/DataContext'
import {
  MAX_VIDEO_BYTES, deleteUploadedVideo, formatBytes, isVideoFile,
  playbackWarning, uploadVideo, validateVideo,
} from '../lib/videoUpload'

// Drag-and-drop video field for the Ops Centre. Drop a file from the desktop
// and it uploads to Firebase Storage; drop (or paste) a YouTube/Vimeo link and
// it is used as-is. Both paths end at the same thing — a URL handed back
// through onChange — so nothing downstream needs to know which was used.
//
// The link box is deliberately kept: uploads need Storage enabled in the
// Firebase console (see src/lib/videoUpload.js), and a YouTube link costs the
// unit no bandwidth, so it stays the better option for anything long.

const DROP_MIN_HEIGHT = 150

// Pull a usable URL out of a drop that carried a link rather than a file
// (dragging a video's address bar / a link off a page).
function urlFromDrop(dt) {
  const raw = dt.getData('text/uri-list') || dt.getData('text/plain') || ''
  const first = raw.split(/[\r\n]+/).find((l) => l && !l.startsWith('#'))
  if (!first) return ''
  try { new URL(first.trim()) } catch { return '' }
  return first.trim()
}

export default function VideoDropZone({
  value = '',
  path = '',
  onChange,
  folder = 'briefings',
  label = 'Briefing video',
}) {
  const { push } = useToast()
  const { reportError } = useData()
  const [over, setOver] = useState(false)
  const [progress, setProgress] = useState(null) // null = idle, else 0..1
  const [note, setNote] = useState(null) // { kind: 'error' | 'warn' | 'info', text }
  const fileInput = useRef(null)
  const taskRef = useRef(null)
  const dragDepth = useRef(0)
  // Objects uploaded during THIS editing session. Only these are safe to
  // delete when the video is replaced — the one already published may still be
  // in use if the RHQ user walks away without saving.
  const sessionPaths = useRef(new Set())

  // A file dropped outside the zone makes the browser navigate to it, which
  // would silently bin every unsaved edit in the editor. Swallow those while
  // this field is on screen.
  useEffect(() => {
    const stop = (e) => { e.preventDefault() }
    window.addEventListener('dragover', stop)
    window.addEventListener('drop', stop)
    return () => {
      window.removeEventListener('dragover', stop)
      window.removeEventListener('drop', stop)
    }
  }, [])

  const replace = useCallback((url, newPath, local) => {
    const old = path
    onChange(url, { path: newPath, local })
    if (old && old !== newPath && sessionPaths.current.has(old)) {
      sessionPaths.current.delete(old)
      deleteUploadedVideo(old)
    }
  }, [onChange, path])

  const startUpload = useCallback(async (file) => {
    const invalid = validateVideo(file)
    if (invalid) { setNote({ kind: 'error', text: invalid }); return }

    setNote(null)
    setProgress(0)
    try {
      const res = await uploadVideo(file, {
        folder,
        onProgress: setProgress,
        onStart: (t) => { taskRef.current = t },
      })
      if (res.path) sessionPaths.current.add(res.path)
      replace(res.url, res.path, res.local)
      const warn = playbackWarning(file)
      if (res.local) {
        setNote({ kind: 'warn', text: 'LOCAL MODE: this preview only exists in this browser session and cannot be published. Paste a link to publish a real video.' })
      } else if (warn) {
        setNote({ kind: 'warn', text: warn })
      }
      push('Video uploaded')
    } catch (err) {
      if (err?.code === 'storage/canceled') {
        setNote({ kind: 'info', text: 'Upload cancelled.' })
      } else if (err?.code === 'storage/unauthorized' || err?.code === 'storage/unknown') {
        setNote({ kind: 'error', text: 'The server rejected the upload. Firebase Storage may not be enabled for this project, or its rules have not been published yet. Paste a video link instead.' })
        reportError(err, 'Briefing video upload', { file: file.name, size: file.size })
      } else if (err?.appCode === 'VALIDATION') {
        setNote({ kind: 'error', text: err.message })
      } else {
        setNote({ kind: 'error', text: `Upload failed: ${err?.message || 'unknown error'}` })
        reportError(err, 'Briefing video upload', { file: file.name, size: file.size })
      }
    } finally {
      taskRef.current = null
      setProgress(null)
    }
  }, [folder, push, replace, reportError])

  const onDrop = (e) => {
    e.preventDefault()
    dragDepth.current = 0
    setOver(false)
    if (progress !== null) return
    const file = e.dataTransfer.files?.[0]
    if (file) {
      if (!isVideoFile(file)) {
        setNote({ kind: 'error', text: `“${file.name}” is not a video file. Drop an .mp4, .webm or .mov.` })
        return
      }
      startUpload(file)
      return
    }
    const url = urlFromDrop(e.dataTransfer)
    if (url) { setNote(null); replace(url, '', false) } else {
      setNote({ kind: 'error', text: 'Nothing usable in that drop — drop a video file, or a link to one.' })
    }
  }

  const clear = () => {
    setNote(null)
    replace('', '', false)
  }

  const busy = progress !== null
  const pct = Math.round((progress || 0) * 100)
  const noteColour = note?.kind === 'error' ? 'var(--hostile)' : note?.kind === 'warn' ? '#ffb648' : 'var(--accent)'

  return (
    <div className="col" style={{ gap: 10 }}>
      <label>{label}</label>

      <div
        onDragEnter={(e) => { e.preventDefault(); dragDepth.current += 1; setOver(true) }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
        onDragLeave={() => { dragDepth.current -= 1; if (dragDepth.current <= 0) { dragDepth.current = 0; setOver(false) } }}
        onDrop={onDrop}
        onClick={() => { if (!busy) fileInput.current?.click() }}
        onKeyDown={(e) => { if (!busy && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileInput.current?.click() } }}
        role="button"
        tabIndex={0}
        aria-label="Drop a video file here, or click to choose one"
        aria-busy={busy}
        className="col center mono"
        style={{
          minHeight: DROP_MIN_HEIGHT,
          gap: 8,
          padding: 18,
          textAlign: 'center',
          cursor: busy ? 'progress' : 'pointer',
          borderRadius: 'var(--radius)',
          border: `1px dashed ${over ? 'var(--accent)' : 'var(--line)'}`,
          background: over ? 'rgba(54,224,192,0.08)' : 'rgba(0,0,0,0.25)',
          transition: 'background 120ms linear, border-color 120ms linear',
        }}
      >
        {busy ? (
          <>
            <div style={{ fontSize: 12, letterSpacing: 2 }} className="accent">UPLOADING — {pct}%</div>
            <div style={{ width: '80%', maxWidth: 360, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', transition: 'width 120ms linear' }} />
            </div>
            <button
              className="ghost"
              onClick={(e) => { e.stopPropagation(); taskRef.current?.cancel() }}
              style={{ fontSize: 11 }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 26, opacity: 0.7 }} aria-hidden>⬍</div>
            <div style={{ fontSize: 13, letterSpacing: 1 }} className="accent">
              {over ? 'RELEASE TO UPLOAD' : 'DRAG A VIDEO FILE HERE'}
            </div>
            <div className="dim" style={{ fontSize: 11, lineHeight: 1.6, maxWidth: 420 }}>
              …or click to choose one. MP4 or WebM, up to {formatBytes(MAX_VIDEO_BYTES)}.
              A YouTube or Vimeo link can be dropped or pasted below instead — better for
              anything long, and it costs the unit no storage.
            </div>
          </>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = '' // let the same file be re-picked after a failure
            if (f) startUpload(f)
          }}
        />
      </div>

      {note && (
        <div className="mono" style={{ fontSize: 11, lineHeight: 1.6, color: noteColour }} role="status">
          {note.text}
        </div>
      )}

      <div className="col" style={{ gap: 4 }}>
        <label style={{ fontSize: 11 }}>Video link (YouTube, Vimeo, or a direct .mp4)</label>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value, { path: '', local: false })}
          placeholder="https://…"
        />
      </div>

      {value.trim() && (
        <>
          <VideoEmbed url={value} />
          <div className="row" style={{ gap: 8 }}>
            <button className="ghost" onClick={clear} style={{ fontSize: 11 }}>Remove video</button>
            {path && <span className="mono dim" style={{ fontSize: 10, alignSelf: 'center' }}>uploaded file · {path.split('/').pop()}</span>}
          </div>
        </>
      )}
    </div>
  )
}
