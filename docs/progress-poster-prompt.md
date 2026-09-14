# Claude Design prompt — 1ATF camp progress posters

Paste the block below into Claude Design. It is written to match the portal's
own brand system exactly, so the poster and the site read as one thing.

**Keep this file in step with the code.** Every colour and font below is copied
from `src/index.css`, `src/firebase/seed.js` (company accents) and
`src/lib/mapLines.js` (boundary colours). If those change, change this too —
that is the whole reason the prompt is committed rather than pasted once.

**Where the map picture comes from:** Ops Centre → Map: Territory → **Export
Weekly Update Image**. That already renders the map, place names, the company
key and what changed in the window, at 1944px wide. Drop that PNG into the
artboard rather than trying to redraw the map in the poster.

**The real camp data** is committed at `src/data/singleton-schedule.json` (who
is where, when) and `src/data/singleton-zones.json` (the ground). Numbers in
the prompt below are the actual BIV26 ones, so a mock-up reads true.

---

Design a set of daily operational progress posters for a cadet unit's field
camp. They will be shown on computer screens at camp and printed at A3, so
design at **A3 portrait (3508 × 4961 px @ 300dpi)** and keep every text element
readable at A4 and on a 1080p screen.

This is the print face of an existing web portal styled like an intelligence
agency's operations console: dark, technical, high-contrast, restrained. It is
not military-cosplay and not a gaming poster — the reference points are a
situation-room display and a well-set data report.

## Brand system — use these values exactly

Background       #070b14 (deep navy-black); secondary panel ground #0a0f1d
Panel fill       rgba(16, 24, 43, 0.72) over the background, 4px corner radius
Hairlines        rgba(99, 130, 190, 0.22)
Body text        #d7e2f4      Dimmed/secondary text  #8294b5
Accent (teal)    #36e0c0  — the primary highlight; use sparingly, it carries
                            "live", "active", headings-of-consequence
Secondary accent #4ea8ff
1ATF / conquered #1e9bff  — ground the whole task force holds, i.e. a zone
                            every scheduled company has been through. Never a
                            company's colour, never decorative.
Threat red       #ff3b46  — ONLY for the opposing force ("Meridian"), never
                            for a company, never decoratively
Warn amber       #ffcf4a

Company colours (fixed, never recolour — cadets read the map by these):
  Alpha    #2e7dd1     Bravo   #1faa8b     Charlie #c9a227
  Delta    #8e54c4     Echo    #d1632e     Support #c9528a
  RHQ      #f39c12

Map line colours (match the portal's map overlay):
  Commonwealth land boundary  #ffd23c (yellow)
  Sector boundary             #46e878 (green)

Typography
  Headings      Orbitron, 700, generous letter-spacing (2–4px on small caps)
  Body          Rajdhani
  Data / labels JetBrains Mono, uppercase, 1px letter-spacing
  Never use a fourth family. Numerals in data positions are always mono.

Texture: territory on the map is filled with a 45° diagonal hatch in the
owner's colour at ~48% opacity, not a flat wash. If you draw any swatch,
chip or progress fill in the poster, use that same diagonal hatch so it
matches the map — a flat block will look like a different system.

## Poster anatomy, top to bottom

1. **Header band.** "1ATF" in Orbitron at large size, with "1st Australian Task
   Force" beside it in dimmed text. Right-aligned: a mono block with the day
   and date. A thin teal rule under the band.
   The camp is **four days**: Day 1 SUN 20 SEP, Day 2 MON 21 SEP, Day 3 TUE
   22 SEP, Day 4 WED 23 SEP — so the day counter reads `DAY 2 / 4`, and there
   is a fifth "camp start" sheet before them all.
2. **Status line.** One mono line, uppercase, small: the operation name and a
   live tag (a small teal dot + `LIVE OPERATIONAL PICTURE`).
3. **The map.** The dominant element — roughly 55% of the poster height. Inset
   it in a panel with a hairline border and a 4px radius. Do not crop the
   map's own legend off. Leave a small mono caption under it for the imagery
   credit line supplied with the export.
4. **Progress strip.** A row of zone cards — one per activity area. Each card:
   zone name in Orbitron small-caps, a hatched progress bar, a percentage in
   mono, and small company chips showing who has been through. See the two
   variants below for what the percentage means.

   The real activity areas are: AA Foxtrot, AA Golf, AA Hotel, AA India, AA Juliet, AA Kilo, AA Lima, AA Mike, AA NOVEMBER, AA Oscar, AA Papa, AA Pios, High Ropes, NAVEX, Quarry.
   The night locations are: NL Hilltop, NL Mountain View, NL Oakley Lane, NL Outpost, NL Romeo, NL Ropes, S COY NL.
   A poster does not need all of them on one sheet — the busiest are NAVEX
   (5 companies, 13 sessions) and High Ropes (all 6 companies), and those two
   carry the story.
5. **Company standings.** A compact table or row of tiles, one per company, in
   that company's colour: areas completed, ground held. Mono numerals.
6. **Footer.** The unit motto `LUCET PER MINISTERIUM` in small mono on the
   left, a page/sheet reference on the right, hairline above.

## ONE POSTER PER DAY — there is no per-company variant

⚠️ This is the rule the whole set hangs on, and an earlier draft of this prompt
got it wrong. **There is one map and it is the unit's.** Do not design a
per-company poster; do not tint a sheet in a company's colour; do not show a
cadet only their own company's ground. Six cuts of one camp is six things to
keep in step, and it argues against the thing the poster is for.

Every zone card shows COLLECTIVE progress: of the companies the plan sends to
that zone, how many have actually been through.

**The 1ATF rule — the point of the whole design.** A zone is NOT conquered
until EVERY company scheduled there has been through it. Below 100% the zone
belongs to whichever company got there FIRST, and the card carries that
company's colour with the others' chips as empty outlines. At 100% the ground
stops being any one company's: it becomes **1ATF's**, drawn in assure-blue
`#1e9bff` and labelled `1ATF`, not with a company name. That flip — many
colours resolving into one — is the visual argument of the series, so make it
unmistakable: the card changes colour, the chips all fill, the label changes
from a company to `1ATF`.

The worked example is **High Ropes**, which all six companies pass through:
`17% → 50% → 83% → 100%` across the four days, and only on the last of those
does it turn 1ATF blue.

## Rules

- Every number on the poster is a placeholder to be swapped per day — mark them
  clearly and keep them in mono so substitution never changes the layout.
- Nothing decorative in threat red. It means one thing.
- No drop shadows, no gradients on text, no faux-3D. Flat, dark, precise.
- Generous margins; this is a wall poster read from two metres as well as a
  screen read from fifty centimetres. The day number and the map must be
  legible at a glance from across a room.
- Provide the empty "camp start" state too: the map with only the sector
  boundaries and RHQ, every zone card at 0%. Camp genuinely starts from an
  empty board and that first poster sets the expectation.
- The total across camp is **86 activity slots over 22 zones**, so the headline
  figure is "N of 86". Size the headline numerals for two digits over three.

## The five sheets, with the real numbers

These are the actual BIV26 figures, computed from the committed plan. Use them
as the placeholder content so a mock-up reads true rather than inventing data.

| Sheet | Headline | Zones touched | Zones 1ATF-complete |
|---|---|---|---|
| CAMP START | 0% — 0 of 86 | 0 / 22 | 0 / 22 |
| DAY 1 · SUN 20 SEP | 21% — 18 of 86 | 15 / 22 | 2 / 22 |
| DAY 2 · MON 21 SEP | 49% — 42 of 86 | 19 / 22 | 4 / 22 |
| DAY 3 · TUE 22 SEP | 71% — 61 of 86 | 20 / 22 | 12 / 22 |
| DAY 4 · WED 23 SEP | 100% — 86 of 86 | 22 / 22 | 22 / 22 |

Note the shape of that last column — 2, 4, 12, 22. Almost nothing completes
early and then it resolves in a rush. The set should feel like that: three
sheets of many colours advancing, then a final sheet that is almost entirely
1ATF blue. Design the Day 4 poster to land as the payoff, not as one more
increment.

Who goes where, for the cards that carry the story:

    High Ropes    A B C D E S   (all six — the headline zone)
    NAVEX         A B C D S     (5 companies, 13 sessions — the busiest)
    AA India      A B C D
    AA Juliet     A B C D
    AA Pios       A B C D
    AA Lima       A C D
    AA November   A C S
    AA Papa       B C D
    AA Kilo       B C E
    AA Foxtrot    D E
    AA Golf       D E
    AA Hotel      E          AA Mike  E     AA Oscar  E     Quarry  E
    NL Hilltop    A B        NL Mountain View  C D
    NL Outpost    A E        NL Romeo          C D
    NL Ropes      B          NL Oakley Lane    E
    S COY NL      S          (headquarters ground, not an activity)

A single-company zone (AA Hotel, AA Mike, Quarry…) is 0% or 100% with nothing
in between — it flips to 1ATF blue the moment Echo has been. Don't design the
card assuming a gradual fill; several of them have exactly two states.
