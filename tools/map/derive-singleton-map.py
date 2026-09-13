"""Redraw the AUSPEC0196 Singleton Range sheet as flat pixel art.

NO LONGER BUILDS THE LIVE MAP. public/map/singleton.webp is now Sentinel-2
satellite imagery with the sheet's boundaries drawn over it - see
build-singleton-map.py and trace-singleton-boundaries.py. This script is kept
for two reasons: it documents how the sheet's legend colours separate into
features, which is what the tracer's ink thresholds rest on, and the tracer
imports `load_sheet` from it. Run it if you want the old stylised tile back.

The portal's other maps are flat pixel art, not scans: a 1:25,000 topographic sheet
has far too much line work to read at 648px wide, and none of it survives the
territory hatch drawn over the top. So this reads the sheet and rebuilds it as
the classes ITS OWN LEGEND defines, then reduces each ~3.16x3.16 block of
source pixels to one output pixel of a flat palette.

HOW THE LEGEND IS READ. The sheet separates its features by ink colour, and
that - not geometry - is what this keys off:

    roads          red/pink ink: red leads, green tracks blue  (R-G>5, G-B<6)
                   dark maroon = all-weather hard surface
                   pale pink   = all-weather loose surface
    contours       brown ink: green sits well above blue       (G-B>8)
    track/trail    fine neutral dashes, neither red nor brown
    drainage       blue/cyan ink and area fills
    railway        heavy saturated blue with regular tick marks
    sector bdy     broad lavender band  (red AND blue above green)
    defence bdy    heavy dark red ink that is not the highway - the only two
                   features drawn at that weight
    vegetation     green area wash, in density bands
    cultivated     pale pink area wash

An earlier version keyed roads off "warm ink" (R-B) instead. That lumps brown
contours in with pink roads, and no amount of geometry untangles them
afterwards - which is why the road network came out almost empty. Measure
before trusting a channel: on this sheet contours sit at G-B ~ +14 and roads
at G-B ~ 0, which is a clean split.

TWO CONSTRAINTS that are easy to get wrong by eye at full size:
  * The page renders every map through a contrast(140%) CSS filter
    (IMAGE_FILTER in src/lib/terrainRender.js), which crushes anything below
    mid-grey to black. The palette sits in a narrow mid-tone band so nothing
    blocks up once filtered.
  * Vegetation is drawn with stipple symbols, so an unsmoothed classification
    is salt-and-pepper at this scale rather than country.

Usage:
    pip install pillow numpy scipy pymupdf
    python3 tools/map/derive-singleton-map.py Areas_8__9.pdf singleton-pixelart.png
"""
import io
import sys

from PIL import Image
import numpy as np
from scipy import ndimage as ndi

OUT_W, OUT_H = 648, 459   # 216 x 153 territory cells @ 3x3 source px per cell

# The sheet's printed 1000m MGA Zone 56 grid, fitted to the scan. Also the
# map's georeference - keep in step with `geo` in src/lib/maps.js.
GRID_PX = 195.25          # source pixels per kilometre
GRID_X0, GRID_Y0 = 51.0, 38.0   # first grid line (E 325000, N 6378000)
GRID_HALF = 2             # half-width of the band masked out around each line


def load_sheet(path):
    """The sheet, as an RGB array. Accepts the PDF or an already-extracted image."""
    if path.lower().endswith('.pdf'):
        import pymupdf
        doc = pymupdf.open(path)
        # The map face is page 2's single full-page image; page 1 is the legend.
        xref = doc[1].get_images(full=True)[0][0]
        data = doc.extract_image(xref)
        return np.array(Image.open(io.BytesIO(data['image'])).convert('RGB'), np.float32)
    return np.array(Image.open(path).convert('RGB'), np.float32)


def ones(n):
    return np.ones((n, n), bool)


def keep_lines(mask, min_length, max_fill, gap=5):
    """Keep only the components of `mask` that look like a route, not a word.

    Two things separate them without reading the type: a route RUNS a long way,
    and a route is thin inside its own bounding box where a word fills its own.
    `gap` bridges the dashes a dashed track or boundary prints with.
    """
    lab, _ = ndi.label(ndi.binary_dilation(mask, ones(gap)))
    out = np.zeros_like(mask)
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        if sl is None:
            continue
        ys, xs = sl
        h, w = ys.stop - ys.start, xs.stop - xs.start
        if max(h, w) < min_length:
            continue
        piece = lab[sl] == i
        if piece.sum() / float(h * w) > max_fill:
            continue
        out[sl] |= piece
    return out & mask


def feature_cover(im, out_w=OUT_W, out_h=OUT_H):
    """Per-output-pixel coverage of every feature the sheet's legend defines."""
    OUT_W, OUT_H = out_w, out_h
    H, W, _ = im.shape
    R, G, B = im[:, :, 0], im[:, :, 1], im[:, :, 2]
    mx, mn = im.max(2), im.min(2)
    V = mx / 255.0
    S = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0.0)

    # Line work is anything printed darker than its surroundings, whatever the
    # wash beneath it - which is what makes this work over both the white
    # paddocks and the green timber.
    lines = V < (ndi.uniform_filter(V, 9) - 0.03)

    # --- lettering ---------------------------------------------------------
    # Type is dark ink that does NOT run: spot heights, grid numbers, place
    # names and the big "COMMONWEALTH LAND" overprint all fail the line test,
    # while every road and track passes it.
    #
    # Do NOT try to find type by its white halo. Named features do print with
    # one, but so does half this sheet - the cleared paddocks ARE white - so a
    # halo test marks the whole training area as lettering and deletes every
    # road crossing it. That mistake cost this map its road network once.
    dark_ink = ndi.binary_erosion(V < 0.52, ones(3))
    lettering = ndi.binary_dilation(dark_ink & ~keep_lines(dark_ink, 45, 0.30), ones(7))

    # The 1000m MGA grid prints as full-length hairlines, and a dead-straight
    # line is exactly what the road tests are looking for. Mask it by its known
    # geometry rather than by "which columns are inky": the earlier threshold
    # test (> 0.45 of a column) NEVER fired, because the grid is fine enough
    # that its inkiest column only reaches 0.31 - the guard was dead code.
    #
    # The comb below is fitted to this sheet (GRID_PX apart, first line at
    # GRID_X0/GRID_Y0), which is also what georeferences the map: see `geo` in
    # src/lib/maps.js. Re-fit it if the source scan is ever replaced.
    graticule = np.zeros(( H, W), bool)
    for k in range(-1, int(W / GRID_PX) + 2):
        x = int(round(GRID_X0 + GRID_PX * k))
        if 0 <= x < W:
            graticule[:, max(0, x - GRID_HALF):x + GRID_HALF + 1] = True
    for k in range(-1, int(H / GRID_PX) + 2):
        y = int(round(GRID_Y0 + GRID_PX * k))
        if 0 <= y < H:
            graticule[max(0, y - GRID_HALF):y + GRID_HALF + 1, :] = True
    clean = lines & ~lettering & ~graticule

    # Contours crowd together on the scarps until they merge into a solid
    # reddish mass that passes every "is this pink ink" test. Nothing routed
    # runs through that, so fence it off before looking for roads.
    brown = clean & ((G - B) > 8) & (V > 0.50)
    crowded = ndi.binary_dilation(ndi.uniform_filter(brown.astype(np.float32), 15) > 0.22, ones(7))

    # --- roads, by the legend's own ink colour ------------------------------
    red_ink = clean & ((R - G) > 5) & ((G - B) < 6) & ~crowded

    # The sealed road and the Commonwealth-land boundary are the only heavy
    # dark red ink; everything else at that weight is a pale loose-surface
    # road. Of the two, only the highway runs right across the sheet.
    # Erode by 2, not 3: red ink on this sheet is 1-2px, so a 3x3 erosion
    # removes essentially all of it.
    heavy = keep_lines(ndi.binary_erosion(red_ink & (V < 0.75), ones(2)), 150, 0.22, gap=9)
    lab, _ = ndi.label(ndi.binary_dilation(heavy, ones(9)))
    highway = np.zeros_like(heavy)
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        if sl is None:
            continue
        ys, xs = sl
        if (xs.stop - xs.start) > 400 and (ys.start + ys.stop) / 2 < H * 0.55:
            highway |= lab == i
    highway &= heavy
    defence_bdy = heavy & ~highway

    rest = red_ink & ~ndi.binary_dilation(heavy, ones(3))
    # Hard surface prints dark maroon; loose surface prints pale pink.
    road_hard = highway | keep_lines(rest & (V <= 0.58), 40, 0.30, gap=7)
    road_loose = keep_lines(rest & (V > 0.58), 40, 0.30, gap=7)

    # --- track / trail -----------------------------------------------------
    neutral = (abs(G - B) < 8) & (abs(R - G) < 10)
    track = keep_lines(clean & (V < 0.62) & (S < 0.22) & neutral, 45, 0.30, gap=9)

    # --- railway -----------------------------------------------------------
    # Heavy saturated blue with regular tick marks; nothing else on the sheet
    # is this blue, so it needs no geometry beyond a run-length test.
    railway = keep_lines(clean & ((B - R) > 25) & ((B - G) > 15), 120, 0.35, gap=13)

    # --- boundaries --------------------------------------------------------
    # Sector boundary: broad lavender band - red AND blue both above green.
    # Dark ink on pale ground picks up a blue JPEG fringe, so keep it clear of
    # the fringe rather than tracing every road with a phantom boundary.
    fringe = ndi.binary_dilation(V < 0.55, ones(5))
    # ~crowded matters as much here as it does for the roads: merged contour
    # mass on the scarps goes purple under JPEG and is otherwise a dead ringer
    # for the lavender band.
    sector = keep_lines(
        ndi.binary_erosion(((B - G) > 5) & ((R - G) > 0) & (V > 0.45) & ~fringe & ~crowded, ones(5)),
        150, 0.25, gap=11)

    # --- drainage ----------------------------------------------------------
    water = (((B - (R + G) / 2) > 7) & ((B - G) > 1) & (R <= G + 3) & (V > 0.45)
             & ~fringe & ~lettering & ~railway)

    # --- relief ------------------------------------------------------------
    # Contours print brown, and are the only elevation signal a raster sheet
    # carries. Everything else warm has already been claimed above.
    contour = brown & ~red_ink

    # ------------------------------------------------------- to the grid ---
    YS = (np.arange(OUT_H + 1) * H / OUT_H).astype(int)
    XS = (np.arange(OUT_W + 1) * W / OUT_W).astype(int)
    AREA = np.diff(YS)[:, None] * np.diff(XS)[None, :]

    def reduce_sum(a):
        rows = np.add.reduceat(a.astype(np.float32), YS[:-1], axis=0)[:OUT_H]
        return np.add.reduceat(rows, XS[:-1], axis=1)[:, :OUT_W]

    cover = lambda m: reduce_sum(m) / AREA
    # A 2px line is well under one output pixel, so widen the linear features
    # before reducing or the network breaks into dots at this scale.
    line_cover = lambda m, r=2: cover(ndi.binary_dilation(m, ones(r)))

    # The area wash is averaged over pixels that are neither line work nor
    # road-adjacent: dense contour hatching in the steep country would
    # otherwise wash its timber out to pale, and pink road ink would bleed
    # into the neighbouring ground and read as cultivated land.
    roadish = ndi.binary_dilation(red_ink | defence_bdy, ones(9))
    fill = ~lines & ~roadish
    fill_area = np.maximum(reduce_sum(fill), 1.0)
    wash = lambda ch: reduce_sum(ch * fill) / fill_area
    vg = ndi.uniform_filter(wash(G - (R + B) / 2), size=7)
    pk = ndi.uniform_filter(wash(R - G), size=7)

    relief = ndi.uniform_filter(cover(contour), size=9)
    wt = ndi.median_filter(cover(water), size=3)
    tk, rl = line_cover(track), line_cover(railway)
    rlo, rhd = line_cover(road_loose), line_cover(road_hard)
    sc, dbd = cover(sector), line_cover(defence_bdy, 3)

    return dict(vg=vg, pk=pk, relief=relief, water=wt, track=tk, railway=rl,
                road_loose=rlo, road_hard=rhd, sector=sc, defence=dbd)


def derive(im, out_w=OUT_W, out_h=OUT_H):
    """The flat-palette rendering of the sheet, kept for reference and reuse."""
    OUT_W, OUT_H = out_w, out_h
    f = feature_cover(im, OUT_W, OUT_H)
    vg, pk, relief = f['vg'], f['pk'], f['relief']
    wt, tk, rl = f['water'], f['track'], f['railway']
    rlo, rhd, sc, dbd = f['road_loose'], f['road_hard'], f['sector'], f['defence']

    # ---------------------------------------------------------- palette ---
    P = {k: np.array(v, np.float32) for k, v in {
        # Ground cover, in the legend's own density bands.
        'dense':      (0x5c, 0x8a, 0x55),   # woodland, dense
        'woodland':   (0x6d, 0x9a, 0x5e),   # woodland, medium
        'scrub':      (0x89, 0xab, 0x68),   # scrub / scattered trees
        'grass':      (0xa4, 0xb8, 0x6e),   # grazed grass
        'cleared':    (0xc0, 0xbb, 0x74),   # cleared paddock, the training flats
        'cultivated': (0xc4, 0xae, 0x8c),   # cultivated land (pale pink wash)
        # Relief.
        'ridge':      (0xad, 0x8a, 0x63),   # broken ground
        'scarp':      (0x9c, 0x7d, 0x68),   # steep scarp / rock
        # Line work, drawn in legend order of precedence.
        'water':      (0x4d, 0x87, 0xad),   # streams, dams
        'railway':    (0x7d, 0x8a, 0x9e),   # railway
        'track':      (0x96, 0x7c, 0x55),   # track / trail
        'road_loose': (0xd8, 0xa8, 0x60),   # road, all weather loose surface
        'road_hard':  (0xe4, 0x8a, 0x34),   # road, all weather hard surface
        'sector':     (0x9c, 0x95, 0xc6),   # sector boundary
        'defence':    (0xc2, 0x84, 0xa4),   # defence area boundary
    }.items()}

    # Classify then median-filter: vegetation is drawn with stipple symbols, so
    # without it the timber breaks up into salt-and-pepper at this scale.
    GROUND = ['cleared', 'grass', 'scrub', 'woodland', 'dense']
    klass = ndi.median_filter(np.digitize(vg, [1.0, 5.5, 10.0, 14.5]), size=5)
    img = np.empty((OUT_H, OUT_W, 3), np.float32)
    for i, key in enumerate(GROUND):
        img[klass == i] = P[key]
    # Cultivated land is a pink wash over otherwise open ground.
    img[(klass <= 1) & (ndi.median_filter(pk, size=5) > 7)] = P['cultivated']

    # Relief: warm and darken the steep country in proportion to contour
    # density. Kept light - the territory hatch is drawn over this and has to
    # stay readable.
    steep = np.clip((relief - 0.12) / 0.10, 0, 1)[:, :, None]
    img = img * (1 - steep * 0.24) + P['ridge'] * (steep * 0.24)
    crest = np.clip((relief - 0.22) / 0.08, 0, 1)[:, :, None]
    img = img * (1 - crest * 0.26) + P['scarp'] * (crest * 0.26)

    # Draw order = legend precedence: the more significant the route, the later
    # it lands, so a junction shows the higher class.
    img[wt > 0.12] = P['water']
    img[tk > 0.18] = P['track']
    img[rl > 0.18] = P['railway']
    img[rlo > 0.16] = P['road_loose']
    img[rhd > 0.16] = P['road_hard']
    img[sc > 0.28] = P['sector']
    img[dbd > 0.28] = P['defence']
    return img.round().clip(0, 255).astype(np.uint8)


if __name__ == '__main__':
    src = sys.argv[1] if len(sys.argv) > 1 else 'Areas_8__9.pdf'
    dst = sys.argv[2] if len(sys.argv) > 2 else 'singleton-pixelart.png'
    Image.fromarray(derive(load_sheet(src))).save(dst)
    print(f'wrote {dst} ({OUT_W}x{OUT_H})')
