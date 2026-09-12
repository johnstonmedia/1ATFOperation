"""Derive public/map/singleton.png from the AUSPEC0196 Singleton Range sheet.

The portal's maps are flat pixel art, not scans: a 1:25,000 topographic sheet
has far too much line work to read at 648px wide, and none of it survives the
territory hatch being drawn over the top. So this reads the sheet and separates
it into the things its legend actually distinguishes --

    vegetation wash   green area fill, in density bands
    relief            contour line work, as a proxy for steepness
    drainage          creeks and dams
    cleared ground    the white paddocks and training flats
    sealed road       the New England Highway along the northern boundary
    vehicle track     the range road network
    boundaries        Commonwealth land, and the sector boundary

-- and reduces each ~3.16x3.16 block of source pixels to one output pixel of a
flat palette.

Two constraints drive the palette and the smoothing, and both are easy to get
wrong by eye at full size:

  * The page renders every map through a contrast(140%) CSS filter
    (IMAGE_FILTER in src/lib/terrainRender.js), which crushes anything below
    mid-grey to black. The colours below sit in the same narrow mid-tone band
    the NSW art uses so that nothing blocks up once filtered.
  * Vegetation is drawn with stipple symbols, so an unsmoothed classification
    is salt-and-pepper at this scale rather than country.

Usage:
    pip install pillow numpy scipy pymupdf
    python3 tools/map/derive-singleton-map.py Areas_8__9.pdf public/map/singleton.png
"""
import sys

from PIL import Image
import numpy as np
from scipy import ndimage as ndi

OUT_W, OUT_H = 648, 459   # 216 x 153 territory cells @ 3x3 source px per cell


def load_sheet(path):
    """The sheet, as an RGB array. Accepts the PDF or an already-extracted image."""
    if path.lower().endswith('.pdf'):
        import pymupdf
        doc = pymupdf.open(path)
        # The map face is page 2's single full-page image; page 1 is the legend.
        xref = doc[1].get_images(full=True)[0][0]
        data = doc.extract_image(xref)
        import io
        return np.array(Image.open(io.BytesIO(data['image'])).convert('RGB'), np.float32)
    return np.array(Image.open(path).convert('RGB'), np.float32)


def ones(n):
    return np.ones((n, n), bool)


def keep_lines(mask, min_length, max_fill, gap=5):
    """Keep only the components of `mask` that look like a route rather than a word.

    Two things separate them and neither needs to read the type: a route RUNS a
    long way, and a route is a thin line inside its own bounding box where a
    word fills its own. `gap` bridges the dashes a dashed track prints with.
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


def derive(im):
    H, W, _ = im.shape
    R, G, B = im[:, :, 0], im[:, :, 1], im[:, :, 2]
    mx, mn = im.max(2), im.min(2)
    V = mx / 255.0
    S = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0.0)

    # ---------------------------------------------------------------- ink ---
    # Line work is anything printed darker than its surroundings, whatever the
    # wash beneath it — which is what makes this work over both the white
    # paddocks and the green timber.
    lines = V < (ndi.uniform_filter(V, 9) - 0.05)
    warm = lines & (R - B > 3)

    # Named features print with a white halo; the sheet's big "COMMONWEALTH
    # LAND" overprint is bare black type straight over the ground. The halo
    # finds the first, keep_lines the second.
    near_white = (V > 0.88) & (S < 0.08)
    haloed = ndi.uniform_filter(near_white.astype(np.float32), 9) > 0.55
    dark_ink = ndi.binary_erosion(V < 0.52, ones(3))
    typeblobs = ndi.binary_dilation(dark_ink & ~keep_lines(dark_ink, 45, 0.30), ones(7))
    lettering = ndi.binary_dilation(haloed, ones(5)) | typeblobs

    # The 1000m grid prints as full-length hairlines. Drop the rows and columns
    # it saturates, or the graticule survives as a dead-straight road.
    ink = (V < 0.62) & (B - R < 8) & ~lettering
    graticule = np.zeros_like(ink)
    graticule[ink.mean(1) > 0.45, :] = True
    graticule[:, ink.mean(0) > 0.45] = True
    graticule = ndi.binary_dilation(graticule, ones(5))

    # Vehicle tracks: 2px+ of dark ink that runs. (Contours are finer, so the
    # erosion drops them wholesale.)
    track = keep_lines(ndi.binary_erosion(ink & ~graticule, ones(2)), 45, 0.30)

    # Sealed road and the Commonwealth-land boundary are the only heavy warm
    # ink on the sheet. Only the highway runs right across it; the boundary
    # prints dashed and stays in the interior.
    heavy = keep_lines(ndi.binary_erosion((R - (G + B) / 2 > 6) & (R > B) & (V < 0.75), ones(3)), 30, 0.35)
    lab, _ = ndi.label(ndi.binary_dilation(heavy, ones(9)))
    highway = np.zeros_like(heavy)
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        if sl is None:
            continue
        ys, xs = sl
        if (xs.stop - xs.start) > 400 and (ys.start + ys.stop) / 2 < H * 0.55:
            highway |= lab == i
    highway &= heavy
    boundary = heavy & ~highway

    # Contours are the only elevation signal a raster sheet carries. Type and
    # the graticule both pick up a warm JPEG fringe; left in, they would read
    # as steep ground in the relief shading below.
    contour = warm & (V > 0.50) & ~lettering & ~graticule

    # Dark ink on pale ground picks up a blue JPEG fringe, so keep drainage
    # clear of it rather than painting a phantom creek along every road. The
    # sector boundary is a broad lavender band: both it and drainage read as
    # "blue" on a scan, but only the boundary carries red with it.
    fringe = ndi.binary_dilation(V < 0.55, ones(5))
    sector = ndi.binary_erosion((B - G > 5) & (R - G > 0) & (V > 0.45) & ~fringe, ones(5))
    water = (B - (R + G) / 2 > 7) & (B - G > 1) & (R <= G + 3) & (V > 0.45) & ~fringe & ~lettering

    # ------------------------------------------------------- to the grid ---
    YS = (np.arange(OUT_H + 1) * H / OUT_H).astype(int)
    XS = (np.arange(OUT_W + 1) * W / OUT_W).astype(int)
    AREA = np.diff(YS)[:, None] * np.diff(XS)[None, :]

    def reduce_sum(a):
        rows = np.add.reduceat(a.astype(np.float32), YS[:-1], axis=0)[:OUT_H]
        return np.add.reduceat(rows, XS[:-1], axis=1)[:, :OUT_W]

    cover = lambda m: reduce_sum(m) / AREA

    # The wash is averaged over NON-line pixels only: dense contour hatching in
    # the steep country would otherwise wash its timber out to pale.
    fill = ~lines
    fill_area = np.maximum(reduce_sum(fill), 1.0)
    vg = ndi.uniform_filter(reduce_sum((G - (R + B) / 2) * fill) / fill_area, size=7)

    wt, tk = cover(water), cover(track)
    hw, bd, sc = cover(highway), cover(boundary), cover(sector)
    relief = ndi.uniform_filter(cover(contour), size=9)

    # ---------------------------------------------------------- palette ---
    P = {k: np.array(v, np.float32) for k, v in {
        'deep':     (0x5c, 0x8a, 0x55),   # dense timber on the steep country
        'forest':   (0x6d, 0x9a, 0x5e),   # medium woodland
        'open':     (0x89, 0xab, 0x68),   # open forest / scattered trees
        'grass':    (0xa4, 0xb8, 0x6e),   # grazed grass
        'cleared':  (0xc0, 0xbb, 0x74),   # cleared paddock — the training flats
        'ridge':    (0xad, 0x8a, 0x63),   # broken ground
        'scarp':    (0x9c, 0x7d, 0x68),   # steep scarp / rock
        'water':    (0x4d, 0x87, 0xad),   # creeks and dams
        'track':    (0x9a, 0x81, 0x60),   # vehicle track
        'sealed':   (0xd4, 0x95, 0x57),   # sealed road
        'boundary': (0xbc, 0x86, 0xa2),   # Commonwealth-land boundary
        'sector':   (0x9c, 0x95, 0xc6),   # sector boundary
    }.items()}

    # Classify, then median-filter: vegetation is drawn with stipple symbols,
    # so without it the timber breaks up into salt-and-pepper at this scale.
    GROUND = ['cleared', 'grass', 'open', 'forest', 'deep']
    klass = ndi.median_filter(np.digitize(vg, [1.0, 5.5, 10.0, 14.5]), size=5)
    img = np.empty((OUT_H, OUT_W, 3), np.float32)
    for i, key in enumerate(GROUND):
        img[klass == i] = P[key]

    # Relief: warm and darken the steep country in proportion to contour
    # density. Kept light — the territory hatch is drawn over this and has to
    # stay readable.
    steep = np.clip((relief - 0.11) / 0.09, 0, 1)[:, :, None]
    img = img * (1 - steep * 0.34) + P['ridge'] * (steep * 0.34)
    crest = np.clip((relief - 0.20) / 0.07, 0, 1)[:, :, None]
    img = img * (1 - crest * 0.34) + P['scarp'] * (crest * 0.34)

    img[ndi.median_filter(wt, size=3) > 0.12] = P['water']
    img[tk > 0.16] = P['track']
    img[sc > 0.30] = P['sector']
    img[bd > 0.16] = P['boundary']
    img[hw > 0.14] = P['sealed']
    return img.round().clip(0, 255).astype(np.uint8)


if __name__ == '__main__':
    src = sys.argv[1] if len(sys.argv) > 1 else 'Areas_8__9.pdf'
    dst = sys.argv[2] if len(sys.argv) > 2 else 'singleton.png'
    Image.fromarray(derive(load_sheet(src))).save(dst)
    print(f'wrote {dst} ({OUT_W}x{OUT_H})')
