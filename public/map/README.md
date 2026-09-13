# Map background images

One image per map in the registry (`MAPS` in `src/lib/maps.js`), named exactly
as that record's `image` field:

    nsw-terrain.png   648x336    NSW Campaign        grid 216x112   pixel art
    singleton.webp    1080x765   Singleton Mil Area  grid 216x153   satellite

Each map's territory grid (`cols`/`rows` in the registry) is deliberately sized
so one grid cell maps to an exact whole block of its image (648/3 = 216, 336/3 =
112; 1080/5 = 216, 765/5 = 153) — that keeps the colourable grid pixel-aligned
to the actual art instead of straddling it. **Keep any new image divisible the
same way.**

A map may declare a `blockFill`: a flat colour in its art that can never be
painted. On `nsw-terrain.png` that's the `#3c82b4` ocean, auto-detected by
majority-pixel sampling (`src/lib/unpaintableMask.js`) and blocked in the
Operations Centre editor. If you replace that image, keep the ocean rendered as
that exact colour (or update `blockFill`). `singleton.webp` is landlocked and
declares `null`, so nothing on it is blocked.

## Two kinds of art, two filters

`IMAGE_FILTER` in `src/lib/terrainRender.js` — `contrast(140%) sepia(60%)
brightness(75%)` — is the default, and it was written for **flat pixel art**:
it can push those tiles hard because there is no detail in them to lose. Art of
that kind therefore has to sit in a narrow mid-tone band (filtered luminance
roughly 90–175); anything darker than mid-grey crushes to black once filtered,
anything much lighter blows out. `nsw-terrain.png` is drawn to that rule.

**Photographic art cannot take that treatment** — shadowed timber goes solid
black and the whole frame stains one colour — so such a map declares its own
gentler `imageFilter` in its registry record, applied by `imageFilterFor()` in
the same file. `singleton.webp` does. Judge new photographic art *through* its
filter, not at full strength.

WebP, not PNG, for the photographic map: the same frame is 1.4 MB as a PNG and
340 KB at quality 92, and it is the first thing the home page loads for anyone
on that map.

## Regenerating singleton.webp

Two committed scripts, and the source data for both is free of the sheet's
distribution restriction:

    pip install pillow numpy scipy scikit-image rasterio pymupdf

    # 1. trace the boundaries off the AUSPEC0196 sheet (only when they change)
    python3 tools/map/trace-singleton-boundaries.py Areas_8__9.pdf

    # 2. build the art: Sentinel-2 imagery + those boundaries
    python3 tools/map/build-singleton-map.py public/map/singleton.webp

Step 2 needs no PDF — it pulls Copernicus Sentinel-2 true colour from the AWS
Open Data registry, cuts it to the sheet's MGA Zone 56 bounds, and draws the
traced boundaries over it. Attribute imagery as "Contains modified Copernicus
Sentinel data". Step 1 needs the source PDF, which is NOT in the repo — it is
marked FOR DEFENCE PURPOSES ONLY — so the traced vertices are committed
(`tools/map/singleton-boundaries.json`) and step 1 rarely has to run.

`tools/map/derive-singleton-map.py` is the older path that redrew the whole
sheet as flat pixel art. It no longer builds this map; it is kept because it
documents how the sheet's legend colours separate, and the tracer still uses
its sheet loader.

## Adding a map

1. Commit the art here at a size its grid divides exactly.
2. Add a record to `MAPS` in `src/lib/maps.js` (art, pixel size, grid, block
   fill, and `imageFilter` if the art is photographic).
3. Optionally seed its starting territory in `src/firebase/seed.js`.

No Firestore rules change is needed — a map's territory and replay-start slices
are ordinary `content/*` documents, and its replay frames live in the existing
`campaignFrames` collection under a `map` field.
