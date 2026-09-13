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
   Force" beside it in dimmed text. Right-aligned: a mono block with `DAY 03`
   and the date. A thin teal rule under the band.
2. **Status line.** One mono line, uppercase, small: the operation name and a
   live tag (a small teal dot + `LIVE OPERATIONAL PICTURE`).
3. **The map.** The dominant element — roughly 55% of the poster height. Inset
   it in a panel with a hairline border and a 4px radius. Do not crop the
   map's own legend off. Leave a small mono caption under it for the imagery
   credit line supplied with the export.
4. **Progress strip.** A row of zone cards — one per activity area (ropes
   course, navex, quarry, etc.). Each card: zone name in Orbitron small-caps,
   a hatched progress bar, a percentage in mono, and small company chips
   showing who has been through. See the two variants below for what the
   percentage means.
5. **Company standings.** A compact table or row of tiles, one per company, in
   that company's colour: areas completed, ground held. Mono numerals.
6. **Footer.** The unit motto `LUCET PER MINISTERIUM` in small mono on the
   left, a page/sheet reference on the right, hairline above.

## Two variants — build both as separate artboards

**UNIT poster** — the whole task force on one sheet.
Every zone card shows *collective* progress: the fraction of the companies
scheduled to visit that zone which have actually been through. If Alpha, Bravo
and Charlie are all scheduled for the ropes course and only Alpha has been,
the card reads `33%` with Alpha's chip filled and Bravo's and Charlie's shown
as empty outlines. Under the bar, a short mono line names who has been:
`ALPHA COMPLETE`. The bar itself is hatched in the colours of the companies
that have completed it, split proportionally.

**COMPANY poster** — one per company, six variants driven by the company colour.
Shows only that company's own progress and only the zones they are scheduled
for. A zone is binary here — done or not done — so the cards are simpler and
the percentage at the top is that company's overall completion across camp. The
company's colour replaces teal as the accent throughout the poster (header
rule, active states, chips), while threat red and the map line colours stay
exactly as they are. Put the company name and letter badge prominently in the
header band.

## Rules

- Every number on the poster is a placeholder to be swapped per day — mark them
  clearly and keep them in mono so substitution never changes the layout.
- Nothing decorative in threat red. It means one thing.
- No drop shadows, no gradients on text, no faux-3D. Flat, dark, precise.
- Generous margins; this is a wall poster read from two metres as well as a
  screen read from fifty centimetres. The day number and the map must be
  legible at a glance from across a room.
- Provide the empty "Day 0" state too: the map with only the sector boundaries
  and RHQ, every zone card at 0%. Camp starts from an empty board and that
  first poster sets the expectation.
