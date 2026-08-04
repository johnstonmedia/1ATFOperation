import { MAP_IMAGE, MAP_PIXEL_WIDTH, MAP_PIXEL_HEIGHT, beaconStateFor } from './territory'
import { renderTerritoryLayer, renderWaveLayer, drawCompanyLabels, drawLegend, IMAGE_FILTER } from './terrainRender'
import { frameCells, frameCaptions, sortFrames, transitionPlan, transitionDuration } from './campaign'
import { companyLabelPoints, mergedGainLabels, legendCodes } from './companyLabels'

// Campaign replay video + still-image export.
//
// Architecture: both re-render the campaign from scratch onto an OFFSCREEN
// canvas (map art + hatch territory layer + conquest wave + name flashes +
// place labels — the same shared renderers the live map uses). The video is
// recorded in real time via canvas.captureStream() + MediaRecorder; the
// still image is just one draw + canvas.toBlob(). No server, no extra
// dependencies. MP4 is requested first for video; browsers that can't mux
// MP4 (older Firefox) fall back to WebM — the returned `ext` tells the
// caller which one the user actually got.
//
// Memory stays flat regardless of campaign length: only the current frame's
// hatch layer is cached (rebuilt once per timeline commit, exactly like the
// live replay), and encoded video chunks stream into the recorder as they're
// produced.

const SCALE = 3 // export pixels per map-art pixel (1944x1008 for the 648x336 art)
const FPS = 30
const START_HOLD_MS = 1200 // opening beat on the start state
const END_HOLD_MS = 2200 // closing beat on the final state
const EXPORT_HOLD_MS = 450 // pause between moves
// Hatch fills are fine repeating high-contrast lines — exactly the pattern
// video codecs compress worst, so this needs to run well above a typical
// "screen recording" bitrate to stay sharp instead of smearing into mush.
const VIDEO_BITRATE = 20_000_000

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

/* --------------------------- shared draw helpers -------------------------- */

// Render the base map art onto a W x H canvas, filtered but crisp.
//
// The CSS-style filter is applied at the image's NATIVE resolution first (a
// 1:1 draw — nothing to resample, so there's nothing for the filter pass to
// soften), and only THEN is that already-filtered result upscaled to W x H
// with smoothing explicitly off. The previous approach applied ctx.filter
// during the scaled draw itself; some browsers route a filtered drawImage
// through a different internal raster path that re-enables smoothing
// regardless of imageSmoothingEnabled — that was the source of the blurry
// map art in exported video and images.
function renderBaseMap(img, W, H) {
  const native = document.createElement('canvas')
  native.width = MAP_PIXEL_WIDTH
  native.height = MAP_PIXEL_HEIGHT
  const nctx = native.getContext('2d')
  nctx.imageSmoothingEnabled = false
  try { nctx.filter = IMAGE_FILTER } catch { /* keep default */ }
  nctx.drawImage(img, 0, 0)
  nctx.filter = 'none'

  const base = document.createElement('canvas')
  base.width = W; base.height = H
  const bctx = base.getContext('2d')
  bctx.imageSmoothingEnabled = false
  bctx.fillStyle = '#0a0f1a'
  bctx.fillRect(0, 0, W, H)
  bctx.drawImage(native, 0, 0, MAP_PIXEL_WIDTH, MAP_PIXEL_HEIGHT, 0, 0, W, H)
  return base
}

function renderHatch(cells, cols, rows, showRHQ, W, H) {
  const hatch = document.createElement('canvas')
  hatch.width = W; hatch.height = H
  renderTerritoryLayer(hatch.getContext('2d'), { cells, cols, rows, showRHQ, w: W, h: H })
  return hatch
}

// Place markers, drawn to match Beacon.jsx on the live map rather than the
// plain white dot + name this used to be: the dot takes the CURRENT occupier's
// colour, strongholds get the glow ring, and the occupier tag ("A-COY",
// "1ATF") sits beside the name in its own dark chip. `territory` must carry
// the cells being rendered right now, not the live ones — occupancy is derived
// per frame, so a name's colour tracks the replay exactly like it does on the
// page.
function drawPlaces(ctx, territory, cols, rows, W, H, scale) {
  const showRHQ = !!territory.showRHQ
  for (const p of territory.places || []) {
    const b = beaconStateFor(territory, p, { showRHQ })
    const px = (p.x / cols) * W
    const py = (p.y / rows) * H
    const dot = b.color || '#dfe6f2'
    const r = (b.pulse ? 5 : 3.5) * scale

    // Stronghold ring — the still equivalent of the page's expanding ping.
    if (b.pulse) {
      ctx.globalAlpha = 0.35
      ctx.strokeStyle = dot
      ctx.lineWidth = 1.5 * scale
      ctx.beginPath()
      ctx.arc(px, py, r * 2.4, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    ctx.fillStyle = dot
    ctx.shadowColor = dot
    ctx.shadowBlur = 8 * scale
    ctx.beginPath()
    ctx.arc(px, py, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    const nameFont = `600 ${11 * scale}px "JetBrains Mono", monospace`
    const tagFont = `700 ${10 * scale}px "JetBrains Mono", monospace`
    const gap = 4 * scale
    let x = px + 8 * scale

    ctx.font = nameFont
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = '#000'
    ctx.shadowBlur = 3 * scale
    ctx.fillStyle = '#d3dced'
    ctx.fillText(p.name, x, py)
    x += ctx.measureText(p.name).width + gap
    ctx.shadowBlur = 0

    if (!b.tag) continue
    const tag = b.tag.toUpperCase()
    ctx.font = tagFont
    const tw = ctx.measureText(tag).width
    const padX = 5 * scale, chipH = 14 * scale
    ctx.fillStyle = 'rgba(6,10,18,0.78)'
    ctx.beginPath()
    ctx.rect(x, py - chipH / 2, tw + padX * 2, chipH)
    ctx.fill()
    if (b.recaptured) {
      // Same distinction the page makes: a retaken stronghold gets a glowing
      // bordered chip with white text instead of a plain coloured tag.
      ctx.strokeStyle = dot
      ctx.lineWidth = 1 * scale
      ctx.stroke()
    }
    ctx.fillStyle = b.recaptured ? '#fff' : dot
    ctx.fillText(tag, x + padX, py)
  }
}

// Conquest name flash. `alpha` is the caller's call: the video fades it in
// and out across a move (see flashAlphaAt); a still image just wants it
// fully visible.
function drawFlashes(ctx, plan, alpha, cols, rows, W, H, scale) {
  if (alpha <= 0) return
  for (const cl of plan.clusters) {
    if (!cl.label || cl.size < 6) continue
    const px = (cl.cx / cols) * W
    const py = (cl.cy / rows) * H
    ctx.globalAlpha = alpha
    ctx.font = `700 ${15 * scale}px Orbitron, "JetBrains Mono", monospace`
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

// Fade in fast, hold, fade out over the tail of a move — mirrors the
// on-screen CSS animation. Video-only; stills call drawFlashes with alpha=1.
const flashAlphaAt = (t) => (t < 0.12 ? t / 0.12 : t > 0.72 ? Math.max(0, 1 - (t - 0.72) / 0.28) : 1)

// A bordered caption banner — the video's per-move caption sits along the
// bottom; the still image's header sits along the top.
function drawBanner(ctx, text, W, H, scale, { top = false } = {}) {
  ctx.font = `700 ${13 * scale}px "JetBrains Mono", monospace`
  const padX = 10 * scale, padY = 7 * scale
  const tw = ctx.measureText(text).width
  const bw = Math.min(W * 0.88, tw + padX * 2)
  const bh = 15 * scale + padY
  const bx = (W - bw) / 2, by = top ? 14 * scale : H - bh - 14 * scale
  ctx.fillStyle = 'rgba(6,10,18,0.82)'
  ctx.strokeStyle = '#36e0c0'
  ctx.lineWidth = 1.5 * scale
  ctx.beginPath()
  ctx.rect(bx, by, bw, bh)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, W / 2, by + bh / 2)
}

/* --------------------------------- video ---------------------------------- */

// Render the campaign replay to a video Blob.
// Returns { promise: Promise<{ blob, ext }>, cancel() }.
// onProgress (0..1) reflects wall-clock progress through the recording.
export function exportCampaignReplay({ territory, frames: campaignFrames, onProgress }) {
  let cancelled = false
  let stopLoop = () => {}

  const promise = (async () => {
    const mime = pickMime()
    if (!mime) throw new Error('This browser cannot record video (MediaRecorder unsupported).')
    const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'

    const { cols, rows, showRHQ } = territory
    const frames = frameCells(campaignFrames)
    const captions = frameCaptions(campaignFrames)
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
    const base = renderBaseMap(img, W, H)
    let hatch = renderHatch(frames[0], cols, rows, showRHQ, W, H)
    const commitHatch = (cells) => { hatch = renderHatch(cells, cols, rows, showRHQ, W, H) }

    // Everything painted onto the canvas for one instant of the replay. Split
    // out of the loop so the FIRST frame can be drawn before the recorder
    // starts — captureStream on a canvas that has never been painted can hand
    // the encoder an empty track, which is one way this used to produce a
    // 0-byte file.
    // The map key is fixed for the whole video; company label placements are
    // derived from the grid and so only change once per committed frame —
    // cached on the cell string so the per-tick cost stays "draw", not
    // "re-derive" (several passes over ~24k cells; redoing that at 30 fps
    // would drop frames).
    const codes = legendCodes({ showRHQ })
    let derived = { cells: null, labels: [] }
    const labelsFor = (cells) => {
      if (derived.cells !== cells) derived = { cells, labels: companyLabelPoints(cells, cols, rows, { showRHQ }) }
      return derived.labels
    }

    const paintFrame = (cells, plan, waveT, caption) => {
      ctx.clearRect(0, 0, W, H)
      ctx.drawImage(base, 0, 0)
      ctx.drawImage(hatch, 0, 0)
      if (plan && waveT !== null) {
        renderWaveLayer(ctx, plan, waveT, { cols, rows, w: W, h: H })
        drawFlashes(ctx, plan, flashAlphaAt(waveT), cols, rows, W, H, SCALE)
      }
      drawCompanyLabels(ctx, labelsFor(cells), { cols, rows, w: W, h: H, scale: SCALE })
      drawPlaces(ctx, { ...territory, cells }, cols, rows, W, H, SCALE)
      drawLegend(ctx, codes, { w: W, h: H, scale: SCALE }) // top-left; the caption banner owns the bottom
      if (caption) drawBanner(ctx, caption, W, H, SCALE)
    }
    paintFrame(frames[0], null, null, '')

    const stream = canvas.captureStream(FPS)
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: VIDEO_BITRATE })
    const chunks = []
    let recorderError = null
    recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data) }
    recorder.onerror = (e) => { recorderError = e?.error?.message || e?.message || 'The recorder failed mid-export.' }
    const recorded = new Promise((resolve) => { recorder.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] })) })

    // A backgrounded/minimised tab stops requestAnimationFrame, so the canvas
    // freezes while the recorder keeps running — that's what produced the
    // intermittent empty/short files. Pausing the recorder alongside the loop
    // turns "switched tabs" into "the export takes longer" instead.
    let hiddenMs = 0
    let hiddenAt = 0
    let wasBackgrounded = false
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = performance.now()
        wasBackgrounded = true
        try { if (recorder.state === 'recording') recorder.pause() } catch { /* not pausable */ }
      } else if (hiddenAt) {
        hiddenMs += performance.now() - hiddenAt
        hiddenAt = 0
        try { if (recorder.state === 'paused') recorder.resume() } catch { /* ignore */ }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Real-time playback drives the recording (MediaRecorder captures the
    // canvas as a live stream, so the export takes as long as the replay).
    try {
      await new Promise((resolve, reject) => {
        let raf = 0
        let committed = 0 // index of the frame currently baked into `hatch`
        let plan = null
        let planK = -1
        const t0 = performance.now()
        const finish = () => {
          try { if (recorder.state !== 'inactive') { recorder.requestData(); recorder.stop() } } catch { /* already stopped */ }
        }
        recorder.start(1000)

        stopLoop = () => {
          cancelAnimationFrame(raf)
          finish()
          reject(Object.assign(new Error('Export cancelled.'), { cancelled: true }))
        }

        const tick = (now) => {
          if (recorderError) {
            cancelAnimationFrame(raf)
            finish()
            reject(new Error(`Video recording failed: ${recorderError}`))
            return
          }
          // Time spent with the tab hidden doesn't advance the replay — the
          // canvas wasn't being painted during it.
          const elapsed = now - t0 - hiddenMs - (hiddenAt ? now - hiddenAt : 0)
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

          paintFrame(frames[committed], plan, waveT, k >= 0 ? (captions[k] || '') : '')

          if (elapsed >= totalMs) {
            finish()
            resolve()
            return
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      })
    } finally {
      document.removeEventListener('visibilitychange', onVisibility)
    }

    if (cancelled) throw Object.assign(new Error('Export cancelled.'), { cancelled: true })
    const blob = await recorded
    if (!blob.size) {
      throw new Error(wasBackgrounded
        ? 'The recording came out empty — the tab was in the background while it rendered. Keep this tab visible and on screen for the whole export and try again.'
        : 'The recording came out empty. Try again, and keep this tab visible and on screen while it renders.')
    }
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

/* ------------------------------ still image -------------------------------- */

// Default headline for the weekly image. Exposed so the ops panel can seed
// its editable title field with exactly what the render would have used.
export function defaultProgressTitle({ frames: campaignFrames, days = 7 } = {}) {
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  const sorted = sortFrames(campaignFrames || [])
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const first = sorted.find((f) => f.ts >= cutoff)
  return `PROGRESS UPDATE — ${fmt(first ? first.ts : cutoff)} TO ${fmt(Date.now())}`
}

// Render a still "progress update" image: the current map state, with place
// names, and the last `days` worth of gains highlighted as a settled wave
// overlay — a single shareable "what we achieved this week" snapshot, not a
// full campaign recap.
//
// Two things this gets deliberately right, because both were wrong before:
//
//  - THE WINDOW. "Before" is the map as it stood when the window opened: the
//    last frame recorded BEFORE the cutoff, or the campaign's own start frame
//    if the campaign itself is younger than the window. It used to fall back
//    to a BLANK map in that second case — which is the normal case for a young
//    campaign — so every held cell on the map counted as a gain and every
//    frame's progress lit up at once. Nothing before the campaign start is
//    ever highlighted now.
//  - THE LABELS. One name per company (mergedGainLabels), placed on that
//    company's combined gains, instead of the video's per-cluster conquest
//    flashes. A week's worth of frames is dozens of small clusters, and
//    labelling each one stacked the same handful of names across the map.
//
// `title` overrides the generated headline (the ops panel lets RHQ edit it).
// Returns { blob }. Throws if there's no campaign, or nothing was recorded
// within the window — callers should disable the button in that case rather
// than let this throw.
export async function exportProgressImage({ territory, frames: campaignFrames, days = 7, title }) {
  const { cols, rows, showRHQ } = territory
  const sorted = sortFrames(campaignFrames || [])
  if (!sorted.length) throw new Error('No campaign frames recorded yet.')

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const recentIdx = sorted.findIndex((f) => f.ts >= cutoff)
  if (recentIdx === -1) throw new Error(`No frames recorded in the last ${days} days.`)

  const cells = frameCells(campaignFrames)
  const finalCells = territory.cells // the live/published state — may be ahead of the last recorded frame
  const beforeCells = cells[Math.max(0, recentIdx - 1)]
  const plan = transitionPlan(beforeCells, finalCells, cols, rows)

  const img = await loadImage(MAP_IMAGE)
  const W = MAP_PIXEL_WIDTH * SCALE
  const H = MAP_PIXEL_HEIGHT * SCALE
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false

  ctx.drawImage(renderBaseMap(img, W, H), 0, 0)
  ctx.drawImage(renderHatch(finalCells, cols, rows, showRHQ, W, H), 0, 0)
  if (plan.clusters.length) renderWaveLayer(ctx, plan, 1, { cols, rows, w: W, h: H })
  drawCompanyLabels(ctx, companyLabelPoints(finalCells, cols, rows, { showRHQ }), { cols, rows, w: W, h: H, scale: SCALE })
  // Who gained ground this week, named once each, drawn a touch larger than
  // the standing company labels so the week's story reads first.
  drawCompanyLabels(ctx, mergedGainLabels(plan, cols, rows), { cols, rows, w: W, h: H, scale: SCALE * 1.25 })
  drawPlaces(ctx, { ...territory, cells: finalCells }, cols, rows, W, H, SCALE)
  drawLegend(ctx, legendCodes({ showRHQ }), { w: W, h: H, scale: SCALE, bottom: true }) // banner owns the top

  drawBanner(ctx, title?.trim() || defaultProgressTitle({ frames: campaignFrames, days }), W, H, SCALE, { top: true })

  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image render failed.'))), 'image/png'))
  return { blob }
}

// Hand a finished export (video or image) to the browser's downloader.
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
