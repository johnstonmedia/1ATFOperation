import { useCallback, useEffect, useRef, useState } from 'react'
import VideoEmbed, { resolveVideo, embedSrcFrom } from './VideoEmbed'
import { useToast } from '../context/ToastContext'
import { useData } from '../context/DataContext'
import {
  MAX_VIDEO_BYTES, deleteUploadedVideo, formatBytes, isVideoFile,
  playbackWarning, uploadVideo, validateVideo,
} from '../lib/videoUpload'

// Drag-and-drop video field for the Ops Centre. Three ways to fill it:
//   - drop/choose a FILE      → uploads to Firebase Storage
//   - drop/paste a LINK       → used as-is (YouTube, Vimeo, Drive, direct .mp4)
//   - paste an EMBED CODE     → the <iframe …> from a provider's Share → Embed
// All three end as one string handed back through onChange, resolved for
// display by resolveVideo — so nothing downstream needs to know which was used.
//
// The text box is deliberately kept alongside the drop zone: uploads need
// Storage enabled in the Firebase console (see src/lib/videoUpload.js), and a
// YouTube link costs the unit no bandwidth, so it stays the better option for
// anything long.

const DROP_MIN_HEIGHT = 150

// Pull something usable out of a drop that carried text rather than a file —
// a dragged link, or a selected embed code. An embed snippet spans lines and
// is not a URL, so it is tried whole before falling back to line-by-line.
function urlFromDrop(dt) {
  const raw = (dt.getData('text/uri-list') || dt.getData('text/plain') || '').trim()
  if (!raw) return ''
  if (resolveVideo(raw)) return raw
  const first = raw.split(/[\r\n]+/).find((l) => l && !l.startsWith('#'))
  return first && resolveVideo(first.trim()) ? first.trim() : ''
}

// Tell RHQ what the field actually resolved to, so a bad paste is obvious in
// the editor rather than on the live site.
function linkNote(value) {
  const raw = (value || '').trim()
  if (!raw) return 'Paste a YouTube/Vimeo link, a Share → Embed code, a Google Drive file link, or a direct .mp4 URL.'
  const v = resolveVideo(raw)
  if (!v) {
    return embedSrcFrom(raw)
      ? '⚠ That embed code has no usable https address in its src.'
      : '⚠ Not a usable video address — nothing will show on the Briefings tab.'
  }
  if (v.type === 'link') return '⚠ This provider is not recognised, so it will show as an “Open video ↗” link rather than a player. Paste its embed code instead to frame it in the page.'
  if (embedSrcFrom(raw)) return '✓ Embed code recognised — playing its src below.'
  return v.type === 'video' ? '✓ Direct video file — playing below.' : '✓ Embedded player — preview below.'
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
              A link or an embed code can be dropped or pasted below instead — better for
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
        <label style={{ fontSize: 11 }}>Video link or embed code</label>
        <textarea
          rows={2}
          className="mono"
          style={{ fontSize: 12, resize: 'vertical' }}
          value={value}
          onChange={(e) => onChange(e.target.value, { path: '', local: false })}
          placeholder={'https://…    or    <iframe src="https://…"></iframe>'}
          spellCheck={false}
        />
        <div className="mono dim" style={{ fontSize: 10, lineHeight: 1.6 }}>
          {linkNote(value)}
        </div>
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
