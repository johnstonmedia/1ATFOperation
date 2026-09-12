import { useEffect, useState } from 'react'

// Unpaintable-fill detection, per map, off one loaded copy of that map's art.
//
// Some maps contain ground nobody can hold — on the NSW tile that's the flat
// ocean fill. A map declares it as `blockFill` in lib/maps.js; a map with no
// such fill (Singleton, which is landlocked) declares null and nothing here
// blocks anything.
//
// Two different consumers need two different resolutions:
//  - unpaintableMask(map, cols, rows): grid-cell resolution, majority-sampled
//    — used to decide whether a *paintable cell* is blocked (coarse, matches
//    the territory grid the brush actually edits).
//  - unpaintableOverlayUrl(map): native image-pixel resolution — used to
//    *show* the blocked area in the editor without the blockiness a 3px grid
//    cell would otherwise produce; painting still snaps to the coarser grid.
const TOLERANCE = 18 // per-channel — the fill is flat, so this is generous

const rgbOf = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

const matcher = (hex) => {
  const [tr, tg, tb] = rgbOf(hex)
  return (r, g, b) =>
    Math.abs(r - tr) <= TOLERANCE && Math.abs(g - tg) <= TOLERANCE && Math.abs(b - tb) <= TOLERANCE
}

const pixelDataPromises = new Map() // map id -> Promise<{width,height,data}>

function loadPixelData(map) {
  if (pixelDataPromises.has(map.id)) return pixelDataPromises.get(map.id)
  const promise = new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      resolve({ width: canvas.width, height: canvas.height, data })
    }
    img.onerror = reject
    img.src = map.image
  })
  pixelDataPromises.set(map.id, promise)
  return promise
}

const maskCache = new Map() // "mapId|colsxrows" -> Promise<Uint8Array>

// Resolves a cols*rows Uint8Array (1 = unpaintable) by majority-sampling every
// source-image pixel under each grid cell. A map with no blocked fill resolves
// an all-zero mask without ever loading the image.
export function unpaintableMask(map, cols, rows) {
  if (!map.blockFill) return Promise.resolve(new Uint8Array(cols * rows))
  const key = `${map.id}|${cols}x${rows}`
  if (maskCache.has(key)) return maskCache.get(key)
  const isBlocked = matcher(map.blockFill)
  const promise = loadPixelData(map).then(({ width, height, data }) => {
    const mask = new Uint8Array(cols * rows)
    const cellW = width / cols
    const cellH = height / rows
    for (let cy = 0; cy < rows; cy++) {
      const y0 = Math.floor(cy * cellH), y1 = Math.max(y0 + 1, Math.floor((cy + 1) * cellH))
      for (let cx = 0; cx < cols; cx++) {
        const x0 = Math.floor(cx * cellW), x1 = Math.max(x0 + 1, Math.floor((cx + 1) * cellW))
        let blocked = 0, total = 0
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = (y * width + x) * 4
            if (isBlocked(data[i], data[i + 1], data[i + 2])) blocked++
            total++
          }
        }
        mask[cy * cols + cx] = total > 0 && blocked / total >= 0.5 ? 1 : 0
      }
    }
    return mask
  })
  maskCache.set(key, promise)
  return promise
}

// null while loading; Uint8Array once ready.
export function useUnpaintableMask(map, cols, rows) {
  const [mask, setMask] = useState(null)
  useEffect(() => {
    let alive = true
    setMask(null)
    unpaintableMask(map, cols, rows).then((m) => { if (alive) setMask(m) })
    return () => { alive = false }
  }, [map, cols, rows])
  return mask
}

const overlayPromises = new Map() // map id -> Promise<string>

// Data URL, native image resolution, dark-tinted over the blocked fill and
// transparent elsewhere — a pixel-exact edge for display, independent of the
// coarser paint grid. null for a map with nothing blocked.
export function unpaintableOverlayUrl(map) {
  if (!map.blockFill) return Promise.resolve(null)
  if (overlayPromises.has(map.id)) return overlayPromises.get(map.id)
  const isBlocked = matcher(map.blockFill)
  const promise = loadPixelData(map).then(({ width, height, data }) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    const out = ctx.createImageData(width, height)
    for (let i = 0; i < data.length; i += 4) {
      if (isBlocked(data[i], data[i + 1], data[i + 2])) {
        out.data[i] = 3; out.data[i + 1] = 7; out.data[i + 2] = 14; out.data[i + 3] = 150
      } // else fully transparent (defaults are already 0)
    }
    ctx.putImageData(out, 0, 0)
    return canvas.toDataURL('image/png')
  })
  overlayPromises.set(map.id, promise)
  return promise
}

// null until ready (and forever, for a map with nothing blocked). `enabled`
// gates the (one-off, cached) load so read-only map instances that never need
// this don't trigger it.
export function useUnpaintableOverlayUrl(map, enabled) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!enabled) return undefined
    let alive = true
    setUrl(null)
    unpaintableOverlayUrl(map).then((u) => { if (alive) setUrl(u) })
    return () => { alive = false }
  }, [map, enabled])
  return url
}
