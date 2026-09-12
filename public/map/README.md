# Map background images

One image per map in the registry (`MAPS` in `src/lib/maps.js`), named exactly
as that record's `image` field:

    nsw-terrain.png   648x336   NSW Campaign        grid 216x112
    singleton.png     648x459   Singleton Mil Area  grid 216x153

Each map's territory grid (`cols`/`rows` in the registry) is deliberately sized
so one grid cell maps to an exact 3x3 block of its image (648/3 = 216, 336/3 =
112, 459/3 = 153) — that keeps the colourable grid pixel-aligned to the actual
art instead of straddling it. **Keep any new image divisible the same way.**

A map may declare a `blockFill`: a flat colour in its art that can never be
painted. On `nsw-terrain.png` that's the `#3c82b4` ocean, auto-detected by
majority-pixel sampling (`src/lib/unpaintableMask.js`) and blocked in the
Operations Centre editor. If you replace that image, keep the ocean rendered as
that exact colour (or update `blockFill`). `singleton.png` is landlocked and
declares `null`, so nothing on it is blocked.

## Palette

Every map is drawn through a `contrast(140%) sepia(60%) brightness(75%)` CSS
filter (`IMAGE_FILTER` in `src/lib/terrainRender.js`), and the territory hatch
is composited over the top. Art therefore has to sit in a narrow mid-tone band:
anything darker than mid-grey crushes to black once filtered, and anything much
lighter blows out. Both images above stay roughly within a filtered luminance of
90–175.

## Regenerating singleton.png

It is derived from the Defence AUSPEC0196 1:25,000 sheet (Singleton Range
Special, Areas 8 & 9) rather than drawn by hand:

    pip install pillow numpy scipy pymupdf
    python3 tools/map/derive-singleton-map.py Areas_8__9.pdf public/map/singleton.png

That script documents how the sheet's legend colours are separated into
vegetation, relief, drainage, roads and boundaries. The source PDF is NOT in the
repo — it is marked FOR DEFENCE PURPOSES ONLY.

## Adding a map

1. Commit the art here at a size divisible by 3.
2. Add a record to `MAPS` in `src/lib/maps.js` (art, pixel size, grid, block fill).
3. Optionally seed its starting territory in `src/firebase/seed.js`.

No Firestore rules change is needed — a map's territory and replay-start slices
are ordinary `content/*` documents, and its replay frames live in the existing
`campaignFrames` collection under a `map` field.
