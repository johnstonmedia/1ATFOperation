"""Build public/map/singleton.webp: Sentinel-2 satellite imagery of Areas 8 & 9,
with the training area's own boundaries drawn over it.

THE BASE IS REAL IMAGERY, NOT A STYLISATION. The previous version of this map
re-drew the AUSPEC0196 topo sheet as flat pixel art; this one uses Copernicus
Sentinel-2 true-colour of the actual ground and leaves it alone apart from one
display stretch (see STRETCH below). Nothing is recoloured, redrawn or
classified.

WHY THIS LINES UP. The frame is a Web Mercator rectangle (see MERC_* below)
covering the AUSPEC0196 sheet, and the Sentinel scene is reprojected onto
exactly that rectangle. The same frame is what the SIX Maps tile layer and the
traced boundary overlay are drawn into, so imagery, tiles, boundaries and the
territory grid all register with no further alignment.

NOTHING IS DRAWN ON THE IMAGERY. This produces bare pixels, and everything
else is a runtime layer over the top:

    boundaries   MapLines.jsx, from tools/map/singleton-boundaries.json
    named ground territory places in src/firebase/seed.js
    territory    the hatch canvas in terrainRender.js

The boundaries used to be burned in here. They moved out when the live basemap
became SIX Maps tiles, for a simple reason: tiles render OVER this image, so
anything baked into it disappears the moment they load. As vectors they also
stay hairline-crisp at any zoom instead of turning into 40px yellow mush.

Note this image is now the FALLBACK, not the normal view - it is what shows
before tiles load, and all that shows if they never do. An earlier version
drew the sheet's whole extracted road network on it; dropped, because the
extraction breaks up wherever contours crowd, which blended into flat pixel
art but reads as dirt on the lens over 10m satellite.

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

# The map frame, in WEB MERCATOR (EPSG:3857).
#
# It used to be the paper sheet's own MGA Zone 56 rectangle, which is the
# survey-correct frame but is rotated 0.99 degrees from the Web Mercator grid
# that every XYZ tile service uses - 180 m, about 3.7 grid cells, of skew
# corner to corner. Since the live basemap is now NSW SIX Maps tiles, the
# frame moved to Mercator so tiles drop in with a pure linear transform and
# no warping. These bounds are the Mercator bounding box of the old sheet
# rectangle, grown to exactly the 216:153 cell aspect.
# Keep in step with `geo` in src/lib/maps.js - see tools/map/reframe notes.
MERC_X0, MERC_Y0 = 16823443.92, -3858211.43   # west edge, north edge
MERC_W, MERC_H = 12807.80, 9072.19

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
        transform = rasterio.transform.from_bounds(
            MERC_X0, MERC_Y0 - MERC_H, MERC_X0 + MERC_W, MERC_Y0, OUT_W, OUT_H)
        bands = np.zeros((3, OUT_H, OUT_W), np.uint8)
        for b in (1, 2, 3):
            reproject(
                source=rasterio.band(src, b), destination=bands[b - 1],
                src_transform=src.transform, src_crs=src.crs,
                dst_transform=transform, dst_crs=CRS.from_epsg(3857),
                resampling=Resampling.bilinear,
            )
    rgb = np.transpose(bands, (1, 2, 0)).astype(np.float32)
    lo = np.percentile(rgb, STRETCH_LO_PCT)
    hi = np.percentile(rgb, STRETCH_HI_PCT)
    return np.clip((rgb - lo) / max(hi - lo, 1e-6), 0, 1) ** STRETCH_GAMMA * 255.0


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dst = args[0] if args else 'singleton.webp'

    img = satellite_base()
    print(f'satellite base {OUT_W}x{OUT_H} from {SCENE.rsplit("/", 2)[1]}')

    out = Image.fromarray(img.round().clip(0, 255).astype(np.uint8))
    if str(dst).lower().endswith('.webp'):
        out.save(dst, 'WEBP', quality=WEBP_QUALITY, method=6)
    else:
        out.save(dst)
    size = pathlib.Path(dst).stat().st_size
    print(f'wrote {dst} ({OUT_W}x{OUT_H}, {size // 1024} KB)')


if __name__ == '__main__':
    main()
