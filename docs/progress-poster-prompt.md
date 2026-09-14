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
                            whose every scheduled VISIT has happened. Never a
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
   the kind glyph, the zone name in Orbitron small-caps, a hatched bar, and
   small company chips showing who has been through. **No percentage numeral** —
   the CARD'S COLOUR is the percentage, on the ramp below, exactly as on the
   live map.

   **HOW A ZONE SHOWS PROGRESS — pixels, not a gradient.** A zone is taken
   CELL BY CELL in proportion to the visits the camp plan schedules into it.
   NAVEX is visited 13 times across camp, so after 2 of them 2/13 of NAVEX's
   ground is painted in the 45° hatch — in the colours of the companies that
   made those two visits — and the rest is open ground. Do NOT draw a colour
   ramp, a gradient fill, or a smoothly-tinting bar: the progress bar on a card
   should read as a run of discrete hatched blocks, the same texture as the
   map, filling left to right. On the last scheduled visit the whole zone flips
   to solid **1ATF blue `#1e9bff`**. Label the card `2/13`, not `15%`.

   Fill grows from the middle of a zone outward, so a part-taken area reads as
   a patch spreading rather than a bar creeping in from an edge.

**Telling activity areas from night locations** — colour is spoken for by
progress, so kind uses three other channels, all of which survive greyscale
and colour-blindness:

  - **Activity area** — teal `#36e0c0`, solid outline, ▲ before the name.
  - **Night location** — blue `#4ea8ff`, dashed outline, ☾ before the name.
  - **Headquarters** — amber `#f39c12`, solid outline, ◆. RHQ is not ground the
    unit has to take, so it never shows conquest fill at all.

  These colours mark the OUTLINE and the name only. What is inside the outline
  is the hatch, in the colour of whichever company took that ground — so kind
  and ownership never compete for the same channel.

   The real activity areas are: AA Foxtrot, AA Golf, AA Hotel, AA India, AA Juliet, AA Kilo, AA Lima, AA Mike, AA NOVEMBER, AA Oscar, AA Papa, AA Pios, High Ropes, NAVEX, Quarry.
   Visits scheduled per zone: NAVEX 13, AA Juliet 8, AA India 7, High Ropes 6,
   AA Kilo 5, AA November / NL Hilltop / NL Mountain View / NL Outpost /
   NL Romeo / S COY NL / AA Pios 4, AA Lima / AA Papa 3, AA Golf / NL Ropes /
   AA Foxtrot / NL Oakley Lane / AA Hotel 2, AA Oscar / AA Mike / Quarry 1.
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
until every scheduled VISIT to it has happened — not until every company has
been once, because companies are booked back into the same areas repeatedly.
Until then the ground is part-taken: each completed visit has painted its own
share, in the colour of the company that made it, so a busy area is a patchwork
of company colours. On the final visit the whole zone flips to **1ATF**
assure-blue `#1e9bff` and is labelled `1ATF`, not with a company name. That
flip — a patchwork of many colours resolving into one — is the visual argument
of the series, so make it unmistakable.

The worked example is **High Ropes**: six scheduled visits, so its ground fills
a sixth at a time and it only turns 1ATF blue on the sixth. **NAVEX** is the
extreme case at 13 visits — a large area that spends the whole camp visibly
part-taken, which is exactly the point.

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
| CAMP START | 0 of 86 visits | 0 / 22 | 0 / 22 |
| DAY 1 · SUN 20 SEP | 18 of 86 (21%) | 15 / 22 | 0 / 22 |
| DAY 2 · MON 21 SEP | 42 of 86 (49%) | 19 / 22 | 3 / 22 |
| DAY 3 · TUE 22 SEP | 61 of 86 (71%) | 20 / 22 | 4 / 22 |
| DAY 4 · WED 23 SEP | 86 of 86 (100%) | 22 / 22 | 22 / 22 |

Note the shape of that last column — 0, 3, 4, 22. Almost nothing FINISHES until
the end, because most areas are revisited right through camp; what grows day by
day is the painted fraction of each one. The set should feel like that: three
sheets of many part-taken areas in company colours, then a final sheet that is
almost entirely 1ATF blue. Design the Day 4 poster as the payoff, not as one
more increment.

**The map is SECTOR 8 only.** Sector 9 carries no camp activity, so the map
image opens on Sector 8 and its eastern border is the sector line, drawn in the
same yellow as the Commonwealth boundary. Keep the `◤ SECTOR 8 — AREA OF
OPERATIONS` tag visible in the poster's map panel; ground beyond the border is
visible but is not ours to take.

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
