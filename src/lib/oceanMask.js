import { useEffect, useState } from 'react'
import { MAP_IMAGE, OCEAN_COLOR } from './territory'

// Shared ocean-tile detection, off one loaded copy of the source image's
// pixel data. Two different consumers need two different resolutions:
//  - getOceanMask(cols, rows): grid-cell resolution, majority-sampled — used
//    to decide whether a *paintable cell* is blocked (coarse, matches the
//    territory grid the brush actually edits).
//  - getOceanOverlayUrl(): native image-pixel resolution — used to *show*
//    the coastline in the editor without the blockiness a 3px grid cell
//    would otherwise produce; painting still snaps to the coarser grid.
const OCEAN_RGB = [
  parseInt(OCEAN_COLOR.slice(1, 3), 16),
  parseInt(OCEAN_COLOR.slice(3, 5), 16),
  parseInt(OCEAN_COLOR.slice(5, 7), 16),
]
const TOLERANCE = 18 // per-channel — the source art is a flat fill, so this is generous

const isOceanPixel = (r, g, b) =>
  Math.abs(r - OCEAN_RGB[0]) <= TOLERANCE &&
  Math.abs(g - OCEAN_RGB[1]) <= TOLERANCE &&
  Math.abs(b - OCEAN_RGB[2]) <= TOLERANCE

let pixelDataPromise = null // the source image never changes at runtime

function loadPixelData() {
  if (pixelDataPromise) return pixelDataPromise
  pixelDataPromise = new Promise((resolve, reject) => {
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
    img.src = MAP_IMAGE
  })
  return pixelDataPromise
}

const maskCache = new Map() // "colsxrows" -> Promise<Uint8Array>

// Resolves a cols*rows Uint8Array (1 = ocean/unpaintable) by majority-sampling
// every source-image pixel under each grid cell.
export function getOceanMask(cols, rows) {
  const key = `${cols}x${rows}`
  if (maskCache.has(key)) return maskCache.get(key)
  const promise = loadPixelData().then(({ width, height, data }) => {
    const mask = new Uint8Array(cols * rows)
    const cellW = width / cols
    const cellH = height / rows
    for (let cy = 0; cy < rows; cy++) {
      const y0 = Math.floor(cy * cellH), y1 = Math.max(y0 + 1, Math.floor((cy + 1) * cellH))
      for (let cx = 0; cx < cols; cx++) {
        const x0 = Math.floor(cx * cellW), x1 = Math.max(x0 + 1, Math.floor((cx + 1) * cellW))
        let ocean = 0, total = 0
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = (y * width + x) * 4
            if (isOceanPixel(data[i], data[i + 1], data[i + 2])) ocean++
            total++
          }
        }
        mask[cy * cols + cx] = total > 0 && ocean / total >= 0.5 ? 1 : 0
      }
    }
    return mask
  })
  maskCache.set(key, promise)
  return promise
}

// null while loading; Uint8Array once ready.
export function useOceanMask(cols, rows) {
  const [mask, setMask] = useState(null)
  useEffect(() => {
    let alive = true
    setMask(null)
    getOceanMask(cols, rows).then((m) => { if (alive) setMask(m) })
    return () => { alive = false }
  }, [cols, rows])
  return mask
}

let overlayPromise = null

// Data URL, native image resolution, dark-tinted ocean / transparent land —
// a pixel-exact coastline for display, independent of the coarser paint grid.
export function getOceanOverlayUrl() {
  if (overlayPromise) return overlayPromise
  overlayPromise = loadPixelData().then(({ width, height, data }) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    const out = ctx.createImageData(width, height)
    for (let i = 0; i < data.length; i += 4) {
      if (isOceanPixel(data[i], data[i + 1], data[i + 2])) {
        out.data[i] = 3; out.data[i + 1] = 7; out.data[i + 2] = 14; out.data[i + 3] = 150
      } // else fully transparent (defaults are already 0)
    }
    ctx.putImageData(out, 0, 0)
    return canvas.toDataURL('image/png')
  })
  return overlayPromise
}

// null until ready. `enabled` gates the (one-off, cached) load so read-only
// map instances that never need this don't trigger it.
export function useOceanOverlayUrl(enabled) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    getOceanOverlayUrl().then((u) => { if (alive) setUrl(u) })
    return () => { alive = false }
  }, [enabled])
  return url
}
