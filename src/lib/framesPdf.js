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
import { ASSURE_BLUE as TASKFORCE_COLOR } from './territory'
import { sortFrames } from './campaign'
import { TASKFORCE_CODE, SCU_LABEL } from './territory'
import { COMPANIES } from '../firebase/seed'

const COMPANY_COLOR = COMPANIES.reduce((a, c) => ({ ...a, [c.letter]: c.accent }), {})
import { renderPrintBase } from './replayExport'

// ⚠️ A3 LANDSCAPE at 150 dpi — these are wall sheets, read from across a room
// at camp, not handouts. Everything below is sized for that: the map takes as
// much of the page as its shape allows and the chrome is one header line plus
// the key, because a page that spends its area on framing is a page whose map
// is too small to read standing up.
const PAGE_W = 2480
const PAGE_H = 1754
const MARGIN = 46
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
// What was taken on THIS sheet's day, as opposed to ground already held.
const GAIN = '#ffd23c'

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
  textLine(ctx, 'MAP KEY', x, cy, { size: 20, spacing: 3, color: ACCENT })
  cy += 26

  const swatch = (code, label, note) => {
    const sw = 44, sh = 24
    const cv = document.createElement('canvas')
    cv.width = sw * 2; cv.height = sh * 2
    renderHatchSwatch(cv.getContext('2d'), code, cv.width, cv.height)
    ctx.drawImage(cv, x, cy - sh + 4, sw, sh)
    textLine(ctx, label, x + sw + 12, cy, { size: 19, font: 'JetBrains Mono, monospace', spacing: 1 })
    if (note) { cy += 17; textLine(ctx, note, x + sw + 12, cy, { size: 12, font: 'Rajdhani, sans-serif', color: DIM, weight: 500 }) }
    cy += 30
  }

  swatch(TASKFORCE_CODE.toLowerCase(), `${SCU_LABEL} — TAKING`, 'part of the area taken so far')
  swatch(TASKFORCE_CODE, `${SCU_LABEL} — TAKEN`, 'every scheduled visit complete')
  if (showRHQ) swatch('R', 'RHQ', 'Ex Admin Area — held throughout')

  // The one thing a sheet says that the sheet before it did not.
  ctx.save()
  ctx.strokeStyle = GAIN
  ctx.lineWidth = 3
  ctx.strokeRect(x + 1, cy - 20, 44, 24)
  ctx.fillStyle = GAIN
  ctx.globalAlpha = 0.22
  ctx.fillRect(x + 1, cy - 20, 44, 24)
  ctx.restore()
  textLine(ctx, 'TAKEN TODAY', x + 58, cy, { size: 19, font: 'JetBrains Mono, monospace', spacing: 1, color: GAIN })
  cy += 21
  textLine(ctx, 'ground this day added to the map', x + 58, cy, { size: 15, font: 'Rajdhani, sans-serif', color: DIM, weight: 500 })
  cy += 38

  cy += 8
  textLine(ctx, 'AREAS', x, cy, { size: 20, spacing: 3, color: ACCENT })
  cy += 24
  for (const kind of KIND_ORDER) {
    const st = ZONE_STYLE[kind]
    const tex = ZONE_TEXTURE[kind]
    if (!st || !tex) continue
    ctx.save()
    ctx.strokeStyle = st.color
    ctx.lineWidth = 2
    ctx.setLineDash(tex.dash ? tex.dash.map((d) => d * 2.2) : [])
    ctx.strokeRect(x + 1, cy - 18, 44, 22)
    ctx.restore()
    textLine(ctx, `${tex.glyph}  ${st.label.toUpperCase()}`, x + 58, cy, { size: 18, font: 'JetBrains Mono, monospace', spacing: 0.6, color: st.color })
    cy += 34
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
  textLine(ctx, 'BOUNDARIES', x, cy, { size: 20, spacing: 3, color: ACCENT })
  cy += 24
  for (const line of map.artKey || []) {
    ctx.save()
    ctx.strokeStyle = line.color
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(x, cy - 7); ctx.lineTo(x + 44, cy - 7); ctx.stroke()
    ctx.restore()
    // Both boundary rows are "Area boundary — …", so the DISTINGUISHING half
    // has to lead; heading them both with the common part made the key say the
    // same thing twice.
    const parts = String(line.label).split(' — ')
    const head = (parts.length > 1 ? parts.slice(1).join(' — ') : parts[0]).toUpperCase()
    textLine(ctx, head, x + 58, cy, { size: 17, font: 'JetBrains Mono, monospace', spacing: 0.5 })
    cy += 20
    textLine(ctx, parts.length > 1 ? parts[0] : '', x + 58, cy, { size: 15, font: 'Rajdhani, sans-serif', color: DIM, weight: 500 })
    cy += 32
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

  textLine(ctx, 'PROGRESS', x, y, { size: 20, spacing: 3, color: ACCENT })
  let cy = y + 54
  textLine(ctx, `${pct}%`, x, cy, { size: 62, color: '#fff' })
  textLine(ctx, `${done} of ${total} scheduled visits`, x + 190, cy - 26,
    { size: 19, font: 'JetBrains Mono, monospace', spacing: 0.6 })
  textLine(ctx, `${complete} of ${progress.size} areas fully taken`, x + 190, cy,
    { size: 19, font: 'JetBrains Mono, monospace', spacing: 0.6, color: DIM })

  // A plain bar of the same hatch the map uses, so the number and the ground
  // are stated in one language.
  cy += 40
  const barH = 28
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

// Outline every cell taken between two frames. Drawn as the OUTER EDGE of the
// gained region rather than a fill: a fill would hide the hatch underneath and
// the sheet would stop saying who holds the ground, which is the thing the
// outline is annotating.
function drawGains(ctx, prevCells, cells, cols, rows, w, h) {
  if (!prevCells || prevCells.length !== cells.length) return
  const cw = w / cols
  const ch = h / rows
  const gained = (i) => i >= 0 && i < cells.length
    && cells[i] !== '.' && prevCells[i] === '.'
  ctx.save()
  // A soft wash first so the region reads at a glance from across the room...
  ctx.fillStyle = GAIN
  ctx.globalAlpha = 0.18
  for (let i = 0; i < cells.length; i++) {
    if (!gained(i)) continue
    ctx.fillRect((i % cols) * cw, Math.floor(i / cols) * ch, cw + 0.5, ch + 0.5)
  }
  // ...then the edge, which is what actually delineates it in print.
  ctx.globalAlpha = 1
  ctx.strokeStyle = GAIN
  ctx.lineWidth = Math.max(1.5, cw * 0.5)
  ctx.beginPath()
  for (let i = 0; i < cells.length; i++) {
    if (!gained(i)) continue
    const x = i % cols, y = Math.floor(i / cols)
    const px = x * cw, py = y * ch
    if (y === 0 || !gained(i - cols)) { ctx.moveTo(px, py); ctx.lineTo(px + cw, py) }
    if (y === rows - 1 || !gained(i + cols)) { ctx.moveTo(px, py + ch); ctx.lineTo(px + cw, py + ch) }
    if (x === 0 || !gained(i - 1)) { ctx.moveTo(px, py); ctx.lineTo(px, py + ch) }
    if (x === cols - 1 || !gained(i + 1)) { ctx.moveTo(px + cw, py); ctx.lineTo(px + cw, py + ch) }
  }
  ctx.stroke()
  ctx.restore()
}

// The area table: the map's numbered badges spelled out. Number, name, visits
// done of scheduled, and the letters of the companies through it so far.
//
// A row whose count moved SINCE THE PREVIOUS SHEET is marked, so a reader can
// see what changed today without comparing two pages side by side — the same
// question the gain outlines answer on the map.
function drawAreaTable(ctx, x, y, w, listed, numbered, progress, prevProgress) {
  if (!progress || !listed.length) return y
  textLine(ctx, 'AREAS — VISITS DONE / SCHEDULED', x, y, { size: 20, spacing: 3, color: ACCENT })
  let cy = y + 30
  const rowH = 25
  const colW = w / 2
  listed.forEach((z, k) => {
    const p = progress.get(z.id)
    if (!p) return
    const col = k < Math.ceil(listed.length / 2) ? 0 : 1
    const row = col === 0 ? k : k - Math.ceil(listed.length / 2)
    const rx = x + col * colW
    const ry = cy + row * rowH
    const st = ZONE_STYLE[z.kind] || ZONE_STYLE.activity
    const prev = prevProgress?.get(z.id)
    const moved = prev && p.done > prev.done

    if (moved) {
      ctx.save()
      ctx.fillStyle = GAIN
      ctx.globalAlpha = 0.16
      ctx.fillRect(rx - 4, ry - 17, colW - 12, rowH - 3)
      ctx.restore()
    }
    textLine(ctx, String(numbered.get(z.id)).padStart(2, ' '), rx, ry,
      { size: 16, font: 'JetBrains Mono, monospace', color: st.color })
    textLine(ctx, z.name.toUpperCase(), rx + 34, ry,
      { size: 16, font: 'JetBrains Mono, monospace', spacing: 0.3, color: p.complete ? '#fff' : INK })
    // Count and companies right-aligned, so the eye can run down them.
    const who = (p.visited || [])
    let tx = rx + colW - 22
    for (let j = who.length - 1; j >= 0; j--) {
      textLine(ctx, who[j], tx, ry, { size: 16, font: 'JetBrains Mono, monospace', color: COMPANY_COLOR[who[j]] || INK, align: 'right' })
      tx -= 15
    }
    textLine(ctx, `${p.done}/${p.total}`, tx - 4, ry,
      { size: 16, font: 'JetBrains Mono, monospace', color: p.complete ? TASKFORCE_COLOR : INK, align: 'right' })
  })
  return cy + Math.ceil(listed.length / 2) * rowH + 8
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

  // ⚠️ THE MAP BLEEDS TO THE PAGE EDGE — no margin, no panel border, no gap.
  // It is the document; everything else is annotation printed beside it. A
  // framed map on a wall sheet wastes the millimetres that decide whether an
  // area is legible from across a room, and a border draws the eye to the
  // boundary of the paper instead of to the ground.
  const headH = 68
  const panelH = PAGE_H - headH // full bleed: left, bottom and top of the panel
  const maxMapW = PAGE_W - 360 - 26
  const keyW = PAGE_W - Math.min(maxMapW, (panelH * cropW) / cropH) - 26 - MARGIN
  const drawW = Math.min(maxMapW, (panelH * cropW) / cropH)
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
  // Areas are NUMBERED for print, in reading order down the sheet, and the
  // numbers are the same on every page so the five sheets can be compared
  // area by area without re-reading the table each time.
  const numbered = new Map()
  const listed = zones
    .filter((z) => (progressFor ? progressFor(frames.length - 1)?.has(z.id) : true))
    .sort((a, b) => (a.label[1] - b.label[1]) || (a.label[0] - b.label[0]))
  listed.forEach((z, k) => numbered.set(z.id, k + 1))

  const region = { x0: f.x0 / cols, x1: f.x1 / cols, y0: f.y0 / rows, y1: f.y1 / rows }
  // Reported back to the caller so the Ops Centre can say whether the print
  // actually got the satellite imagery — see the CORS note in replayExport.js.
  let tileStatus = map.tiles ? { tiled: false, drawn: 0, total: 0 } : null
  const base = await renderPrintBase(map, fullW, fullH, {
    region, onStatus: (st) => { tileStatus = st },
  })

  const jpegs = []
  for (let i = 0; i < frames.length; i++) {
    const fr = frames[i]
    const progress = progressFor ? progressFor(i) : null

    const full = document.createElement('canvas')
    full.width = fullW; full.height = fullH
    const fc = full.getContext('2d')
    fc.drawImage(base, 0, 0)
    // ⚠️ `zoneScale` enlarges the zone type for print. On screen a name sits
    // beside a zone you can zoom into; on a wall sheet it has to be legible at
    // two metres with no zoom at all, and the default size — tuned for a
    // ~700px on-screen map — lands under 3 mm on A3.
    drawMapZones(fc, zones, { cols, rows, w: fullW, h: fullH, scale: fullW / map.pixelWidth, progress, zoneScale: 1.5, numbered })
    const hatch = document.createElement('canvas')
    hatch.width = fullW; hatch.height = fullH
    renderTerritoryLayer(hatch.getContext('2d'), { cells: fr.cells, cols, rows, showRHQ, w: fullW, h: fullH })
    fc.drawImage(hatch, 0, 0)

    // WHAT CHANGED TODAY. A sheet that only shows the cumulative position
    // makes five pages that look nearly alike; the question a wall of them has
    // to answer is "what did we take yesterday". Ground that is held on this
    // frame and was not on the one before is outlined in the gain colour, over
    // the ordinary hatch — so the sheet reads as position first, then progress.
    if (i > 0) drawGains(fc, frames[i - 1].cells, fr.cells, cols, rows, fullW, fullH)

    const page = document.createElement('canvas')
    page.width = PAGE_W; page.height = PAGE_H
    const ctx = page.getContext('2d')
    ctx.fillStyle = GROUND
    ctx.fillRect(0, 0, PAGE_W, PAGE_H)

    // ONE header line. Unit, then what day this sheet is, then where — the
    // three things someone walking up to the wall needs before the map.
    textLine(ctx, '1ATF', 26, 46, { size: 44, spacing: 4 })
    const heading = (title || fr.label || `FRAME ${i + 1}`).toUpperCase()
    textLine(ctx, heading, 190, 44, { size: 29, spacing: 3, color: ACCENT })
    textLine(ctx, `SHEET ${i + 1} OF ${frames.length}`, PAGE_W - MARGIN, 24,
      { size: 16, spacing: 2, color: DIM, align: 'right', font: 'JetBrains Mono, monospace' })
    if (map.focus?.label) {
      textLine(ctx, `${map.focus.label} — AREA OF OPERATIONS`, PAGE_W - MARGIN, 48,
        { size: 17, spacing: 1.8, color: GAIN, align: 'right', font: 'JetBrains Mono, monospace' })
    }

    // Map panel — the focus rectangle out of the full render, hard against the
    // left and bottom edges of the sheet.
    const px = 0
    const py = headH
    ctx.save()
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(full,
      (f.x0 / cols) * fullW, (f.y0 / rows) * fullH, (cropW / cols) * fullW, (cropH / rows) * fullH,
      px, py, drawW, drawH)
    ctx.restore()
    const kx = px + drawW + 26
    const keyEnd = drawKey(ctx, kx, py + 22, keyW, { map, progress, showRHQ })
    const tableEnd = drawAreaTable(ctx, kx, keyEnd + 10, keyW, listed, numbered, progress, i > 0 ? progressFor?.(i - 1) : null)
    drawSummary(ctx, kx, tableEnd + 16, keyW, progress)

    // Footer credits sit in the key column, not over the map — with the map
    // full-bleed there is no margin left to put them in.
    textLine(ctx, 'LUCET PER MINISTERIUM', kx, PAGE_H - 40,
      { size: 13, spacing: 2, color: DIM, font: 'JetBrains Mono, monospace' })
    if (map.tiles?.attribution) {
      textLine(ctx, map.tiles.attribution, kx, PAGE_H - 20,
        { size: 12, color: DIM, weight: 500, font: 'Rajdhani, sans-serif' })
    }

    jpegs.push(await canvasJpeg(page))
  }
  return { blob: buildPdf(jpegs), pages: frames.length, tiles: tileStatus }
}
