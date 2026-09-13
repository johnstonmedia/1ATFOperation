"""Convert the BIV26 Google Earth project into map zones.

Output is src/data/singleton-zones.json: the camp's activity areas, night
locations and headquarters as polygons in singleton territory-grid cells, each
paired with the label point Earth drew for it.

WHY A SCRIPT AND NOT A ONE-OFF PASTE. The camp plan changes between years, and
the Earth project is where it is authored. Re-running this against next year's
export is the whole update path, so the rules for what gets imported live here
rather than in someone's memory.

WHAT IS IMPORTED, AND WHAT IS NOT
  Activity areas  yes - the 15 AAs, plus High Ropes, NAVEX and the Quarry
  NLs             yes - the 6 night locations
  Headquarters    yes - RHQ, S COY NL, the eating areas and field kitchen
  Archive         NO  - the folder is called Archive; it is superseded ground
  2021 NLs        NO  - a previous year
  Borders         NO  - the portal already has better ones. The project's
                        borders were drawn by eye in Earth; the portal's are
                        least-cost traced off the AUSPEC0196 survey sheet (see
                        trace-singleton-boundaries.py). They agree closely,
                        which is a useful cross-check, but the traced ones win.
                        Two of the Earth borders also run east past the sheet
                        edge, which the traced pair handles deliberately.

PAIRING. Earth draws each zone twice - a Polygon for the ground and a Point for
the label - and the two do NOT reliably share a name ("Regimental
Headquarters" polygon vs "RHQ" point; "NightLoc Ropes" vs "NL Ropes"). So they
are paired by CONTAINMENT: a point inside a polygon in the same folder is that
polygon's label. Name matching is only the fallback. The point's own name wins,
because it is the short form meant for a map label.

SIMPLIFICATION. Earth polygons carry far more vertices than a 216x153 grid can
express (NAVEX has 82). They are reduced with the same RDP pass the boundary
tracer uses, at a tolerance well under one cell, so the file stays small
without moving any edge visibly.

Usage:
    pip install pyproj
    python3 tools/map/kml-to-zones.py BIV26_SMTA_8_9.kml
"""
import json
import pathlib
import sys
import xml.etree.ElementTree as ET

NS = {'k': 'http://www.opengis.net/kml/2.2'}
COLS, ROWS = 216, 153
# The map frame, in Web Mercator. Keep in step with `geo.merc` in
# src/lib/maps.js - see that file for why the frame is Mercator.
MERC_X0, MERC_Y0, MERC_W, MERC_H = 16823443.92, -3858211.43, 12807.80, 9072.19

KEEP_FOLDERS = {'Activity areas': 'activity', 'NLs': 'nl', 'Headquarters': 'hq'}
RDP_EPS = 0.35          # grid cells; about 20 m on the ground
MIN_RING = 3            # below this a polygon is degenerate — see main()
HERE = pathlib.Path(__file__).resolve().parent
DEFAULT_OUT = HERE.parent.parent / 'src' / 'data' / 'singleton-zones.json'


def slug(name):
    out = ''.join(c.lower() if c.isalnum() else '-' for c in name)
    while '--' in out:
        out = out.replace('--', '-')
    return out.strip('-')


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = (dx * dx + dy * dy) ** 0.5
    def dev(p):
        if n < 1e-9:
            return ((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2) ** 0.5
        return abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / n
    i = max(range(len(pts)), key=lambda k: dev(pts[k]))
    if dev(pts[i]) <= eps:
        return [a, b]
    return rdp(pts[:i + 1], eps)[:-1] + rdp(pts[i:], eps)


def inside(pt, poly):
    """Ray cast — is the label point within this polygon?"""
    x, y = pt
    hit = False
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % len(poly)]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) / (y2 - y1) * (x2 - x1):
            hit = not hit
    return hit


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else 'BIV26_SMTA_8_9.kml'
    dst = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUT
    from pyproj import Transformer
    ll2m = Transformer.from_crs(4326, 3857, always_xy=True)

    def cell(lon, lat):
        mx, my = ll2m.transform(float(lon), float(lat))
        return [round((mx - MERC_X0) / MERC_W * COLS, 2),
                round((MERC_Y0 - my) / MERC_H * ROWS, 2)]

    def txt(e, p):
        n = e.find(p, NS)
        return (n.text or '').strip() if n is not None else ''

    def walk(el, folder):
        for c in el:
            tag = c.tag.split('}')[-1]
            if tag == 'Document':
                yield from walk(c, folder)
            elif tag == 'Folder':
                yield from walk(c, txt(c, 'k:name') or folder)
            elif tag == 'Placemark':
                name = txt(c, 'k:name') or '(unnamed)'
                pt = txt(c, 'k:Point/k:coordinates')
                poly = txt(c, 'k:Polygon/k:outerBoundaryIs/k:LinearRing/k:coordinates')
                if pt:
                    yield folder, name, 'point', [cell(*pt.split(',')[:2])]
                if poly:
                    yield folder, name, 'polygon', [cell(*p.split(',')[:2]) for p in poly.split()]

    rows = [r for r in walk(ET.parse(src).getroot(), '(root)') if r[0] in KEEP_FOLDERS]
    zones = []
    for folder, kind in KEEP_FOLDERS.items():
        polys = [(n, p) for f, n, t, p in rows if f == folder and t == 'polygon']
        points = [(n, p[0]) for f, n, t, p in rows if f == folder and t == 'point']
        used = set()
        for pname, poly in polys:
            label, lname = None, pname
            for i, (nm, pt) in enumerate(points):
                if i not in used and inside(pt, poly):
                    label, lname, _ = pt, nm, used.add(i)
                    break
            else:                                   # no containment hit
                for i, (nm, pt) in enumerate(points):
                    if i not in used and slug(nm) == slug(pname):
                        label, lname, _ = pt, nm, used.add(i)
                        break
            simple = rdp(poly, RDP_EPS)
            if simple[0] == simple[-1]:
                simple = simple[:-1]                # SVG closes the ring itself
            # Some ground is simply smaller than a grid cell — the eating areas
            # and field kitchen are ~20 m across against a 59 m cell, and come
            # out of simplification as one or two points. They become
            # LABEL-ONLY rather than a degenerate polygon: the map can say
            # where they are, it just can't outline them at this resolution.
            if len(simple) < 3:
                simple = []
            if label is None:                       # centroid, if Earth drew no point
                label = [round(sum(p[0] for p in simple) / len(simple), 2),
                         round(sum(p[1] for p in simple) / len(simple), 2)]
            zones.append({'id': slug(lname), 'name': lname, 'kind': kind,
                          'label': label, 'cells': simple})
        for i, (nm, pt) in enumerate(points):       # points Earth drew with no area
            if i not in used:
                zones.append({'id': slug(nm), 'name': nm, 'kind': kind,
                              'label': pt, 'cells': []})

    seen, dedup = set(), []
    for z in zones:
        if z['id'] in seen:
            z['id'] = z['id'] + '-2'
        seen.add(z['id'])
        dedup.append(z)
    dedup.sort(key=lambda z: (z['kind'], z['name'].lower()))

    about = ('Camp zones from the BIV26 Google Earth project, as polygons in singleton '
             'territory-grid cells - so a vertex is real ground. Produced by '
             'tools/map/kml-to-zones.py; read that script before regenerating. The '
             'project\'s Archive and previous-year folders are deliberately not imported, '
             'and its Borders are not either - the portal traces better ones off the '
             'AUSPEC0196 survey sheet.')
    body = ['{', ' "about": %s,' % json.dumps(about),
            ' "grid": { "cols": 216, "rows": 153 },', ' "zones": [']
    for i, z in enumerate(dedup):
        cells = '[' + ', '.join('[%g, %g]' % (x, y) for x, y in z['cells']) + ']'
        body.append('  { "id": %s, "name": %s, "kind": %s, "label": [%g, %g], "cells": %s }%s'
                    % (json.dumps(z['id']), json.dumps(z['name']), json.dumps(z['kind']),
                       z['label'][0], z['label'][1], cells, ',' if i < len(dedup) - 1 else ''))
    body += [' ]', '}']
    dst.write_text('\n'.join(body) + '\n')
    for k in KEEP_FOLDERS.values():
        n = [z for z in dedup if z['kind'] == k]
        print(f'  {k:9s} {len(n):2d} zones  ({sum(1 for z in n if not z["cells"])} label-only)')
    print('wrote', dst)


if __name__ == '__main__':
    main()
