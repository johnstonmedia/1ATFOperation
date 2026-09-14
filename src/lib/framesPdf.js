// Print the campaign as a PDF: one page per released frame, plus a key.
//
// WHY THIS EXISTS. The replay is a web animation and the weekly export is a
// single still; neither is what you pin to a wall at camp, where the audience
// is standing in front of a board rather than holding a phone. This prints the
// whole sequence — camp start plus one page per camp day — so the progression
// can be read side by side on paper.
//
// NO PDF LIBRARY. A PDF whose pages are each one full-page JPEG is a small,
// well-specified file: catalog → pages → per page a content stream drawing one
// image XObject with DCTDecode (i.e. the JPEG bytes verbatim, no re-encoding).
// That is ~80 lines here against ~300 KB of dependency, and it reuses the
// canvas renderers the video and the still already share, so a printed page
// cannot drift from what the screen draws. The cost is that the text is part
// of the image rather than selectable — acceptable for a wall poster, and the
// reason everything is rendered at print resolution rather than screen.
import { mapFor } from './maps'
import { renderTerritoryLayer, renderHatchSwatch, imageFilterFor } from './terrainRender'
import { drawMapLines } from './mapLines'
import { drawMapZones, ZONE_STYLE, ZONE_TEXTURE, KIND_ORDER } from './mapZones'
import { sortFrames } from './campaign'
import { coyLabelOf, colorOf, TASKFORCE_CODE, SCU_LABEL } from './territory'
import { renderPrintBase } from './replayExport'

// A4 landscape at 150 dpi. Enough for a sharp A4 print and an A3 enlargement
// at arm's length, without making a 5-page file enormous.
const PAGE_W = 1754
const PAGE_H = 1240
const MARGIN = 54
const JPEG_QUALITY = 0.93
// The map panel is rendered at this multiple of its printed size and drawn
// down. 150 dpi is fine for text, but satellite imagery on paper wants the
// extra sampling: at 2x the crop comes off a deeper tile level and lands on
// the page already resolved, rather than being upscaled into it.
const SUPERSAMPLE = 2

const INK = '#d7e2f4'
const DIM = '#8294b5'
const ACCENT = '#36e0c0'
const GROUND = '#070b14'

/* ------------------------------- PDF writer ------------------------------- */

// Minimal single-image-per-page PDF. `jpegs` are Uint8Arrays of JPEG data,
// all PAGE_W x PAGE_H.
function buildPdf(jpegs) {
  const chunks = []
  let len = 0
  const push = (bytes) => { chunks.push(bytes); len += bytes.length }
  const text = (s) => push(new TextEncoder().encode(s))
  const offsets = []
  // Object numbering: 1 catalog, 2 pages, then per page a page object, a
  // content stream and an image.
  const n = jpegs.length
  const obj = (i) => { offsets[i] = len }

  text('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')

  obj(1)
  text(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`)

  obj(2)
  const kids = Array.from({ length: n }, (_, i) => `${3 + i * 3} 0 R`).join(' ')
  text(`2 0 obj\n<< /Type /Pages /Count ${n} /Kids [${kids}] >>\nendobj\n`)

  for (let i = 0; i < n; i++) {
    const page = 3 + i * 3
    const content = page + 1
    const image = page + 2
    obj(page)
    text(`${page} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] `
       + `/Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${content} 0 R >>\nendobj\n`)

    // Draw the image over the whole page. `q … Q` brackets the transform so
    // each page's content stream is self-contained.
    const stream = `q\n${PAGE_W} 0 0 ${PAGE_H} 0 0 cm\n/Im0 Do\nQ\n`
    obj(content)
    text(`${content} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`)

    const jpg = jpegs[i]
    obj(image)
    text(`${image} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${PAGE_W} /Height ${PAGE_H} `
       + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`)
    push(jpg)
    text('\nendstream\nendobj\n')
  }

  const xref = len
  const total = 2 + n * 3
  text(`xref\n0 ${total + 1}\n0000000000 65535 f \n`)
  for (let i = 1; i <= total; i++) text(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`)
  text(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)

  const out = new Uint8Array(len)
  let at = 0
  for (const c of chunks) { out.set(c, at); at += c.length }
  return new Blob([out], { type: 'application/pdf' })
}

async function canvasJpeg(canvas) {
  const blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('Page render failed.'))), 'image/jpeg', JPEG_QUALITY))
  return new Uint8Array(await blob.arrayBuffer())
}

/* --------------------------------- layout --------------------------------- */

function textLine(ctx, s, x, y, { size = 20, font = 'Orbitron, sans-serif', color = INK, weight = 700, spacing = 0, align = 'left' } = {}) {
  ctx.save()
  ctx.font = `${weight} ${size}px ${font}`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  if (spacing) {
    // Canvas has no letter-spacing in every browser this has to run in, so
    // wide tracking — which the portal's headings rely on — is drawn per glyph.
    let cx = x
    const w = [...s].reduce((a, ch) => a + ctx.measureText(ch).width + spacing, 0) - spacing
    if (align === 'right') cx = x - w
    if (align === 'center') cx = x - w / 2
    ctx.textAlign = 'left'
    for (const ch of s) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing }
  } else {
    ctx.fillText(s, x, y)
  }
  ctx.restore()
}

// The key, down the right-hand column: what the hatch means, what the zone
// outlines mean, and the boundary lines. Printed on every page deliberately —
// a sheet pulled off the wall on its own still has to be readable.
function drawKey(ctx, x, y, w, { map, progress, showRHQ }) {
  let cy = y
  textLine(ctx, 'MAP KEY', x, cy, { size: 16, spacing: 3, color: ACCENT })
  cy += 26

  const swatch = (code, label, note) => {
    const sw = 40, sh = 20
    const cv = document.createElement('canvas')
    cv.width = sw * 2; cv.height = sh * 2
    renderHatchSwatch(cv.getContext('2d'), code, cv.width, cv.height)
    ctx.drawImage(cv, x, cy - sh + 4, sw, sh)
    textLine(ctx, label, x + sw + 12, cy, { size: 15, font: 'JetBrains Mono, monospace', spacing: 1 })
    if (note) { cy += 17; textLine(ctx, note, x + sw + 12, cy, { size: 12, font: 'Rajdhani, sans-serif', color: DIM, weight: 500 }) }
    cy += 30
  }

  swatch(TASKFORCE_CODE.toLowerCase(), `${SCU_LABEL} — TAKING`, 'part of the area taken so far')
  swatch(TASKFORCE_CODE, `${SCU_LABEL} — TAKEN`, 'every scheduled visit complete')
  if (showRHQ) swatch('R', 'RHQ', 'Ex Admin Area — held throughout')

  cy += 8
  textLine(ctx, 'AREAS', x, cy, { size: 16, spacing: 3, color: ACCENT })
  cy += 24
  for (const kind of KIND_ORDER) {
    const st = ZONE_STYLE[kind]
    const tex = ZONE_TEXTURE[kind]
    if (!st || !tex) continue
    ctx.save()
    ctx.strokeStyle = st.color
    ctx.lineWidth = 2
    ctx.setLineDash(tex.dash ? tex.dash.map((d) => d * 2.2) : [])
    ctx.strokeRect(x + 1, cy - 15, 38, 18)
    ctx.restore()
    textLine(ctx, `${tex.glyph}  ${st.label.toUpperCase()}`, x + 52, cy, { size: 14, font: 'JetBrains Mono, monospace', spacing: 0.6, color: st.color })
    cy += 28
  }

  if (progress) {
    cy += 4
    textLine(ctx, 'An area is taken a visit at a time. "2/13" means two of the',
      x, cy, { size: 13, font: 'Rajdhani, sans-serif', color: DIM, weight: 500 }); cy += 18
    textLine(ctx, 'thirteen visits the plan schedules there have happened — and',
      x, cy, { size: 13, font: 'Rajdhani, sans-serif', color: DIM, weight: 500 }); cy += 18
    textLine(ctx, 'two thirteenths of its ground is painted. No company holds an',
      x, cy, { size: 13, font: 'Rajdhani, sans-serif', color: DIM, weight: 500 }); cy += 18
    textLine(ctx, 'area: the ground is 1ATF’s from the first pixel.',
      x, cy, { size: 13, font: 'Rajdhani, sans-serif', color: DIM, weight: 500 }); cy += 26
  }

  cy += 4
  textLine(ctx, 'BOUNDARIES', x, cy, { size: 16, spacing: 3, color: ACCENT })
  cy += 24
  for (const line of map.artKey || []) {
    ctx.save()
    ctx.strokeStyle = line.color
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(x, cy - 6); ctx.lineTo(x + 38, cy - 6); ctx.stroke()
    ctx.restore()
    // Both boundary rows are "Area boundary — …", so the DISTINGUISHING half
    // has to lead; heading them both with the common part made the key say the
    // same thing twice.
    const parts = String(line.label).split(' — ')
    const head = (parts.length > 1 ? parts.slice(1).join(' — ') : parts[0]).toUpperCase()
    textLine(ctx, head, x + 52, cy, { size: 13, font: 'JetBrains Mono, monospace', spacing: 0.5 })
    cy += 16
    textLine(ctx, parts.length > 1 ? parts[0] : '', x + 52, cy, { size: 12, font: 'Rajdhani, sans-serif', color: DIM, weight: 500 })
    cy += 26
  }
  return cy
}

// How far through the plan this sheet is, totalled off the same per-zone
// counts the map is drawn from — so the headline figure can't disagree with
// the ground. Omitted entirely on a hand-painted frame, which has no plan
// behind it to total.
function drawSummary(ctx, x, y, w, progress) {
  if (!progress || !progress.size) return
  let done = 0, total = 0, complete = 0
  for (const [, p] of progress) { done += p.done; total += p.total; if (p.complete) complete += 1 }
  if (!total) return
  const pct = Math.round((done / total) * 100)

  textLine(ctx, 'PROGRESS', x, y, { size: 16, spacing: 3, color: ACCENT })
  let cy = y + 40
  textLine(ctx, `${pct}%`, x, cy, { size: 44, color: '#fff' })
  textLine(ctx, `${done} of ${total} scheduled visits`, x + 130, cy - 20,
    { size: 15, font: 'JetBrains Mono, monospace', spacing: 0.6 })
  textLine(ctx, `${complete} of ${progress.size} areas fully taken`, x + 130, cy,
    { size: 15, font: 'JetBrains Mono, monospace', spacing: 0.6, color: DIM })

  // A plain bar of the same hatch the map uses, so the number and the ground
  // are stated in one language.
  cy += 34
  const barH = 22
  ctx.save()
  ctx.strokeStyle = 'rgba(99,130,190,0.35)'
  ctx.strokeRect(x + 0.5, cy + 0.5, w - 1, barH)
  const filled = Math.round((w - 2) * (done / total))
  if (filled > 0) {
    const cv = document.createElement('canvas')
    cv.width = Math.max(1, filled * 2); cv.height = barH * 2
    renderHatchSwatch(cv.getContext('2d'), TASKFORCE_CODE, cv.width, cv.height)
    ctx.drawImage(cv, x + 1, cy + 1, filled, barH - 1)
  }
  ctx.restore()
}

/* ---------------------------------- pages --------------------------------- */

export function framesPdfSupported() {
  return typeof document !== 'undefined' && !!document.createElement('canvas').toBlob
}

/**
 * One PDF, one page per frame handed in.
 *
 * `progressFor(i)` is the zoneProgress Map for frame i (so a page's zone
 * counts are that frame's camp day, not today's), `zones` the visible zones,
 * and `title` an optional override for the document heading.
 */
export async function exportFramesPdf({ territory, frames: campaignFrames, zones = [], progressFor = null, title }) {
  const frames = sortFrames(campaignFrames || [])
  if (!frames.length) throw new Error('No campaign frames to print yet.')
  const map = mapFor(territory)
  const { cols, rows, showRHQ } = territory

  // The printed map shows what the screen shows: a map that opens on a focus
  // box is cropped to it here too, rather than printing ground the portal
  // deliberately frames out.
  const f = map.focus || { x0: 0, y0: 0, x1: cols, y1: rows }
  const cropW = Math.max(1, f.x1 - f.x0)
  const cropH = Math.max(1, f.y1 - f.y0)

  // Map panel on the left, key column on the right.
  const keyW = 380
  const panelW = PAGE_W - MARGIN * 2 - keyW - 28
  const headH = 104
  const panelH = PAGE_H - MARGIN * 2 - headH
  const drawW = Math.min(panelW, (panelH * cropW) / cropH)
  const drawH = drawW * (cropH / cropW)

  // Render the whole map once at the resolution the crop needs, then take the
  // focus rectangle out of it — the renderers all work in full-grid
  // coordinates, so cropping at the end keeps every one of them unchanged.
  const fullW = Math.round((drawW * SUPERSAMPLE * cols) / cropW)
  const fullH = Math.round((drawH * SUPERSAMPLE * rows) / cropH)
  // ⚠️ Tiles are fetched for the FOCUS REGION ONLY. The page crops to that box,
  // so tiles covering the rest of the frame would be downloaded and then thrown
  // away — and, because the tile budget is what picks the zoom level, paying
  // for them costs two levels of detail in the part that actually prints. The
  // static art still covers the whole frame underneath, so nothing is missing
  // if a visitor ever zooms out of a page. This is the difference between the
  // print showing the 10 m Sentinel floor and showing real imagery.
  const region = { x0: f.x0 / cols, x1: f.x1 / cols, y0: f.y0 / rows, y1: f.y1 / rows }
  const base = await renderPrintBase(map, fullW, fullH, { region })

  const jpegs = []
  for (let i = 0; i < frames.length; i++) {
    const fr = frames[i]
    const progress = progressFor ? progressFor(i) : null

    const full = document.createElement('canvas')
    full.width = fullW; full.height = fullH
    const fc = full.getContext('2d')
    fc.drawImage(base, 0, 0)
    drawMapZones(fc, zones, { cols, rows, w: fullW, h: fullH, scale: fullW / map.pixelWidth, progress })
    const hatch = document.createElement('canvas')
    hatch.width = fullW; hatch.height = fullH
    renderTerritoryLayer(hatch.getContext('2d'), { cells: fr.cells, cols, rows, showRHQ, w: fullW, h: fullH })
    fc.drawImage(hatch, 0, 0)

    const page = document.createElement('canvas')
    page.width = PAGE_W; page.height = PAGE_H
    const ctx = page.getContext('2d')
    ctx.fillStyle = GROUND
    ctx.fillRect(0, 0, PAGE_W, PAGE_H)

    // Heading
    textLine(ctx, '1ATF', MARGIN, MARGIN + 40, { size: 44, spacing: 4 })
    textLine(ctx, '1st Australian Task Force', MARGIN + 150, MARGIN + 38, { size: 22, color: DIM, weight: 600, font: 'Rajdhani, sans-serif' })
    const heading = (title || fr.label || `FRAME ${i + 1}`).toUpperCase()
    textLine(ctx, heading, MARGIN, MARGIN + 78, { size: 24, spacing: 3, color: ACCENT })
    const count = `SHEET ${i + 1} OF ${frames.length}`
    textLine(ctx, count, PAGE_W - MARGIN, MARGIN + 40, { size: 15, spacing: 2, color: DIM, align: 'right', font: 'JetBrains Mono, monospace' })
    if (map.focus?.label) {
      textLine(ctx, `${map.focus.label} — AREA OF OPERATIONS`, PAGE_W - MARGIN, MARGIN + 70,
        { size: 14, spacing: 1.6, color: '#ffd23c', align: 'right', font: 'JetBrains Mono, monospace' })
    }
    ctx.fillStyle = 'rgba(54,224,192,0.55)'
    ctx.fillRect(MARGIN, MARGIN + 92, PAGE_W - MARGIN * 2, 2)

    // Map panel — the focus rectangle out of the full render.
    const px = MARGIN
    const py = MARGIN + headH
    ctx.save()
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(full,
      (f.x0 / cols) * fullW, (f.y0 / rows) * fullH, (cropW / cols) * fullW, (cropH / rows) * fullH,
      px, py, drawW, drawH)
    ctx.restore()
    ctx.strokeStyle = 'rgba(99,130,190,0.35)'
    ctx.lineWidth = 1
    ctx.strokeRect(px + 0.5, py + 0.5, drawW - 1, drawH - 1)

    const keyEnd = drawKey(ctx, px + drawW + 28, py + 24, keyW, { map, progress, showRHQ })
    drawSummary(ctx, px + drawW + 28, keyEnd + 18, keyW, progress)

    textLine(ctx, 'LUCET PER MINISTERIUM', MARGIN, PAGE_H - MARGIN + 18,
      { size: 12, spacing: 2, color: DIM, font: 'JetBrains Mono, monospace' })
    if (map.tiles?.attribution) {
      textLine(ctx, map.tiles.attribution, PAGE_W - MARGIN, PAGE_H - MARGIN + 18,
        { size: 11, color: DIM, weight: 500, align: 'right', font: 'Rajdhani, sans-serif' })
    }

    jpegs.push(await canvasJpeg(page))
  }
  return { blob: buildPdf(jpegs), pages: frames.length }
}
