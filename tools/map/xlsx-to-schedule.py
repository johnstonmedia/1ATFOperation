"""Turn the camp plan workbook into the map's activity schedule.

Output is src/data/singleton-schedule.json: who is at which zone, in which
session, across the four camp days. That drives the zone progress on the map —
the unit view's "33% · ALPHA BEEN THERE", the per-company view, and the
generated per-day campaign frames.

SOURCE: the "AA+NL Timetable" sheet, which holds two grids.
  * Nightlocs  rows 4-10, one column per DAY (Sunday..Wednesday).
  * Activity areas  rows 14-28, one column per SESSION - the days are split
    into Afternoon/Night (Sunday) and Morning/Afternoon/Night (Mon-Wed), 11 in
    all. The day header row is sparse (a day name sits over its first session
    only), so the session columns are read from the SECOND header row and
    attributed to the most recent day named above them.

CAMP DAYS come from the master sheet: Day 1 SUN 20SEP26 .. Day 4 WED 23SEP26.
Days -1 and 0 are advance party and carry no activities.

⚠️ THIS SCRIPT REFUSES TO GUESS. A cell that is not a recognisable company is
reported by name and skipped, never silently dropped - that is how a real
allocation would go missing without anyone noticing. The sheet legitimately
contains non-company cells ("Off Limits", "RECSPECS", planning notes), so the
run always prints what it ignored for a human to check.

Usage:
    pip install openpyxl
    python3 tools/map/xlsx-to-schedule.py BIV26_CAMP_PLAN.xlsx
"""
import json
import pathlib
import re
import sys

import openpyxl

HERE = pathlib.Path(__file__).resolve().parent
DEFAULT_OUT = HERE.parent.parent / 'src' / 'data' / 'singleton-schedule.json'
SHEET = 'AA+NL Timetable 04.09'

# Camp days, from the master sheet's own day headers.
DAYS = [
    {'n': 1, 'weekday': 'Sunday',    'label': 'Day 1', 'date': 'SUN 20 SEP'},
    {'n': 2, 'weekday': 'Monday',    'label': 'Day 2', 'date': 'MON 21 SEP'},
    {'n': 3, 'weekday': 'Tuesday',   'label': 'Day 3', 'date': 'TUE 22 SEP'},
    {'n': 4, 'weekday': 'Wednesday', 'label': 'Day 4', 'date': 'WED 23 SEP'},
]
WEEKDAY_TO_DAY = {d['weekday']: d['n'] for d in DAYS}

COMPANIES = {'alpha': 'A', 'bravo': 'B', 'charlie': 'C', 'delta': 'D',
             'echo': 'E', 'support': 'S',
             # The sheet's own typos, mapped rather than lost.
             'ssupport': 'S', 'e coy': 'E', 'spt': 'S'}

# Sheet row label -> zone id in src/data/singleton-zones.json. The names are
# not identical on both sides (the sheet writes "Juliett", Earth "AA Juliet";
# the sheet's "Ropes" activity is Earth's "High Ropes", which is a DIFFERENT
# place from its "NL Ropes" night location), so the mapping is explicit.
AA_ZONES = {
    'navex': 'navex', 'quarry': 'quarry', 'ropes': 'high-ropes', 'pios': 'aa-pios',
    'foxtrot': 'aa-foxtrot', 'golf': 'aa-golf', 'hotel': 'aa-hotel',
    'india': 'aa-india', 'juliett': 'aa-juliet', 'juliet': 'aa-juliet',
    'kilo': 'aa-kilo', 'lima': 'aa-lima', 'mike': 'aa-mike',
    'november': 'aa-november', 'oscar': 'aa-oscar', 'papa': 'aa-papa',
}
NL_ZONES = {
    '1 - ropes': 'nl-ropes', '2 - romeo': 'nl-romeo', '3 - hilltop': 'nl-hilltop',
    '4 - mountainview': 'nl-mountain-view', '5 - outpost': 'nl-outpost',
    '6 - oakley lane': 'nl-oakley-lane', '7 - support': 's-coy-nl',
}

ignored = []


def companies(cell, where):
    """Company letters in a cell. 'Alpha & Support' is two; anything the sheet
    uses for something else is reported and skipped."""
    if not cell:
        return []
    out = []
    for part in re.split(r'[&,/]| and ', str(cell)):
        key = part.strip().lower()
        if not key:
            continue
        if key in COMPANIES:
            out.append(COMPANIES[key])
        else:
            ignored.append(f'{where}: "{part.strip()}"')
    return sorted(set(out))


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else 'BIV26_CAMP_PLAN.xlsx'
    dst = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUT
    ws = openpyxl.load_workbook(src, data_only=True)[SHEET]
    grid = [['' if v is None else str(v).replace('\n', ' ').strip()
             for v in row] for row in ws.iter_rows(values_only=True)]
    cell = lambda r, c: grid[r - 1][c - 1] if r - 1 < len(grid) and c - 1 < len(grid[r - 1]) else ''

    # --- sessions, from the two header rows ------------------------------
    sessions, day = [], None
    for c in range(2, 14):
        head, part = cell(12, c), cell(13, c)
        if head in WEEKDAY_TO_DAY:
            day = WEEKDAY_TO_DAY[head]
        if part and day:
            sessions.append({'id': f'd{day}-{part.lower()}', 'day': day,
                             'part': part, 'col': c,
                             'label': f'Day {day} · {part}'})
    print(f'{len(sessions)} sessions: ' + ', '.join(s['id'] for s in sessions))

    visits = []

    # --- activity areas, one row each, one column per session ------------
    for r in range(14, 29):
        name = cell(r, 1).lower()
        if not name:
            continue
        zone = AA_ZONES.get(name)
        if not zone:
            ignored.append(f'row {r}: unknown activity area "{cell(r, 1)}"')
            continue
        for s in sessions:
            for co in companies(cell(r, s['col']), f'{cell(r, 1)} / {s["id"]}'):
                visits.append({'zone': zone, 'session': s['id'], 'day': s['day'], 'company': co})

    # --- night locations, one row each, one column per DAY ----------------
    # A night location is held for the whole of its day, so it lands on that
    # day's LAST session rather than being spread across all of them.
    last_of_day = {d['n']: [s for s in sessions if s['day'] == d['n']][-1]['id'] for d in DAYS
                   if any(s['day'] == d['n'] for s in sessions)}
    for r in range(4, 11):
        name = cell(r, 1).lower()
        zone = NL_ZONES.get(name)
        if not zone:
            if name:
                ignored.append(f'row {r}: unknown night location "{cell(r, 1)}"')
            continue
        for c, d in enumerate(DAYS, start=2):
            for co in companies(cell(r, c), f'{cell(r, 1)} / {d["weekday"]}'):
                visits.append({'zone': zone, 'session': last_of_day[d['n']],
                               'day': d['n'], 'company': co, 'night': True})

    order = {s['id']: i for i, s in enumerate(sessions)}
    visits.sort(key=lambda v: (order[v['session']], v['zone'], v['company']))

    doc = {
        'about': ('Camp activity schedule from the BIV26 plan workbook. Who is at which '
                  'zone in which session, keyed to zone ids in singleton-zones.json. '
                  'Produced by tools/map/xlsx-to-schedule.py.'),
        'days': [{k: d[k] for k in ('n', 'label', 'date', 'weekday')} for d in DAYS],
        'sessions': [{k: s[k] for k in ('id', 'day', 'part', 'label')} for s in sessions],
        'visits': visits,
    }
    dst.write_text(json.dumps(doc, indent=1) + '\n')

    zones = sorted({v['zone'] for v in visits})
    print(f'{len(visits)} visits across {len(zones)} zones')
    if ignored:
        print(f'\nIGNORED {len(ignored)} non-company cells — check none of these should have counted:')
        for x in sorted(set(ignored)):
            print('   ', x)
    print('\nwrote', dst)


if __name__ == '__main__':
    main()
