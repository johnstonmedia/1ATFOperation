"""Trace the Areas 8 & 9 boundaries off the AUSPEC0196 sheet into polylines.

Output is tools/map/singleton-boundaries.json: the Commonwealth-land boundary
(in two halves, because it leaves the sheet on the east side) and the Sector
8/9 boundary, as vertices in singleton territory-grid cells.

WHY TRACE RATHER THAN MASK. derive-singleton-map.py classifies the whole sheet
by ink colour, which is the right tool for area classes but produces a boundary
that is broken wherever the line crosses crowded contours, dashes through a
label, or prints faintly. Drawn over 10m satellite imagery that fragmentation
reads as dirt on the lens. A boundary is also the one feature where the shape
matters more than the pixels: two clean closed lines say "this is the training
area" in a way a stippled mask never does.

HOW IT WORKS. The line is found, not drawn by hand: a coarse list of seed
points read off the sheet is snapped to the nearest boundary ink, and each
consecutive pair is joined by a LEAST-COST PATH whose cost rises with distance
from ink. The path therefore follows the printed line exactly wherever the line
exists, and bridges the gaps in a straight run where it doesn't. Seeds only
have to be within a cell or two of the truth; the routing does the accuracy.
That is why the seed lists below are short and round-numbered.

TWO INK TIERS. `strict` is the heavy dark maroon the boundary prints in, which
is nearly free of contours and is what the router wants to sit on. `loose`
catches the same line where it prints faintly, at cost 3 — enough to be
preferred over open ground but not over a solid line. Without the loose tier
the router cut the corner at the south-west turn (cell ~92, 124), where the
sheet's ink thins out for about 15 cells.

The georeference (src/lib/maps.js `geo`) is what makes the output useful
beyond this one image: the vertices are grid cells, so they are real ground.

Usage:
    pip install pillow numpy scipy scikit-image pymupdf
    python3 tools/map/trace-singleton-boundaries.py Areas_8__9.pdf
"""
import importlib.util
import json
import pathlib
import sys

import numpy as np
from scipy import ndimage as ndi
from skimage.graph import route_through_array

W, H = 1080, 765          # the frame the map art is built in
CELL = 5.0                # output px per territory cell (216 x 153 grid)
COLS, ROWS = 216, 153

HERE = pathlib.Path(__file__).resolve().parent

# Seeds, in grid cells, read off the sheet. Order is the order of the line.
# North half: the north-west corner on the New England Highway, then east
# along the highway and the Main Northern railway to the edge of the sheet.
DEFENCE_N = [
    (32.5, 42.0), (33.5, 39.5), (35.5, 35.5), (38, 30.5), (42, 28), (48, 25),
    (56, 25), (64, 26), (72, 26), (80, 24.5), (90, 23.3), (100, 24), (110, 26),
    (120, 27.6), (130, 29.2), (140, 30.6), (146, 33), (152, 38.5), (158, 44.5),
    (164, 49.5), (170, 53), (178, 56.5), (186, 59), (194, 61.5), (202, 64),
    (210, 66.5), (215.6, 68.0),
]
# South half: back in at the east edge, west along the range boundary, round
# the southern lobe, and north up the western boundary to the same corner.
DEFENCE_S = [
    (215.6, 94.3), (208, 93.2), (200, 92), (192, 90.7), (184, 89.5), (176, 88.3),
    (168, 87), (165, 85), (161, 81.5), (157, 77.8), (153, 77.3), (149, 78.3),
    (145, 80.8), (141, 80.7), (137, 80.0), (134, 79.6), (130.0, 79.2),
    (129.2, 82.5), (128.4, 86.0), (131, 86.4), (134.5, 87.1), (131.5, 108),
    (127.6, 130.0), (120, 128.2), (110, 126.5), (104, 125.9), (97.0, 125.2),
    (92.4, 124.2), (93.9, 118.6), (94.6, 111.7), (89.0, 110.7), (83.4, 109.6),
    (84.0, 100.0), (82.0, 99.4), (81.8, 93.3), (75, 93.2), (68, 93.4),
    (60, 92.8), (54.3, 91.2), (43.0, 90.7), (42.9, 87.0), (37.2, 86.8),
    (34, 83), (31.6, 78), (31.6, 73.4), (34, 71.5), (37.7, 68.9), (37.7, 60),
    (37.7, 56.3), (34, 55.2), (32.1, 55.0), (32.3, 50), (32.5, 45.0), (32.5, 42.0),
]
# Sector boundary: Sector 8 west of it, Sector 9 east. From the northern
# boundary down to the corner where the Defence boundary turns south.
SECTOR = [
    (122.8, 29.1), (122.2, 30.8), (122.6, 33.5), (123.6, 35.9), (124.3, 38.4),
    (124.6, 39.9), (124.3, 42.0), (124.2, 45.2), (124.6, 48.5), (125.2, 54.6),
    (126.2, 60), (127.1, 65.1), (128.0, 70), (128.7, 75.7), (129.9, 79.2),
]


def load_sheet(path):
    spec = importlib.util.spec_from_file_location('derive', HERE / 'derive-singleton-map.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.load_sheet(path)


def ink_tiers(im):
    """(strict, loose) boundary-ink masks, at the sheet's own resolution."""
    R, G, B = im[..., 0], im[..., 1], im[..., 2]
    V = im.max(2) / 255.0
    strict = ndi.binary_closing((V < 0.45) & ((R - G) > 8), np.ones((3, 3), bool))
    # Keep only runs long enough to be a line; drops stipple, dots and type.
    lab, n = ndi.label(ndi.binary_dilation(strict, np.ones((9, 9), bool)))
    if n:
        big = np.zeros(n + 1, bool)
        big[1:] = ndi.sum(strict, lab, range(1, n + 1)) >= 120
        strict &= big[lab]
    loose = ndi.binary_closing((V < 0.58) & ((R - G) > 6), np.ones((3, 3), bool))
    return strict, loose


def pool(mask):
    """Down-sample a sheet-resolution mask to the output frame, keeping 1px lines."""
    sh, sw = mask.shape
    yy = np.arange(sh) * H // sh
    xx = np.arange(sw) * W // sw
    out = np.zeros((H, W), bool)
    np.logical_or.at(out, (yy[:, None].repeat(sw, 1)[mask], xx[None, :].repeat(sh, 0)[mask]), True)
    return out


def smooth(p, k=7):
    if len(p) < k:
        return p
    ker = np.ones(k) / k
    pad = np.vstack([np.repeat(p[:1], k // 2, 0), p, np.repeat(p[-1:], k // 2, 0)])
    return np.stack([np.convolve(pad[:, i], ker, 'valid') for i in (0, 1)], 1)


def rdp(pts, eps):
    """Ramer-Douglas-Peucker: drop vertices that say nothing about the shape."""
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    d = b - a
    n = np.hypot(*d)
    dev = (np.hypot(*(pts - a).T) if n < 1e-9
           else np.abs((pts - a)[:, 1] * d[0] - (pts - a)[:, 0] * d[1]) / n)
    i = int(np.argmax(dev))
    if dev[i] <= eps:
        return np.array([a, b])
    return np.vstack([rdp(pts[:i + 1], eps)[:-1], rdp(pts[i:], eps)])


def extend_to_edge(poly, at_end, edge=float(COLS)):
    """Carry an end that stops short of the east frame edge out to it."""
    seq = poly[::-1] if at_end else poly
    b = seq[0]
    a = next((q for q in seq[1:] if abs(q[0] - b[0]) >= 5), seq[min(3, len(seq) - 1)])
    dx = b[0] - a[0]
    if abs(dx) < 1e-6 or (b[0] - edge) * dx >= 0:
        return poly
    t = (edge - b[0]) / dx
    pt = [round(edge, 2), round(b[1] + (b[1] - a[1]) * t, 2)]
    return poly + [pt] if at_end else [pt] + poly


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else 'Areas_8__9.pdf'
    dst = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / 'singleton-boundaries.json'

    strict, loose = ink_tiers(load_sheet(src))
    ink, faint = pool(strict), pool(loose)
    dist = ndi.distance_transform_edt(~ink)
    cost = 1.0 + np.clip(dist, 0, 40) ** 2 * 2.0
    cost[faint & ~ink] = 3.0

    def snap(pt, r=14):
        x, y = int(round(pt[0] * CELL)), int(round(pt[1] * CELL))
        y0, y1 = max(0, y - r), min(H, y + r + 1)
        x0, x1 = max(0, x - r), min(W, x + r + 1)
        sub = ink[y0:y1, x0:x1]
        if not sub.any():
            return (y, x)
        yy, xx = np.nonzero(sub)
        i = int(np.argmin((yy + y0 - y) ** 2 + (xx + x0 - x) ** 2))
        return (int(yy[i] + y0), int(xx[i] + x0))

    def trace(seeds):
        pts = [snap(p) for p in seeds]
        path = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            if a == b:
                continue
            seg, _ = route_through_array(cost, a, b, fully_connected=True, geometric=True)
            path.extend(seg[1:])
        simple = rdp(smooth(np.array(path, float)), 1.2)
        return [[round(x / CELL, 2), round(y / CELL, 2)] for y, x in simple]

    lines = {'defence_n': trace(DEFENCE_N), 'defence_s': trace(DEFENCE_S), 'sector': trace(SECTOR)}
    lines['defence_n'] = extend_to_edge(lines['defence_n'], True)
    lines['defence_s'] = extend_to_edge(lines['defence_s'], False)
    for k, v in lines.items():
        print(f'{k:10s} {len(v):3d} vertices')

    doc = json.loads(dst.read_text()) if dst.exists() else {}
    doc['lines'] = lines
    def pts(v):
        return '[' + ', '.join('[%g, %g]' % (a, b) for a, b in v) + ']'
    body = ['{', ' "about": %s,' % json.dumps(doc.get('about', '')),
            ' "grid": { "cols": %d, "rows": %d },' % (COLS, ROWS), ' "lines": {']
    ks = list(lines)
    body += ['  "%s": %s%s' % (k, pts(lines[k]), ',' if i < len(ks) - 1 else '')
             for i, k in enumerate(ks)]
    body.append(' },')
    notes = doc.get('notes', {})
    nk = list(notes)
    body.append(' "notes": {')
    body += ['  "%s": %s%s' % (k, json.dumps(notes[k]), ',' if i < len(nk) - 1 else '')
             for i, k in enumerate(nk)]
    body += [' }', '}']
    dst.write_text('\n'.join(body) + '\n')
    print('wrote', dst)


if __name__ == '__main__':
    main()
