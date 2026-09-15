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
import { drawMapZones, ZONE_STYLE, ZONE_TEXTURE } from './mapZones'
import { ASSURE_BLUE as TASKFORCE_COLOR } from './territory'
import { sortFrames } from './campaign'
import { TASKFORCE_CODE, MERIDIAN_CODE, MERIDIAN_COLOR } from './territory'
import { COMPANIES } from '../firebase/seed'

const COMPANY_COLOR = COMPANIES.reduce((a, c) => ({ ...a, [c.letter]: c.accent }), {})
import { renderPrintBase } from './replayExport'

// ⚠️ A3 PORTRAIT at 150 dpi — these are wall sheets, read from across a room
// at camp, not handouts. Everything below is sized for that: the map takes as
// much of the page as its shape allows and the chrome is one header line plus
// the key, because a page that spends its area on framing is a page whose map
// is too small to read standing up.
//
// ⚠️ ORIENTATION IS THESE TWO NUMBERS AND NOTHING ELSE. Swapping them was a
// hand-tuning exercise once, because the map's crop rectangle was written out
// in maps.js already shaped to a landscape sheet. It isn't any more:
// `printFocus` declares the GROUND that has to appear and `fitCrop` below
// grows it to whatever shape the page is, so turning the sheet the other way
// is just these two constants.
const PAGE_W = 1754
const PAGE_H = 2480
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
// The yellow the area boundary is drawn in (LINE_STYLE in mapLines.js), reused
// for the sheet's AREA OF OPERATIONS tag so the words and the line that encloses
// the ground they name are the same colour.
const BOUNDARY = '#ffd23c'

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

/**
 * The whole annotation, as ONE THIN BAND along the bottom of the sheet.
 *
 * ⚠️ IT IS DELIBERATELY SMALL. This started as a full-height column beside the
 * map, then a large floating panel, and both were the same mistake: a wall
 * sheet is looked at from across a room, where the only thing readable is the
 * map, and every millimetre the annotation takes is a millimetre the progress
 * does not get. So the band carries exactly what cannot be read off the ground
 * — which area each number is, how many visits it has had, and which companies
 * have been through — plus a short key and one line of totals. Anything
 * that merely EXPLAINS the map (what the hatch means in words, what a fraction
 * means, the boundary colours, a company colour legend, a large percentage
 * numeral) was removed: it is either obvious from the map or it is not worth
 * the paper. Don't grow this back into a panel.
 */
// The band runs as many columns as the page is wide enough for — four across
// an A3 landscape sheet, three across a portrait one — at roughly 600 px each,
// which is what a long area name plus its count and letters needs. Its height
// is dead ground at the bottom of the crop, so `fitCrop` has to know it before
// the map is drawn; hence a pure function both can call.
const STRIP_ROW_H = 24
const stripCols = () => Math.max(2, Math.round(PAGE_W / 600))
const stripHeight = (n) => 30 + Math.ceil(n / stripCols()) * STRIP_ROW_H + 26

function drawStrip(ctx, listed, progress, showRHQ, map) {
  const COLS = stripCols()
  const rows = Math.ceil(listed.length / COLS)
  const rowH = STRIP_ROW_H
  const H = stripHeight(listed.length)
  const y0 = PAGE_H - H

  ctx.save()
  ctx.fillStyle = 'rgba(4,8,16,0.90)'
  ctx.fillRect(0, y0, PAGE_W, H)
  ctx.fillStyle = 'rgba(54,224,192,0.5)'
  ctx.fillRect(0, y0, PAGE_W, 2)
  ctx.restore()

  // Key: four swatches on one line, no prose.
  let kx = 26
  const ky = y0 + 26
  const chip = (draw, label, color) => {
    draw(kx, ky - 15, 34, 18)
    textLine(ctx, label, kx + 42, ky, { size: 15, font: 'JetBrains Mono, monospace', spacing: 0.6, color })
    kx += 42 + label.length * 10 + 30
  }
  const hatchChip = (code) => (x, y, w2, h2) => {
    const cv = document.createElement('canvas')
    cv.width = w2 * 2; cv.height = h2 * 2
    renderHatchSwatch(cv.getContext('2d'), code, cv.width, cv.height)
    ctx.drawImage(cv, x, y, w2, h2)
  }
  // MERIDIAN FIRST — it is the state every area starts in, and on the early
  // sheets it is most of the ground on the page, so a key that opened with
  // 1ATF's two shades left the dominant colour unnamed.
  chip(hatchChip(MERIDIAN_CODE), 'MERIDIAN', MERIDIAN_COLOR)
  chip(hatchChip(TASKFORCE_CODE.toLowerCase()), 'TAKING', INK)
  chip(hatchChip(TASKFORCE_CODE), 'TAKEN', INK)
  if (showRHQ) chip(hatchChip('R'), 'RHQ', INK)

  // Totals, right-aligned on the same line as the key.
  let done = 0, total = 0, complete = 0
  for (const [, p] of progress) { done += p.done; total += p.total; if (p.complete) complete += 1 }
  if (total) {
    textLine(ctx, `${Math.round((done / total) * 100)}%  ·  ${done} of ${total} visits  ·  ${complete} of ${progress.size} areas complete`,
      PAGE_W - 26, ky, { size: 19, font: 'JetBrains Mono, monospace', spacing: 0.8, color: '#fff', align: 'right' })
  }

  // Areas, three columns.
  const colW = (PAGE_W - 52) / COLS
  listed.forEach((z, k) => {
    const p = progress.get(z.id)
    if (!p) return
    const col = Math.floor(k / rows)
    const rx = 26 + col * colW
    const ry = y0 + 30 + (k % rows) * rowH + 17
    const st = ZONE_STYLE[z.kind] || ZONE_STYLE.activity
    const tex = ZONE_TEXTURE[z.kind] || ZONE_TEXTURE.activity
    textLine(ctx, tex.glyph, rx, ry, { size: 16, font: 'JetBrains Mono, monospace', color: st.color })
    textLine(ctx, z.name.toUpperCase(), rx + 24, ry,
      { size: 15, font: 'JetBrains Mono, monospace', spacing: 0.2, color: p.complete ? '#fff' : INK })
    let tx = rx + colW - 30
    const who = p.visited || []
    for (let j = who.length - 1; j >= 0; j--) {
      textLine(ctx, who[j], tx, ry, { size: 15, font: 'JetBrains Mono, monospace', color: COMPANY_COLOR[who[j]] || INK, align: 'right' })
      tx -= 14
    }
    textLine(ctx, `${p.done}/${p.total}`, tx - 4, ry,
      { size: 15, font: 'JetBrains Mono, monospace', color: p.complete ? TASKFORCE_COLOR : INK, align: 'right' })
  })

  if (map.tiles?.attribution) {
    textLine(ctx, map.tiles.attribution, PAGE_W - 26, PAGE_H - 10,
      { size: 12, color: DIM, weight: 500, align: 'right', font: 'Rajdhani, sans-serif' })
  }
  textLine(ctx, 'LUCET PER MINISTERIUM', 26, PAGE_H - 10,
    { size: 12, spacing: 2, color: DIM, font: 'JetBrains Mono, monospace' })
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
/**
 * Grow the ground a map says must be printed into the rectangle the PAGE wants.
 *
 * `printFocus` names the ground — the area of operations plus a little air. It
 * is deliberately NOT the crop: a crop has to match the sheet's proportions
 * exactly or the map comes out stretched, and it has to leave the bottom band
 * standing on ground nobody needs to read, since an area whose name lands under
 * the band has effectively lost its label (which is what happened to AA Papa at
 * a tighter crop). Both of those are page facts, not map facts, so they are
 * worked out here and the map record stays orientation-agnostic.
 *
 * The rectangle only ever GROWS: whatever the page shape, every cell the map
 * declared is still on the sheet.
 */
function fitCrop(f, cols, rows, bandH) {
  const need = { w: Math.max(1, f.x1 - f.x0), h: Math.max(1, f.y1 - f.y0) }
  const above = Math.max(1, PAGE_H - bandH)     // page height the map may use
  // Tall enough that `need` clears the band, and wide enough to hold it.
  let ch = Math.max(need.h * (PAGE_H / above), need.w * (PAGE_H / PAGE_W))
  let cw = ch * (PAGE_W / PAGE_H)
  // A crop bigger than the grid can't be filled, so cap it and let the other
  // axis follow — the page keeps its shape, the map just shows more ground.
  const cap = Math.min(cols / cw, rows / ch, 1)
  cw *= cap; ch *= cap
  // Centre horizontally on the ground; vertically, centre it in the part of
  // the page the band is not covering.
  let x0 = (f.x0 + f.x1) / 2 - cw / 2
  let y0 = (f.y0 + f.y1) / 2 - (ch * (above / PAGE_H)) / 2
  x0 = Math.min(Math.max(0, x0), Math.max(0, cols - cw))
  y0 = Math.min(Math.max(0, y0), Math.max(0, rows - ch))
  return { x0, y0, x1: x0 + cw, y1: y0 + ch }
}

export async function exportFramesPdf({ territory, frames: campaignFrames, zones = [], zonesAt = null, progressFor = null, title }) {
  const frames = sortFrames(campaignFrames || [])
  if (!frames.length) throw new Error('No campaign frames to print yet.')
  const map = mapFor(territory)
  const { cols, rows, showRHQ } = territory

  // The printed map shows what the screen shows: a map that opens on a focus
  // box is cropped to it here too, rather than printing ground the portal
  // deliberately frames out.
  // The print crops wider than the screen does — see `printFocus` in maps.js.
  const want = map.printFocus || map.focus || { x0: 0, y0: 0, x1: cols, y1: rows }

  // ⚠️ THE MAP IS THE WHOLE SHEET. Not bled to the edges with a header above
  // and a key beside it — that arrangement still spent a quarter of an A3 on
  // chrome, and chrome is what the map is competing with for the millimetres
  // that decide whether an area reads from across a room. The map now covers
  // the page corner to corner, the title sits ON it, and the key floats in a
  // quiet corner OF it. `fitCrop` shapes the crop to the page, so this costs
  // no stretching and crops no camp ground.
  const drawW = PAGE_W
  const drawH = PAGE_H
  // ⚠️ Tiles are fetched for the FOCUS REGION ONLY. The page crops to that box,
  // so tiles covering the rest of the frame would be downloaded and then thrown
  // away — and, because the tile budget is what picks the zoom level, paying
  // for them costs two levels of detail in the part that actually prints. The
  // static art still covers the whole frame underneath, so nothing is missing
  // if a visitor ever zooms out of a page. This is the difference between the
  // print showing the 10 m Sentinel floor and showing real imagery.
  // The bottom band lists areas in reading order down the sheet, matching the
  // names printed on the ground itself.
  //
  // ⚠️ Built from the UNION of every frame's progress, not from one frame's.
  // Asking only the LAST frame meant a single frame without a camp day — one
  // RHQ added by hand, or any frame predating the `day` field — returned null
  // and emptied the list for EVERY page, so a real export came out with no
  // area names on the map and no rows in the band while still showing correct
  // totals. A per-page fact must never be derived from one page.
  const known = new Set()
  if (progressFor) {
    for (let k = 0; k < frames.length; k++) {
      const p = progressFor(k)
      if (p) for (const id of p.keys()) known.add(id)
    }
  }
  const listed = zones
    .filter((z) => (known.size ? known.has(z.id) : z.cells?.length >= 3))
    .sort((a, b) => (a.label[1] - b.label[1]) || (a.label[0] - b.label[0]))

  // The crop is derived LAST, because it depends on how tall the band turned
  // out — which depends on how many areas there are to list.
  const f = fitCrop(want, cols, rows, stripHeight(listed.length))
  const cropW = Math.max(1, f.x1 - f.x0)
  const cropH = Math.max(1, f.y1 - f.y0)

  // Render the whole map once at the resolution the crop needs, then take the
  // crop rectangle out of it — the renderers all work in full-grid
  // coordinates, so cropping at the end keeps every one of them unchanged.
  const fullW = Math.round((drawW * SUPERSAMPLE * cols) / cropW)
  const fullH = Math.round((drawH * SUPERSAMPLE * rows) / cropH)

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
    // A frame may carry its own zone selection (frameHiddenZones); `zonesAt`
    // resolves it, falling back to the map's for any frame that hasn't got one.
    const pageZones = zonesAt?.(i) || zones
    drawMapZones(fc, pageZones, { cols, rows, w: fullW, h: fullH, scale: fullW / map.pixelWidth, progress, zoneScale: 1.15, printLabels: true })
    const hatch = document.createElement('canvas')
    hatch.width = fullW; hatch.height = fullH
    renderTerritoryLayer(hatch.getContext('2d'), { cells: fr.cells, cols, rows, showRHQ, w: fullW, h: fullH })
    fc.drawImage(hatch, 0, 0)

    // ⚠️ NOTHING MARKS "TAKEN TODAY", DELIBERATELY (2026-09-15). Ground taken
    // on this sheet's day used to carry a gold outline over a light wash. Two
    // reasons it went: the wash TINTED the company colours underneath, so the
    // very ground whose company you most wanted to read was the ground whose
    // colour was altered; and the reason it existed — five cumulative sheets
    // looking nearly alike — stopped being true once the areas started as
    // Meridian and are taken in company colours. Day 1 is mostly red and Day 4
    // is entirely 1ATF blue; the sheets no longer need help telling each other
    // apart. Ground taken today looks exactly like ground taken on any other
    // day, which is what it is.

    const page = document.createElement('canvas')
    page.width = PAGE_W; page.height = PAGE_H
    const ctx = page.getContext('2d')
    ctx.fillStyle = GROUND
    ctx.fillRect(0, 0, PAGE_W, PAGE_H)

    // Map — the crop rectangle out of the full render, covering the sheet.
    const px = 0
    const py = 0
    ctx.save()
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(full,
      (f.x0 / cols) * fullW, (f.y0 / rows) * fullH, (cropW / cols) * fullW, (cropH / rows) * fullH,
      px, py, drawW, drawH)
    ctx.restore()

    // ⚠️ TITLE AFTER THE MAP — it sits ON the sheet, not above it. Drawn
    // before the map it was simply painted over, which is what happens to any
    // chrome that forgets the map now covers the whole page. On a scrim rather
    // than in a band of its own: the top of this crop is open paddock on every
    // sheet, so the type costs the map nothing there, whereas a header band
    // costs it a strip whether that strip had anything in it or not.
    const grad = ctx.createLinearGradient(0, 0, 0, 150)
    grad.addColorStop(0, 'rgba(4,8,16,0.9)')
    grad.addColorStop(1, 'rgba(4,8,16,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, PAGE_W, 150)
    textLine(ctx, '1ATF', 30, 56, { size: 46, spacing: 4 })
    const heading = (title || fr.label || `FRAME ${i + 1}`).toUpperCase()
    textLine(ctx, heading, 200, 54, { size: 31, spacing: 3, color: ACCENT })
    textLine(ctx, `SHEET ${i + 1} OF ${frames.length}`, PAGE_W - 30, 32,
      { size: 17, spacing: 2, color: DIM, align: 'right', font: 'JetBrains Mono, monospace' })
    if (map.focus?.label) {
      textLine(ctx, `${map.focus.label} — AREA OF OPERATIONS`, PAGE_W - 30, 58,
        { size: 18, spacing: 1.8, color: BOUNDARY, align: 'right', font: 'JetBrains Mono, monospace' })
    }

    // ⚠️ The band lists what the MAP shows on this page. Leaving it on the
    // whole-campaign `listed` set would name areas in the strip that were
    // deliberately taken off this frame's map.
    const pageListed = zonesAt ? listed.filter((z) => pageZones.some((p) => p.id === z.id)) : listed
    drawStrip(ctx, pageListed, progress, showRHQ, map)



    jpegs.push(await canvasJpeg(page))
  }
  return { blob: buildPdf(jpegs), pages: frames.length, tiles: tileStatus }
}
