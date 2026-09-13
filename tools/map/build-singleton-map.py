"""Build public/map/singleton.webp: Sentinel-2 satellite imagery of Areas 8 & 9,
with the training area's own boundaries drawn over it.

THE BASE IS REAL IMAGERY, NOT A STYLISATION. The previous version of this map
re-drew the AUSPEC0196 topo sheet as flat pixel art; this one uses Copernicus
Sentinel-2 true-colour of the actual ground and leaves it alone apart from one
display stretch (see STRETCH below). Nothing is recoloured, redrawn or
classified.

WHY THIS LINES UP. The sheet prints a 1000m MGA Zone 56 grid, which georeferences
it exactly (see `geo` in src/lib/maps.js): E 324739-335223, N 6370773-6378195.
The Sentinel scene is cut to those same bounds and resampled onto the same
frame, so the imagery and the sheet-derived overlay register to each other and
to the territory grid with no further alignment.

WHAT IS DRAWN, AND WHAT IS NOT. Imagery shows the ground: the highway, the
rail corridor, the paddock tracks and the cleared road lines are all legible in
the base, so none of them are drawn on. What imagery cannot show is the
ADMINISTRATIVE detail - which ground is Defence land, and where Sector 8 ends
and Sector 9 begins. That is what the overlay carries, and only that:

    yellow   Commonwealth land boundary - the perimeter of Areas 8 & 9
    green    Sector boundary - Sector 8 west of it, Sector 9 east

Both come from tools/map/singleton-boundaries.json, traced off the sheet by
trace-singleton-boundaries.py; read that script before regenerating them. An
earlier version instead drew the sheet's whole extracted road network over the
imagery. It was dropped: the extraction breaks up wherever contours crowd, and
that fragmentation blended into flat pixel art but reads as dirt on the lens
over 10m satellite. Two clean lines say "this is the training area"; a
stippled mask of every track does not.

Named ground (Ex Admin Area, the AAs, the ropes courses) is NOT drawn here
either - it is territory places in src/firebase/seed.js, so RHQ can move and
rename it without regenerating the art.

DATA + LICENCE
  Imagery    : Copernicus Sentinel-2 L2A true colour (band TCI), 10 m, from the
               AWS Open Data registry. Free and open under the Copernicus
               licence; attribute as "Contains modified Copernicus Sentinel
               data".
  Boundaries : AUSPEC0196 Singleton Range Special.

Usage:
    pip install pillow numpy scipy rasterio
    python3 tools/map/build-singleton-map.py public/map/singleton.webp
"""
import json
import os
import pathlib
import sys

os.environ.setdefault('GDAL_DISABLE_READDIR_ON_OPEN', 'EMPTY_DIR')
os.environ.setdefault('AWS_NO_SIGN_REQUEST', 'YES')
os.environ.setdefault('CPL_VSIL_CURL_ALLOWED_EXTENSIONS', '.tif')

import numpy as np
from PIL import Image, ImageDraw

# The sheet's extent in MGA94 zone 56 (EPSG:28356), from its printed grid.
E_MIN, E_MAX = 324739.0, 335223.0
N_MIN, N_MAX = 6370773.0, 6378195.0

# 216 x 153 territory cells at 5px each. 1080px across 10.48km is 9.7 m/px,
# which is as close to Sentinel's native 10m as the cell grid allows - so the
# imagery is neither upscaled into mush nor thrown away.
OUT_W, OUT_H = 1080, 765

# A cloud-free scene over MGRS square 56HLJ. Re-pick from the bucket listing
# (prefix sentinel-s2-l2a-cogs/56/H/LJ/) if a better one lands; each scene's
# sibling .json carries `eo:cloud_cover`.
SCENE = ('https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/'
         '56/H/LJ/2026/8/S2B_56HLJ_20260831_0_L2A/TCI.tif')

# Sentinel L2A true colour is encoded dark - vegetated land sits around 12% of
# the range, which is unreadable on a dark page. This is the ONE adjustment
# made to the imagery: a single linear stretch between the 1st and 99th
# percentile with a mild gamma, applied identically to all three channels so
# the colour ratios are untouched. (Stretching channels independently is what
# threw a magenta cast in an early attempt - don't.)
STRETCH_LO_PCT, STRETCH_HI_PCT, STRETCH_GAMMA = 1.0, 99.0, 0.90

# The art ships as WebP, not PNG. Photography does not deflate: the same frame
# is 1.4 MB as a PNG and 340 KB at WEBP_QUALITY, and this is the first thing
# the home page loads for anyone on the Singleton map, often on unit-camp
# mobile data. Quality 92 leaves the boundary lines clean - the one detail in
# the frame a lossy codec could plausibly hurt.
WEBP_QUALITY = 92

HERE = pathlib.Path(__file__).resolve().parent


def satellite_base():
    """Sentinel-2 true colour, cut to the sheet's bounds and display-stretched."""
    import rasterio
    from rasterio.crs import CRS
    from rasterio.warp import reproject, Resampling

    with rasterio.open(SCENE) as src:
        transform = rasterio.transform.from_bounds(E_MIN, N_MIN, E_MAX, N_MAX, OUT_W, OUT_H)
        bands = np.zeros((3, OUT_H, OUT_W), np.uint8)
        for b in (1, 2, 3):
            reproject(
                source=rasterio.band(src, b), destination=bands[b - 1],
                src_transform=src.transform, src_crs=src.crs,
                dst_transform=transform, dst_crs=CRS.from_epsg(28356),
                resampling=Resampling.bilinear,
            )
    rgb = np.transpose(bands, (1, 2, 0)).astype(np.float32)
    lo = np.percentile(rgb, STRETCH_LO_PCT)
    hi = np.percentile(rgb, STRETCH_HI_PCT)
    return np.clip((rgb - lo) / max(hi - lo, 1e-6), 0, 1) ** STRETCH_GAMMA * 255.0


BOUNDARIES = HERE / 'singleton-boundaries.json'

# 216 x 153 territory cells across OUT_W/OUT_H, so one cell is 5 output px.
CELL = OUT_W / 216.0

# Overlay style. Drawn on a 3x canvas and reduced, so the lines are smooth
# rather than stair-stepped like the imagery under them - a boundary that
# aliases reads as part of the terrain instead of as an annotation.
SUPERSAMPLE = 3
# Each line is a dark casing with a bright core, because it has to stay legible
# over both sunlit paddock and shadowed timber. Width is in output pixels.
LAYERS = [
    ('defence_n', (0x12, 0x0e, 0x04), 5.0), ('defence_s', (0x12, 0x0e, 0x04), 5.0),
    ('sector',    (0x05, 0x14, 0x0a), 4.2),
    ('defence_n', (0xff, 0xd2, 0x3c), 2.6), ('defence_s', (0xff, 0xd2, 0x3c), 2.6),
    ('sector',    (0x46, 0xe8, 0x78), 2.0),
]


def draw_boundaries(img):
    """Draw the traced Areas 8 & 9 boundaries over the imagery."""
    lines = json.loads(BOUNDARIES.read_text())['lines']
    z = SUPERSAMPLE
    over = Image.new('RGBA', (OUT_W * z, OUT_H * z), (0, 0, 0, 0))
    dr = ImageDraw.Draw(over)
    for key, colour, width in LAYERS:
        pts = [(x * CELL * z, y * CELL * z) for x, y in lines[key]]
        dr.line(pts, fill=colour + (255,), width=max(1, int(round(width * z))), joint='curve')
    over = over.resize((OUT_W, OUT_H), Image.LANCZOS)

    base = Image.fromarray(img.round().clip(0, 255).astype(np.uint8)).convert('RGBA')
    return np.array(Image.alpha_composite(base, over).convert('RGB'), np.float32)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dst = args[0] if args else 'singleton.webp'

    img = satellite_base()
    print(f'satellite base {OUT_W}x{OUT_H} from {SCENE.rsplit("/", 2)[1]}')

    if '--no-boundaries' not in sys.argv:
        img = draw_boundaries(img)
        print(f'drew boundaries from {BOUNDARIES.name}')

    out = Image.fromarray(img.round().clip(0, 255).astype(np.uint8))
    if str(dst).lower().endswith('.webp'):
        out.save(dst, 'WEBP', quality=WEBP_QUALITY, method=6)
    else:
        out.save(dst)
    size = pathlib.Path(dst).stat().st_size
    print(f'wrote {dst} ({OUT_W}x{OUT_H}, {size // 1024} KB)')


if __name__ == '__main__':
    main()
