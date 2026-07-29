import { MAP_IMAGE, MAP_PIXEL_WIDTH, MAP_PIXEL_HEIGHT } from './territory'
import { renderTerritoryLayer, renderWaveLayer, IMAGE_FILTER } from './terrainRender'
import { buildFrames, transitionPlan, transitionDuration } from './campaign'

// Campaign replay video export.
//
// Architecture: the replay is re-rendered from scratch onto an OFFSCREEN
// canvas (map art + hatch territory layer + conquest wave + name flashes +
// place labels — the same shared renderers the live map uses), and that
// canvas is recorded in real time via canvas.captureStream() + MediaRecorder.
// No server, no extra dependencies: the browser's own encoder produces the
// file. MP4 is requested first; browsers that can't mux MP4 (older Firefox)
// fall back to WebM — the returned `ext` tells the caller which one the user
// actually got.
//
// Memory stays flat regardless of campaign length: only the current frame's
// hatch layer is cached (rebuilt once per timeline commit, exactly like the
// live replay), and encoded chunks stream into the recorder as they're
// produced — so "export works regardless of campaign size" costs only
// wall-clock time, since MediaRecorder records in real time.

const SCALE = 2 // export pixels per map-art pixel (1296x672 for the 648x336 art)
const FPS = 30
const START_HOLD_MS = 1200 // opening beat on the start state
const END_HOLD_MS = 2200 // closing beat on the final state
const EXPORT_HOLD_MS = 450 // pause between moves

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm',
]

export function exportSupported() {
  return typeof MediaRecorder !== 'undefined' && !!pickMime()
}

function pickMime() {
  for (const m of MIME_CANDIDATES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m
  }
  return null
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Map image failed to load for export.'))
    img.src = src
  })
}

// Render the campaign replay to a video Blob.
// Returns { promise: Promise<{ blob, ext }>, cancel() }.
// onProgress (0..1) reflects wall-clock progress through the recording.
export function exportCampaignReplay({ territory, campaign, onProgress }) {
  let cancelled = false
  let stopLoop = () => {}

  const promise = (async () => {
    const mime = pickMime()
    if (!mime) throw new Error('This browser cannot record video (MediaRecorder unsupported).')
    const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'

    const { cols, rows, showRHQ } = territory
    const frames = buildFrames(campaign)
    if (frames[frames.length - 1] !== territory.cells) frames.push(territory.cells)
    const transitions = frames.length - 1
    if (transitions < 1) throw new Error('No campaign history to export yet.')
    // A touch slower than the on-screen auto-replay: the video is a keepsake,
    // not something the viewer is waiting behind.
    const perMs = transitionDuration(transitions, 22000)
    const totalMs = START_HOLD_MS + transitions * (perMs + EXPORT_HOLD_MS) + END_HOLD_MS

    const img = await loadImage(MAP_IMAGE)
    if (cancelled) throw Object.assign(new Error('Export cancelled.'), { cancelled: true })
    const W = MAP_PIXEL_WIDTH * SCALE
    const H = MAP_PIXEL_HEIGHT * SCALE
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false

    // The base (map art) and the committed hatch layer only change once per
    // move — pre-render both so the per-tick cost is two drawImage calls plus
    // the flat-tint wave.
    const base = document.createElement('canvas')
    base.width = W; base.height = H
    {
      const bctx = base.getContext('2d')
      bctx.imageSmoothingEnabled = false
      bctx.fillStyle = '#0a0f1a'
      bctx.fillRect(0, 0, W, H)
      // ctx.filter mirrors the CSS filter the live map applies to the art.
      // Browsers without canvas filter support just get the unfiltered art.
      try { bctx.filter = IMAGE_FILTER } catch { /* keep default */ }
      bctx.drawImage(img, 0, 0, W, H)
      bctx.filter = 'none'
    }
    const hatch = document.createElement('canvas')
    hatch.width = W; hatch.height = H
    const hctx = hatch.getContext('2d')
    const commitHatch = (cells) => {
      hctx.clearRect(0, 0, W, H)
      renderTerritoryLayer(hctx, { cells, cols, rows, showRHQ, w: W, h: H })
    }
    commitHatch(frames[0])

    const drawPlaces = () => {
      for (const p of territory.places || []) {
        const px = (p.x / cols) * W
        const py = (p.y / rows) * H
        ctx.fillStyle = p.hostile ? '#ff3b46' : '#dfe6f2'
        ctx.beginPath()
        ctx.arc(px, py, p.hostile ? 5 : 3.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.font = `600 ${13 * SCALE}px "JetBrains Mono", monospace`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.shadowColor = '#000'
        ctx.shadowBlur = 4
        ctx.fillStyle = p.hostile ? '#fff' : '#d3dced'
        ctx.fillText(p.name, px + 9, py)
        ctx.shadowBlur = 0
      }
    }

    // Conquest name flash for the export: fade in fast, hold, fade out over
    // the tail of the move — mirrors the on-screen CSS animation.
    const drawFlashes = (plan, t) => {
      const alpha = t < 0.12 ? t / 0.12 : t > 0.72 ? Math.max(0, 1 - (t - 0.72) / 0.28) : 1
      if (alpha <= 0) return
      for (const cl of plan.clusters) {
        if (!cl.label || cl.size < 6) continue
        const px = (cl.cx / cols) * W
        const py = (cl.cy / rows) * H
        ctx.globalAlpha = alpha
        ctx.font = `700 ${15 * SCALE}px Orbitron, "JetBrains Mono", monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.shadowColor = '#000'
        ctx.shadowBlur = 10
        ctx.lineWidth = 4
        ctx.strokeStyle = 'rgba(6,10,18,0.85)'
        ctx.strokeText(cl.label, px, py)
        ctx.fillStyle = cl.color || '#fff'
        ctx.fillText(cl.label, px, py)
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      }
    }

    const stream = canvas.captureStream(FPS)
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
    const chunks = []
    recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data) }
    const recorded = new Promise((resolve) => { recorder.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] })) })

    // Real-time playback drives the recording (MediaRecorder captures the
    // canvas as a live stream, so the export takes as long as the replay).
    await new Promise((resolve, reject) => {
      let raf = 0
      let committed = 0 // index of the frame currently baked into `hatch`
      let plan = null
      let planK = -1
      const t0 = performance.now()
      recorder.start(1000)

      stopLoop = () => {
        cancelAnimationFrame(raf)
        try { recorder.stop() } catch { /* already stopped */ }
        reject(Object.assign(new Error('Export cancelled.'), { cancelled: true }))
      }

      const tick = (now) => {
        const elapsed = now - t0
        onProgress?.(Math.min(1, elapsed / totalMs))

        // Which phase are we in?
        let waveT = null
        let k = -1
        const tMove = elapsed - START_HOLD_MS
        if (tMove >= 0) {
          k = Math.min(transitions - 1, Math.floor(tMove / (perMs + EXPORT_HOLD_MS)))
          const within = tMove - k * (perMs + EXPORT_HOLD_MS)
          waveT = Math.min(1, within / perMs)
        }

        if (k >= 0 && planK !== k) {
          // Entering move k: bake the previous move's end state into the
          // hatch layer and precompute this move's wave plan.
          if (committed !== k) { commitHatch(frames[k]); committed = k }
          plan = transitionPlan(frames[k], frames[k + 1], cols, rows)
          planK = k
        }
        if (elapsed >= totalMs - END_HOLD_MS && committed !== transitions) {
          commitHatch(frames[transitions])
          committed = transitions
          plan = null
        }

        ctx.clearRect(0, 0, W, H)
        ctx.drawImage(base, 0, 0)
        ctx.drawImage(hatch, 0, 0)
        if (plan && waveT !== null) {
          renderWaveLayer(ctx, plan, waveT, { cols, rows, w: W, h: H })
          drawFlashes(plan, waveT)
        }
        drawPlaces()

        if (elapsed >= totalMs) {
          recorder.stop()
          resolve()
          return
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })

    if (cancelled) throw Object.assign(new Error('Export cancelled.'), { cancelled: true })
    const blob = await recorded
    return { blob, ext }
  })()

  return {
    promise,
    cancel() {
      cancelled = true
      stopLoop()
    },
  }
}

// Hand the finished video to the browser's downloader.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
