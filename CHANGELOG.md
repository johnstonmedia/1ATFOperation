# Changelog — running brief for collaborating AI sessions

Purpose: a session-by-session record of what changed and *why*, so the next
Claude/Claude Code session (or a human collaborator) can get oriented fast
without re-reading the whole diff history. This is a brief, not a git log —
keep entries short and focused on what a new collaborator needs to know.

**Convention:**
- Newest entry at the top.
- One entry per work session (not per commit). Group related commits together.
- Each entry: date, one-line theme, a few bullets on what changed and why it
  matters, and the commit range/hashes if the work has been committed.
- If you (an AI session) make repo changes, **add an entry here before
  finishing**, even if [CLAUDE.md](CLAUDE.md) also got updated as a result.
- If a change reverses or supersedes an earlier entry, say so explicitly
  rather than leaving the old entry to mislead the next reader.

---

## 2026-09-15 (f) — Ground taken today looks like ground taken any other day

- **Removed the "TAKEN TODAY" marking from the print sheets** — `drawGains`
  (gold outline over a light wash on the map), its key chip, and the gold tint
  on the band rows whose count went up. Ground conquered on a sheet's own day
  now renders identically to ground conquered on any earlier day.
- **Why, beyond being asked:** the wash TINTED the company colours underneath,
  so the very ground whose company you most wanted to read was the ground whose
  colour had been altered — it was working against the per-company colouring
  added an hour earlier.
- **The problem it was built for no longer exists.** `drawGains` was added when
  five cumulative sheets looked nearly alike. Since areas start Meridian and are
  taken in company colours, Day 1 is mostly red and Day 4 entirely 1ATF blue;
  the sheets tell each other apart without help.
- `GAIN` is renamed `BOUNDARY`: its only remaining use is the sheet's AREA OF
  OPERATIONS tag, and that yellow is the boundary line's, not a gain colour.
  `isHeld` and the `isMeridianCode` import went with `drawGains`; `drawStrip`
  lost its now-unused `prevProgress` argument.

---

## 2026-09-15 (e) — Activity areas are coloured by the company taking them

- ⚠️ **REVERSES "no company ever owns an activity area"** from entry (a) earlier
  the same day, at the unit's request. Each completed visit's slice is now
  painted in the colour of the COMPANY that made it, light, over the Meridian
  fill — so a part-taken area says who has been through it, not just how much of
  it has gone.
- **The ending is what keeps it honest.** On the final scheduled visit the whole
  zone still flips to solid 1ATF (`T`), company colours and all, so the
  patchwork is a transient state of ground still being taken and never the
  finished picture — and Wednesday still ends with the task force holding
  everything. The interstitial front between areas stays 1ATF throughout: no
  company owns the connective ground.
- Verified frame by frame: camp start `M:27769`, Day 1 `a:440 b:373 c:226
  d:696 e:242 s:270 t:2819 M:22703`, Day 4 `T:27769` with no Meridian and no
  company codes left. Totals conserve at 27769 on every frame.
- **The cost is documented, not hidden.** A busy area becomes a patchwork, which
  is exactly what got this removed the first time. There is also a new one:
  `visitSlice` allocates over `zoneCellsOrdered`, which ranks cells by distance
  out from the label point, so each visit's share is an ANNULUS. With one colour
  that read as ground growing from the middle; with six it reads as concentric
  rings — NAVEX and AA Kilo look like targets. If that needs fixing the change
  is the allocation ORDER (wedges rather than rings), not the colouring.
- Falls out for free: the replay's conquest flashes and the weekly image's gain
  labels now name the companies rather than saying 1ATF everywhere, and derived
  company labels reappear on the map.

---

## 2026-09-15 (d) — The print sheets are A3 PORTRAIT

- **`PAGE_W`/`PAGE_H` swapped to 1754 x 2480.** The camp's area of operations is
  190 x 207 cells — very slightly TALLER than it is wide — so portrait suits the
  ground better than landscape ever did.
- ⚠️ **Orientation was written down in two places, and that was the real work.**
  `printFocus` in maps.js was a CROP RECTANGLE, hand-shaped to a landscape A3's
  1.414:1 (`{x0:0, y0:41, x1:320, y1:267}` — note x0 at 0, chosen to fill a wide
  page, not because the camp reaches the sheet edge). Turning the page over that
  would have cropped camp ground off the sides. It now declares the GROUND that
  must appear (`{x0:62, y0:44, x1:264, y1:261}` — the AO plus ~6 cells of air)
  and new `fitCrop` in framesPdf.js grows it to whatever shape the page is.
- **`fitCrop` only ever grows the rectangle**, so every declared cell is on the
  sheet whichever way up it prints, and it reserves the bottom band's height —
  ground under the band is ground you cannot read. Verified numerically: crop
  aspect **0.70726 against a page aspect of 0.70726** (no stretch), AO bbox
  68-258 x 49-256 inside the crop 62-264 x 20.4-306, AO bottom at row 256
  against a band top at row 277.4.
- **The band's columns follow the page width** (`stripCols`, ~600 px each): four
  across landscape, three across portrait. `fitCrop` needs the band's height
  before the map is drawn, so `stripHeight` is a pure function both it and
  `drawStrip` call — the crop and the band can't disagree about it.
- Home's caption now reads "A3 portrait". Dead `keyW` removed.
- Turning the sheets back, or onto any other page shape, is now those two
  constants and nothing else.

---

## 2026-09-15 (c) — The print sheets name the companies on the ground

- **Which COYs have been through each area is now on the map, not just in the
  band.** Under each area's name, a letter per company that has been through it
  so far, in that company's colour; an area nobody has reached has no second
  line. Attribution WITHOUT ownership — the ground is 1ATF's whoever walked it
  — but "has my company done the ropes course yet" is the question these sheets
  actually get asked, and it was the one thing on the sheet you had to
  cross-reference to answer.
- The **visit count stays in the bottom band**: the painted pixels already say
  how much of an area is taken, so the fraction reads off the map, and putting
  it back at each area would be the third competing line that made names
  unreadable the first time.
- ⚠️ **A second line, not a longer one.** Appending the letters to the name was
  tried first and was worse than either: `▲ HIGH ROPES A B C E S` is nearly
  twice the name's width, and width is what the declutter cannot solve — it
  could only nudge vertically, so AA MIKE ended up buried under HIGH ROPES.
  Stacked, the block is only as wide as its name, so horizontal conflicts stay
  as rare as they were with names alone.
- ⚠️ **The declutter search is now 2-D.** Vertical-only nudging cannot clear a
  five-label cluster (High Ropes, AA Lima, AA Mike, AA Juliet, NL Romeo sit
  within a few hundred metres); candidates are ordered by ring, vertical-first
  within each ring, so a label moves sideways only when up and down are taken.
  Verified on the real A3 render: every area labelled, no overlaps.
- **No change to the video or the weekly image** — checked first, and both
  already named the companies via the non-print `drawMapZones` path
  (`AA OSCAR 1/1 E`, `NAVEX 13/13 A B C D S`). Only the print path was missing
  them.

---

## 2026-09-15 (b) — Six Maps everywhere: no more imagery seam

- **The satellite imagery now reaches the frame edge.** `fixedTiles()` was
  spending its budget on the map's `focus` box alone, so everything outside
  Sector 8 fell back to the 10 m static art — and since the two don't match in
  tone or sharpness, zooming out drew a hard-edged RECTANGLE across the map in
  exactly the shape of the focus box. `focus` is a starting view, not a crop,
  and everything anyone sees on this site is SIX Maps. Tiles now cover the
  whole frame: `FIXED_MAX_TILES` 160 → 400, so Singleton still lands on **z16
  (~2 m/px), now 352 tiles instead of 132**. 400 is the same cap the exporters
  already use, which is what makes the page and the video ask for identical
  ground. Verified against a local stand-in pyramid: 352 served, 0 missing,
  coverage −4.5%→100.6% × −3.1%→104.7% of the frame, and the count is
  **identical at the opening view and fully zoomed out** — the one-fixed-level
  rule still holds.
- ⚠️ `loading="lazy"` on the tiles was tried and **removed**: measured,
  Chromium fetched all 352 at the opening view regardless (they sit inside a
  transformed ancestor), so it bought nothing — and a browser that honoured it
  would leave the static floor showing until a zoom-out finished, which is the
  flicker the fixed-level design exists to avoid.

---

## 2026-09-15 — Whatever 1ATF doesn't have, Meridian has

- **Ground is always somebody's.** Camp opens with the **entire area of
  operations** held by Meridian (`M`) and closes on Wednesday with all of it
  1ATF's (`T`). Before this, un-taken ground was `.` — empty paddock waiting to
  be coloured in — so a part-taken activity area read as *unfinished* rather
  than *contested*, and the map never actually said what the portal says the
  camp is for.
- **"Everything" is the AREA OF OPERATIONS, not the map frame.** New
  `areaOfOperations()` in [mapLines.js](src/lib/mapLines.js) fills the same
  Sector 8 shape the yellow lines already DRAW: the two traced Defence
  polylines close into a ring across the sheet edge (they are one boundary that
  leaves the sheet and comes back), and the sector line is applied as a
  per-cell eastern limit rather than as a second polygon. 28,690 of the map's
  132,192 cells. Deriving it from the drawn lines is the point — the picture
  and the claim cannot drift apart. Ground west of the Commonwealth boundary or
  east of the sector line is deliberately untouched: it is not being contested.
- **The ground BETWEEN the areas is taken too.** Otherwise Wednesday ended with
  a map still mostly red. A front advances outward from RHQ (origin taken from
  the live map's own `R` cells) in step with `overallProgress` — visits done
  over visits scheduled — so it reaches the boundary on the last visit of Day
  4. Same conquest order and same light/solid convention as a zone.
- ⚠️ **Order of painting is load-bearing**: Meridian across the whole AO, then
  the front, then the zones. Zones LAST is what leaves an unvisited area still
  red *inside* ground the front has already swept past — which is the most
  useful single thing the map says. Verified frame by frame:
  `M:27769 / M:22703 t:5066 / M:11632 t:14253 T:1884 / M:6629 t:18941 T:2199 /
  T:27769` — no Meridian left on Day 4.
- **`drawGains` had to change with it.** A gain is ground taken OFF somebody,
  not an empty cell filled in. The old test (`held now && '.' before`) found
  nothing once zones started red, so every printed sheet would have come out
  with no daily gains marked. Now `isHeld(now) && !isHeld(before)`, where held
  excludes `M`.
- **MERIDIAN is in the print key**, first, because on the early sheets it is
  most of the ground on the page. `MERIDIAN_CODE`/`MERIDIAN_COLOR` are now
  exported from territory.js rather than spelled `'M'` inline, since the code
  is no longer only something RHQ paints by hand.
- **Refactors, no behaviour change**: `polygonCells`/`orderOutward` split out of
  `zoneCells`/`zoneCellsOrdered` in [zoneRaster.js](src/lib/zoneRaster.js) so
  the AO can reuse them. Deleted `drawKey`/`drawSummary`/`drawAreaTable` from
  framesPdf.js — dead since the side column became the bottom band, and exactly
  the kind of leftover that invites the band to grow back.

---

## 2026-09-14 (b) — 1ATF conquest, staged release, tiles in exports, no seeded Meridian

- **A zone is conquered by 1ATF, not by a company.** New owner code `T`
  (`TASKFORCE_CODE` in territory.js, assure-blue `#1e9bff`, labelled `1ATF`).
  While companies are still working through a zone it stays the FIRST
  visitor's, lowercase/loosely held; once EVERY company the plan sends there
  has been, it flips to solid 1ATF. The percentage on a zone is therefore
  always unit-wide, in both views — three companies booked onto the ropes
  course means one through reads 33% wherever it is shown.
- **Conquered ground shows on every company's map.** `T` survives the
  per-company mask, so an area two companies were booked onto and both
  visited reads as taken on all six companies' maps, including the four never
  sent there.
- **Company boards are now built, not just masked** (`companyCells` in
  campFrames.js). Masking alone erased ground the visitor's own company had
  covered whenever another company got there first and painted it their
  colour; the plan is now re-read per frame (against `f.day`, not the day on
  screen) so a cadet's own progress is right at every point in the replay.
- **Campaign frames can be held back** (`hidden` on the frame doc,
  `releasedFrames()` in campaign.js). Camp is generated in full before it
  starts, so **frames built from the camp plan now arrive HIDDEN** except the
  camp-start frame; Map: Territory gives each row **Reveal** / **Visible ✓**
  plus **Reveal to here** (the end-of-day action — reveals up to that frame
  and re-hides the rest, so the public timeline never has a gap). Only Home
  filters; the Ops Centre always works on the full set.
- **A non-default map is not public until distributed.** New per-map
  `mapRelease` slice + `isMapPublic()`/`publicMaps()`; Ops Centre → Map:
  Territory has **Distribute to the portal** / **Withdraw**. ⚠️ This
  QUALIFIES the 2026-09-13 "both maps are public" rule: the DEFAULT map is
  still always public (a default nobody may open leaves Home with no map),
  but every other map is invisible — no switch button, and a session override
  naming it falls back to the default — until RHQ distributes it. The ops
  copy now states which of the three states you are editing in.
- **Exports render through the live tiles.** `renderBaseMap()` in
  replayExport.js is async and composites the XYZ tiles over `map.image` at
  export resolution, then applies the map's filter in ONE 1:1 pass (so the
  no-resample rule that fixed blurry exports still holds), matching the live
  page where a single CSS filter wraps art and tiles together. Tiles load with
  `crossOrigin='anonymous'` — a server without CORS fails cleanly to the
  static art instead of tainting the canvas and throwing at the end of a long
  export. Capped at 400 tiles per export (≈z16 on the Regional frame, ~2.5 m/px
  against the static image's ~12 m/px). This is why an exported replay of the
  Regional map looked coarse next to the live map: it was rendering the
  Sentinel-2 floor, upscaled 3x.
- **Revealing a frame advances the LIVE map.** The live territory is what the
  exports treat as the present and what the static map shows with no replay;
  with camp generated in advance it was still the blank camp-start board, so an
  exported video played the campaign forward and then ended by wiping every
  gain off the map. `syncLiveTo()` writes the last released frame's cells to the
  territory slice on Reveal / Reveal to here, and the video appends the live
  state only when it is not already one of the frames.
- **Zones are drawn in both exports** (`drawMapZones()`, the canvas twin of
  MapZones.jsx): outlines under the hatch, names and the percentage/1ATF
  readout on top, with each frame's readout taken from THAT frame's camp day.
  Without it an exported camp replay was anonymous shapes.
- **Legacy `DEFAULT_ZONES` deleted** — the Leaflet-era Australia polygons
  (Northern Approach, Red Centre, Meridian Salient…) predating the KML import.
  Unused by any code; the committed BIV26 zones are the only zone data now.
### Second pass, same day — pixels instead of the ramp, and Sector 8 only

- ⚠️ **Progress is counted in VISITS, not companies.** A company is often
  booked into the same area more than once (NAVEX 13 times, AA Juliet 8), so
  counting distinct companies called a zone a third done after one of three had
  been. `zoneProgress` now returns `{ visits, done, total, pct, complete, … }`
  and a zone finishes on its LAST scheduled visit.
- ⚠️ **No company owns an activity area.** The taken share of a zone is
  painted light 1ATF and goes solid on the final visit — a percentage takeover
  by the task force rather than a prize one company holds. Painting each visit
  in its own company's colour made a busy area a patchwork that read as six
  companies competing for the same ground. Companies still do the conquering;
  the plan says who is where and every visit count comes from it.
- ⚠️ **The map now loads ONE fixed tile level and never swaps again** — this
  REPLACES the two-layer fix below, made hours earlier. Requesting a deeper
  level per zoom step was itself the problem: it swapped the imagery on screen
  every step. `fixedTiles()` chooses one level from the map alone (z16 over
  Sector 8, 132 tiles, ~2 m/px), fetched once; zooming just scales it, exactly
  as the static image always did. Verified identical tile set before, during and
  after a zoom, and a pan now costs no requests at all.
- **Only Sector 8's boundary is drawn.** The traced Commonwealth boundary wraps
  the whole survey sheet; `clipToSector()` drops the runs east of the sector
  line and cuts exactly onto it, so Sector 8 is one closed shape rather than the
  area plus an empty enclosure beside it.
- ⚠️ **Singleton's grid is 432×306 — 4× the cells.** A ~59 m cell could not
  follow an activity area's outline, so a part-taken fill read as a blocky
  approximation over the shape. At ~30 m it hugs the edge. Zone outlines and
  traced boundaries both record the grid they were authored in and are scaled
  at load, so nothing needed re-tracing — but every stored singleton frame and
  territory is dropped and re-seeded on load (they are generated; rebuild from
  the camp plan). NSW untouched.
- **Conquest flashes are one per owner, not one per cluster.** With every area
  going to 1ATF, labelling each captured cluster printed the same name a dozen
  times across the map — the same failure the weekly still image already fixed.
- **Zone type is sized from the frame, not the cell count**, so refining a grid
  no longer halves it on screen.

- ⚠️ **Zooming no longer flashes the low-quality map.**
  *(Superseded the same day by the fixed-level design above.)* `TileBase` kept only
  the current zoom level mounted, so every zoom step unmounted the imagery you
  were looking at and exposed the 10 m Sentinel floor until the deeper level
  arrived — which reads as glitching, not loading. It now tracks which tile
  URLs have decoded and holds the previous level underneath the incoming one
  until 92% of the new level has arrived. Verified with a stand-in tile server
  delayed 1.5 s: mid-zoom the old level stays visible (70 tiles at z15) while
  the new one is mounted but hidden (88 at z16), then the old one is dropped.
- ⚠️ **The PDF prints from real imagery, not the floor.** The tile budget picks
  the zoom level, so fetching the whole frame when the page only prints the
  focus box cost two levels of detail where it mattered. Print tiles are now
  fetched for the cropped region only, the zoom climbs while the budget allows,
  and the map panel renders at 2× and draws down: z15-whole-frame before,
  z16-over-the-region after — 132 tiles, ~2.0 m/px, twice the linear resolution
  for fewer requests.
- ✅ **SIX Maps sends the CORS header** — settled by a real export off the live
  site, which came out on NSW Spatial Services imagery. The Esri print fallback
  added on the assumption it might not is REMOVED: a hedge that can put
  different ground on paper from what the screen showed is worse than the
  failure it guards, and everything anyone sees is now one source.
- 🐛 **Fixed: a real export had no area names and no list.** The area list was
  derived from the LAST frame's progress alone, so one frame without a camp day
  emptied it for every page while the totals still looked right. It is built
  from the union of all frames now.
- **The printed map zooms in further.** The bottom band's height is dead space
  in the crop, so a shorter band lets the crop tighten — four columns at 24px
  instead of three at 26 buys roughly 10% more camp on every sheet.
- ⚠️ **A print now always gets real satellite imagery.**
  *(Superseded — see the CORS finding above; the fallback is gone.)* The exporter needs
  CORS and the screen does not, so if SIX Maps won't send the header the print
  was dropping to the 12 m static base while the live map stayed perfect. No
  client code can make a service send a header, so there is now a second
  source: `map.tiles.printFallback` (Esri World Imagery, CORS-enabled), tried
  by the exporters only and only when the primary returns nothing readable. The
  page prints whichever source's attribution actually supplied it.
- **Area NAMES are back on the printed map**, replacing the numbered badges —
  a map you have to cross-reference to read is not a map of anywhere. Counts
  and company letters moved to the bottom band, leaving one short line per
  area, and placement declutters (biggest area first, later labels nudged clear,
  drawn anyway if they can't be). Sub-cell ground is skipped, as on screen.
- **The PDF is now map, edge to edge, with one thin band at the bottom.** The
  key column and header band together were spending a quarter of an A3 on
  chrome. The map covers the whole sheet (`printFocus` crops to the page's own
  proportions so nothing stretches or is cut), the title sits on it under a
  scrim, and the annotation is a single strip carrying only what can't be read
  off the ground — area numbers, visit counts, company letters, four swatches
  and one totals line. The prose, the boundary key, the company legend and the
  big percentage block are gone.
- **The site itself can export the PDF now** — a public `🖨 PRINT SHEETS`
  button under the map on Home, printing the released frames only.
- **The PDF map bleeds to the page edge** — no margin, no border, one header
  line — and the export now REPORTS whether it got the satellite imagery.
  ⚠️ The exporter needs `Access-Control-Allow-Origin` on the tiles and the live
  map does not: displaying a cross-origin image needs no permission, reading one
  back out of a canvas does. So a service that refuses CORS displays fine and
  prints from the ~12 m static base, silently. There is no client-side
  workaround, so Map: Territory now says so outright after an export that fell
  back, naming the cause.
- **The PDF is now an A3 wall sheet.** One header line and nothing else around
  the map; areas numbered on the map with the names, counts and company letters
  in a table beside it (labelling them on the map itself collides into an
  unreadable mat at any size legible from two metres); every sheet outlines the
  ground taken THAT DAY and highlights the table rows that moved, so five
  cumulative sheets no longer look alike; and every area names the companies
  through it so far, in their colours — attribution without ownership, since
  the ground itself stays 1ATF's.
- **PDF export of the whole campaign** (`framesPdf.js`): one A4-landscape page
  per frame at 150 dpi, map left, key right, progress block under it, each page
  cropped to the map's focus box. No PDF dependency — a page is one full-page
  JPEG in a hand-written PDF wrapper (~80 lines), rendered through the same
  base renderer as the video and the still, so print can't drift from screen.
- ⚠️ **Ground is taken in PIXELS — this REPLACES the OKLab ramp below, hours
  old.** A zone visited 2 of its 13 times has 2/13 of its CELLS painted, in the
  ordinary territory hatch, each completed visit in its own company's colour.
  Cells are allocated outward from the zone's label (`zoneCellsOrdered`) so the
  fill grows from the middle and is stable between frames; `visitSlice()` tiles
  the zone exactly so the last visit always completes it, flipping the whole
  zone to 1ATF. The map already had a language for held ground; a gradient made
  the reader learn a second one for the same idea.
- **The Regional map opens on SECTOR 8** (`focus` on the map record +
  `focusView()`), because every zone the plan touches is west of the sector
  line and Sector 9 is empty. A starting view, not a crop — the imagery,
  boundaries and the Sector 7/9 markers still cover the whole sheet.
- **The sector 8/9 line is now yellow**, matching the Commonwealth boundary: it
  is the area's eastern border now, not an internal division, so it closes the
  shape rather than reading as a different kind of line. The map also carries a
  `◤ SECTOR 8 — AREA OF OPERATIONS` tag, since the frame shows ground beyond
  the border and shouldn't imply otherwise.

- ⚠️ **A zone's COLOUR is now its progress; the printed percentage is gone.**
  *(Superseded the same day by the pixel conquest above — kept for the
  reasoning about the interpolation path, which still governs any future ramp.)*
  `zoneColor()` ramps Meridian red → 1ATF blue **in OKLab**. The path was the
  real decision: a constant-chroma OKLCH sweep stays vivid but runs through
  magenta and violet — i.e. through Support's and Delta's accents — so a
  half-finished zone would wear a company's colour. The straight OKLab lerp
  dips to low chroma at the midpoint instead (0.230 → 0.083 → 0.179), which
  matches no company and reads as contested. Ramp: `#ff3b46` → `#db697d` →
  `#b381aa` → `#8191d5` → `#1e9bff`. Lightness is near-constant by design
  (equal legibility over dark imagery), so the ramp says nothing in greyscale
  — hence the two channels below.
- **AAs and NLs are told apart without colour**: night locations dashed and at
  82% lightness of the same ramp, activity areas solid, and a glyph on every
  name (▲ / ☾ / ◆). Headquarters stays amber and off the ramp — it isn't
  ground to be taken.
- ⚠️ **The per-company map view is REMOVED** (reverses the per-company work
  earlier the same day). There is one map and it is the unit's: no UNIT/COMPANY
  toggle, no `maskToCompany`/`companyCells`, and no `company` argument on
  `zoneProgress`/`overallProgress`. Six cuts of one camp is six things to keep
  straight, and showing a cadet only their own ground worked against what the
  1ATF stage says. The boot-gate company still scopes INTEL.
- **LOCAL MODE now announces itself in the Ops Centre.** A build carrying
  `VITE_FIREBASE_DISABLE` reads the browser only, yet sign-in still succeeds
  (the bootstrap admin is accepted with any password in that mode) — so such a
  deploy looks precisely like a live site whose content has vanished. That was
  a real preview-vs-production mystery; the banner names the variable and the
  fix.
- **Firestore read failures are no longer silent.** `loadFirebase` swallowed
  every failed read and fell back to the seed, so a denied `content/territory`
  read drew the seeded map and looked exactly like the campaign progress having
  been wiped — with nothing in the console. Failures are now recorded on
  `state.loadErrors` (and `console.warn`ed, since a public visitor has no Ops
  Centre) and listed at the top of the Operations Centre, naming the path and
  the Firestore error code; a `permission-denied` on a world-readable path
  points at the HANDOVER §0 rules republish.
- **Seeded Meridian demo data removed**: the three pre-painted `M` blobs in the
  NSW default territory, the two `hostile: true` stronghold flags on the
  Regional map, the Meridian demo activity row, and the Meridian contact in the
  seeded movement. The Meridian NARRATIVE is untouched (quote, SMEAC, the
  `meridian` brief, intel intro, `--hostile` colour) — it is the campaign's
  story, and removing it would empty the Home page. ⚠️ The seed only applies
  where no Firestore document exists; a live NSW territory already saved needs
  **Clear all** in Map: Territory.

## 2026-09-14 — Campaign frames generated from the camp plan; company-scoped board
The replay is now built from the plan rather than painted, and a company sees
only its own ground.

- **⚙ Build 5 Frames from Camp Plan** (Ops Centre → Map: Territory → Campaign
  replay) generates one frame per camp day plus a camp-start frame, painting
  ground from the schedule. Generated frames are ordinary frames afterwards, so
  any of them can still be repainted, relabelled or deleted. Replacing an
  existing replay is behind a confirm.
  - **The first company into a zone takes it and keeps it.** Later companies
    pass through without the ground changing hands — a progress map that churns
    between friendly companies reads as confusion, and "conquered" means taken
    from the Meridian, which happens once.
  - **Held-ness uses the grid's existing light/solid convention** rather than
    new cell codes: a zone is lowercase (loosely held) until every company on
    its plan has been through, then uppercase. Verified in the generated
    output — camp start is RHQ only, the middle days are mostly lowercase, and
    Day 4 is entirely uppercase.
- ⚠️ **Fixed a contradiction this created.** The replay timeline and the camp
  day selector were two independent clocks: the map could show Day 4 while the
  progress bar underneath said START / 0%. The replay now OWNS the day —
  generated frames carry their day, the committed frame reports it up, and the
  duplicate day buttons are replaced by a "SHOWING DAY n" readout. Verified:
  autoplay ends on DAY 4 / 100%, first bubble gives CAMP START / 0%, third
  gives DAY 2 / 49% of 86.
- **The company view now masks the painted ground**, not just the zone
  outlines: a cadet in company view sees their company's ground and RHQ's and
  nothing else. Done by masking cells at render time rather than generating six
  sets of frames — same plan either way, and per-company frames in a shared
  collection would be six more things to keep in step. RHQ deliberately
  survives the mask so the board keeps its anchor. Verified: unit view draws
  all seven company labels, Alpha view draws A-COY and RHQ only.
- The poster prompt now carries the real camp data — the 15 activity areas and
  6 night locations by name, the four dated days, the 86-slot unit total, and
  the High Ropes worked example — so a mock-up reads true.

---

## 2026-09-13 (sixth) — The camp plan drives zone progress
The BIV26 plan workbook is now the map's schedule: **86 visits across 22 zones,
11 sessions, 4 camp days**, with UNIT and per-COMPANY progress views and a
day selector on Home.

- **[tools/map/xlsx-to-schedule.py](tools/map/xlsx-to-schedule.py)** reads the
  "AA+NL Timetable" sheet — two grids, activity areas by session and night
  locations by day. The day header row is sparse (a day name sits over its
  first session only), so sessions are read from the second header row and
  attributed to the most recent day named above them.
- ⚠️ **The converter refuses to guess.** Any cell that is not a recognisable
  company is reported by name and skipped, never silently dropped — that is how
  an allocation goes missing unnoticed. This run ignored exactly two, both
  correctly: "Off Limits" and "RECSPECS". Sheet typos ("Ssupport") and name
  mismatches are an explicit mapping, not fuzzy matching: "Juliett" →
  `aa-juliet`, and the sheet's **"Ropes" activity is `high-ropes`, a different
  place from its `nl-ropes` night location**, which fuzzy matching would have
  merged.
- **Progress is derived, not recorded.** The plan is settled before camp, so
  `zoneProgress(mapId, throughDay, company?)` computes everything from one
  number. No live ticking, no approval workflow — matching the decision that
  the conquering is all pre-planned.
- **Two views, one dataset.** UNIT gives the asked-for behaviour exactly: a
  zone shared by several companies shows the share who have been, with their
  letters in their own colours. COMPANY shows only that company's zones.
  The company comes from the boot gate already answered for intel scoping.
- Zones now fill as their companies pass through, so "how far along is camp" is
  readable off the map without reading a number.
- Verified against an independent calculation from the sheet: High Ropes runs
  0 → 17%E → 50%BCE → 83%ABCES → 100%ABCDES across days 1–4, and Bravo-only
  drops the map to 12 zones and 15 activities with High Ropes flipping to 100%
  on day 2. Unit headline 0/21/49/71/100%. No page errors.
- All 22 scheduled zone ids were cross-checked against the zones file — none
  dangling. The six unscheduled zones are RHQ and its sub-areas, correctly.

**Next**: generate the per-day campaign frames (painted territory) from this
same plan, so the replay animates camp day by day.

---

## 2026-09-13 (fifth) — Camp zones from the BIV26 Earth project
The unit's Google Earth project is now on the map: **28 zones** — 15 activity
areas (the AAs, High Ropes, NAVEX, the Quarry), 6 night locations and 7 HQ
areas — as polygons in grid cells, with RHQ show/hide in Ops Centre →
Map: Territory.

- **[tools/map/kml-to-zones.py](tools/map/kml-to-zones.py)** converts the KML.
  Committed rather than pasted once, because next year's camp plan is authored
  in Earth and re-running this is the whole update path.
- Polygons pair with their label points **by containment, not name** — Earth's
  two names frequently differ ("Regimental Headquarters" polygon vs "RHQ"
  point; "NightLoc Ropes" vs "NL Ropes"), so name matching alone would have
  mislabelled several zones.
- Skipped on purpose: the project's `Archive` and `2021 NLs` folders (both
  superseded), and its `Borders` folder — the portal's boundaries are traced
  off the survey sheet and are better. **They agree closely, which validates
  both**: the project's Sector Boundary spans cells x 125.6–129.3 against the
  traced 123.1–129.3, and its RHQ polygon centres on (104.8, 93) against the
  surveyed (104, 96).
- ⚠️ **Some camp ground is smaller than one grid cell.** The eating areas and
  field kitchen are ~20 m across against a 59 m cell and came out of
  simplification as one or two points. They are stored outline-less and render
  as a dot plus a name that only appears past 2.5x zoom — at 1x those four
  names landed on top of each other and on RHQ's. This is a real limit of the
  grid, not a bug to fix.
- **Geometry is code, visibility is content.** Outlines are committed; what is
  shown lives in a per-map `zoneVisibility` slice (no Firestore rules change —
  it goes through `mapSlices()`). A missing slice shows everything, so zones
  work the moment they are committed and RHQ only touches the panel to remove
  something.
- Verified: 28/28 shown → hide one → hide a kind → master off, each reflected
  on the map and persisted; NSW shows no zones and no panel; no page errors.
  One bug caught by testing the ops path rather than assuming — a missed import
  edit left `zoneVisibilitySlice` undefined and crashed the editor.

**Still to come, waiting on the camp Excel**: which companies are scheduled for
which zone, the unit-vs-company view modes, and the per-day pre-authored
progress frames.

---

## 2026-09-13 (fourth) — Blank camp start state; poster prompt
Groundwork for running the portal live at camp.

- **The Regional map now starts blank.** Its seed painted Meridian at Yellow
  Billys Cave, Broken Back Range and the DFSW2 range as demo content; for a
  live camp that is wrong — the whole point is watching an empty board fill in.
  The only seeded ground is RHQ at the Ex Admin Area. The sector and
  Commonwealth-land boundaries still show because they are vectors drawn over
  the art, not painted cells, so a blank board is not an empty picture.
  NSW is untouched and keeps its three Meridian blobs.
  ⚠️ The seed only applies where no Firestore document exists yet. If the
  Regional territory has already been saved live, blank it with **Clear all**
  in Map: Territory and repaint RHQ.
- **[docs/progress-poster-prompt.md](docs/progress-poster-prompt.md)** — the
  Claude Design prompt for the daily camp posters, with every colour and font
  copied from `index.css`, `seed.js` and `mapLines.js` rather than described
  from memory. Committed rather than pasted once so it can be kept in step when
  the brand values move. Covers both the UNIT variant (a zone's percentage is
  the share of its scheduled companies that have been through) and the per
  COMPANY variant, plus the Day 0 empty state.
- **Still blocked on files**: the BIV26 Earth project (the Drive "Google Earth"
  folder exists but is empty — Earth Web keeps project data where the Drive API
  can't read it, so it needs a KML export) and the camp Excel. The zone layer,
  the show/hide control and the per-day progress all wait on those.

---

## 2026-09-13 (third) — Both maps are public; RHQ picks the default
Renamed the two maps and opened both to visitors.

- **`nsw` → "1ATF Full Progress Map"**, **`singleton` → "1ATF Regional
  Progress Map"**. Display names only: a map's **`id` is baked into stored
  data** — its slice names (`territory_singleton`) and the `map` field on every
  campaign frame — so renaming an id would orphan its documents. The ids are
  untouched and a note in CLAUDE.md now says why.
- ⚠️ **REVERSES the standing rule that "the public sees exactly one map, and
  there is deliberately no public switcher."** `activeMap` is now the DEFAULT —
  the map a visitor lands on — and a **map switch under the map on Home** lets
  them view any other. Don't reinstate the old rule.
- The switch renders **one button per map that isn't on screen**, so a third
  map needs no new UI; with two maps that is exactly the single "view the other
  one" button asked for. Hidden entirely if only one map exists.
- The visitor's choice is **per device, per session**
  (`src/hooks/useViewedMap.js`, `sessionStorage`) — no login, no write, nothing
  of RHQ's touched. **Session, not local, storage on purpose**: a permanent
  override would make RHQ's default meaningless on that device forever, so the
  default reasserts itself next visit. Choosing the default again clears the
  override rather than pinning it. Storage reads are guarded (private mode
  throws; a stored id can name a map removed in a deploy) and fall back to the
  default.
- ⚠️ **A correctness fix this forced**: the Ops Centre told RHQ that editing a
  non-default map "changes nothing for them until you publish it". That is now
  false — both maps are public — so the copy says so, `PUBLIC` became
  `DEFAULT`, and the button is "Make this the default map". Anything saved on
  either map is visible to anyone.
- The Staff Centre still shows only `activeMap`; it is an overview of the live
  picture, not a browser.
- Verified in the browser: lands on the default (tagged DEFAULT); switching
  flips to the other map (tagged VIEWING) with a "back" button; the choice
  survives navigating to /intel and back; returning to the default clears
  `sessionStorage`; a fresh session starts on RHQ's default again. No page
  errors, and the ops copy reads correctly in both states.

---

## 2026-09-13 (later) — Singleton becomes a live satellite map you can zoom into
Asked to be able to zoom in, on real satellite imagery, "maybe use leaflet".
Singleton now pulls **NSW SIX Maps** tiles at whatever zoom the user is
actually at, so zooming reveals detail instead of magnifying pixels. Supersedes
this morning's entry, where the map was a single 10 m Sentinel-2 still.

**The frame had to move to Web Mercator, and that was the whole problem.**
The map was built in the paper sheet's MGA Zone 56 rectangle — survey-correct,
and right while the art came off the sheet. Measured it: MGA Zone 56 is rotated
**0.99° from the Web Mercator grid** every XYZ tile service publishes on, which
is 180 m — about 3.7 grid cells — of skew corner to corner. Tiles in the old
frame would have sat visibly crooked under the boundaries. So `geo` is now a
Mercator rectangle, and a tile lands in it with a pure linear transform: no
warping code in the browser at all.
- Everything derived from the old frame was reprojected, not re-authored: the
  traced boundary vertices, the 13 seeded places, and the georeference.
- **Grid references are an affine now**, not a projection — fitted over the
  frame to **2.1 m worst case / 0.46 m RMS** against the 100 m digit a
  six-figure reference quotes, so no projection library ships to the browser.
  RHQ reads `GR 297 735`, 0.29 m from a true pyproj conversion.
- RHQ moved onto the surveyed point supplied for the Ex Admin Area
  (−32.763022, 151.182969 → cell 104.01, 95.79).
- ⚠️ Consequence worth knowing: a cell covers slightly different ground than it
  did this morning, so anything already painted on **Singleton** shifts by up
  to ~3.7 cells. NSW is untouched — different documents, different frame.

**Why not Leaflet**, since it was suggested. Leaflet brings its own pan/zoom,
coordinate space and DOM, and the entire territory system — hatch canvas,
beacons, derived company labels, replay animation, both exporters — is built on
one flat cell grid over one rectangle. Adopting it means rewriting all of them.
What it would actually contribute is "fetch XYZ tiles and put them in the right
place", which is ~60 lines once the frame is Mercator. So:
`TileBase.jsx` renders tiles as `<img>`s positioned in PERCENTAGES of the frame,
inside PixelMap's existing transform — the browser scales them with everything
else, nothing redraws on pan, and there is no second coordinate system.

**The static image is now the floor, not an alternative.** `singleton.webp`
renders *underneath* the tiles, so it shows before they load and is all that
shows if they never do (no signal on camp, or the service moves). A dead tile
URL degrades to this morning's map rather than a blank one. `TileBase` also
stops after 8 consecutive failures with nothing successful, and hides a failed
tile inline — a broken `<img>` otherwise paints a placeholder box, and with the
whole grid unreachable that was a screenful of torn-image icons.

**Boundaries became vectors** (`src/lib/mapLines.js`, `MapLines.jsx`, vertices
in `src/data/singleton-boundaries.json`). Tiles render over the image, so
anything baked into it is buried; as vectors they also stay hairline at 8×
instead of becoming a 40px smear. One module feeds all three renderers — the
SVG overlay, `drawMapLines()` in the exporters, and the map key via `artKey` —
so the key can't describe a colour nothing draws.

**Zoom ceiling 4 → 8**, plus the two things that ceiling forced:
- the territory canvas buffer follows the zoom (capped well short of the
  browser's texture limit) so the hatch doesn't go blocky;
- **place beacons and company labels counter-scale by 1/zoom**, holding their
  on-screen size. Previously they grew with the map — tolerable at 4×, and at
  8× "Sector 8" was a banner across half the screen.

**Verification, and its one gap.** The SIX Maps endpoint is unreachable from
this sandbox (egress blocks every tile provider; only the Sentinel S3 bucket
answers), so it is **unverified against the real service** — if imagery never
appears live, suspect the URL first. Everything around it was verified: tile
maths checked against an independent pyproj computation (placement, zoom
selection, `z/y/x` order all matched exactly), then a Mercator tile pyramid was
cut locally from the Sentinel scene and served for the real SIX URL via request
interception — **219 tiles served, 0 404s**, zoom stepping 14→15→16→17 as scale
went 1→8, no page errors. NSW re-checked: no tiles, no vector lines, no
attribution, no key toggle.

**Attribution** ("Imagery © NSW Spatial Services (Department of Customer
Service)") renders bottom-left inside the map frame, from `tiles.attribution`.

---

## 2026-09-13 — Singleton map becomes real satellite imagery + traced boundaries
Asked for satellite imagery as the map itself, unaltered, with the Areas 8 & 9
border and the Sector 8/9 divide taken off the PDF and drawn onto it. Both
done. **This replaces the flat pixel-art tile** derived from the topo sheet on
2026-09-12 — that art is superseded, not just re-rendered.

**The base is photography, not a stylisation.** `public/map/singleton.webp` is
Copernicus **Sentinel-2** L2A true colour (10 m) of the actual ground, cut to
the sheet's MGA Zone 56 bounds and given exactly one display stretch — the
imagery is never recoloured or classified.
[tools/map/build-singleton-map.py](tools/map/build-singleton-map.py) builds it,
pulling the scene from the AWS Open Data registry. That bucket is the **one**
imagery source this environment's egress proxy allows; Google, OSM, Mapbox,
NSW SIX, GA, NASA GIBS and Element84 are all blocked (and Google's imagery
isn't licensed for tracing into a committed asset anyway). Attribute as
"Contains modified Copernicus Sentinel data".

**Two lines are drawn on it, and nothing else** — yellow Commonwealth land
boundary, green Sector 8/9 boundary. The imagery already shows the highway, the
rail corridor and every paddock track; what it can't show is which ground is
Defence land and where the sectors divide.
- Traced by [tools/map/trace-singleton-boundaries.py](tools/map/trace-singleton-boundaries.py)
  into `tools/map/singleton-boundaries.json` as vertices **in grid cells**, so
  they inherit the map's georeference. A coarse seed list read off the sheet is
  snapped to boundary ink and consecutive seeds joined by a **least-cost path**
  through a two-tier ink mask, so the line follows the printed one exactly and
  only straight-lines where the sheet's ink actually stops. Seeds only have to
  be within a cell or two; the routing supplies the accuracy.
- The two-tier mask matters: with the strict tier alone the router cut the
  corner at the south-west turn (cell ~92,124), where the ink thins for ~15
  cells. The loose tier at cost 3 fixed it.
- The vertices are committed, so rebuilding the art needs no PDF.
- ⚠️ **Rejected: drawing the sheet's extracted ROAD NETWORK over the imagery.**
  Tried it; the extraction fragments wherever contours crowd, which was
  invisible on equally-coarse pixel art and reads as dirt on the lens over 10 m
  satellite. Don't reinstate it.

**Per-map image filter.** The app-wide `IMAGE_FILTER`
(`contrast(140%) sepia(60%) brightness(75%)`) exists to punch up flat pixel
art, and it destroys photography — shadowed timber to solid black, the whole
frame stained one colour. Maps may now declare their own `imageFilter`;
`imageFilterFor(map)` in [src/lib/terrainRender.js](src/lib/terrainRender.js)
is the single accessor, used by both `PixelMap` and the exporters so the page
and the exported video can't drift apart. NSW is unchanged.

**Smaller changes**
- `terrainKey` → **`artKey`** + `artKeyLabel` on the map record. It no longer
  describes terrain colours (there is no palette in a photograph) but what is
  drawn *on* the art, so the toggle now reads `+ BOUNDARIES` on Singleton and
  the field name stops lying. NSW still has none, so still shows no toggle.
- Art ships as **WebP**: the same frame is 1.4 MB as PNG and 340 KB at quality
  92, and it's the first thing the home page loads on this map. Quality 92 was
  checked against the boundary lines specifically — the one detail a lossy
  codec could plausibly hurt.
- The map record's `pixelWidth`/`pixelHeight` are now 1080×765 (5 art px per
  cell, still an exact whole-block division of the 216×153 grid).
- `derive-singleton-map.py` **no longer builds this map**. Kept, and its
  docstring says so: it documents how the sheet's legend ink colours separate,
  which is what the tracer's thresholds rest on, and the tracer imports its
  sheet loader.

**Not done** — the reference screenshot's named points (AA Oscar/Foxtrot/…, the
ropes courses, NAVEX, Quarry, Point of Entry, the Calf Pen track start) are not
added: no coordinates for them exist in anything available here, and inventing
positions on a map cadets will navigate by would be worse than leaving them
off. They are ordinary territory places — RHQ can drop each one in from
Ops Centre → Map: Territory, and the grid reference shown beside it is exact.

---

## 2026-09-12 (third) — Singleton map georeferenced; grid references on every point
Asked to rebuild the map from Google satellite/road data. **Could not**: this
environment's egress proxy blocks `maps.app.goo.gl`, `maps.googleapis.com`
without a key, and `openstreetmap.org`/Overpass as well — and Google's imagery
and road data are not licensed for tracing into a committed map asset in any
case. Said so, and took the route that needed no external data at all.

**The sheet georeferences itself.** AUSPEC0196 prints a 1000m MGA Zone 56 grid.
Fitting a comb to those lines gives **195.25 source px per kilometre** (11
vertical lines matched; the horizontal lines are obscured, so the spacing is
carried across and pinned against the printed grid numbers). Two independent
confirmations: the sheet's north edge lands on the New England Highway
alignment, and a surveyed coordinate supplied for the Ex Admin Area
(−32.762633, 151.182543) falls on cell (103.31, 95.32) — the cell it had
already been seeded at, i.e. inside one cell (~48 m).

- `geo` on the map record ([src/lib/maps.js](src/lib/maps.js)) holds the
  georeference, with `gridRefOf()` / `eastingNorthingOf()` beside it. Only the
  linear easting/northing is kept: a **grid reference** is what this map needs,
  and lat/lon would mean carrying a projection library for no operational gain.
  NSW declares no `geo` and the helpers return null for it.
- Grid references now show on the marker tooltip, in Ops Centre → Map:
  Territory's place list, and in the Staff Centre's. They are derived from the
  cell, so dragging a marker moves its GR with it — nothing to keep in sync.
- Verified every seeded reference point against the sheet feature by feature.
  Two were wrong and are fixed: **Sentry Post No10** was 10.5 cells (~500 m)
  west of the actual post symbol, and Sector 8 ~2 cells off.

**Beacon labels now flip inboard near the right edge.** Sentry Post No10 sits
in the last fifth of the sheet, and a name flowing right ran off the map — the
previous fix for that was to nudge the marker inboard, which is the wrong trade
because the dot marks real ground. It now places accurately and the label
flows left instead.

**Fixed dead code found while fitting the grid:** the generator's graticule
guard tested for a column more than 45% inked, but the grid is fine enough that
its inkiest column reaches only 31% — so the guard had never fired once. It is
replaced by a mask built from the fitted grid geometry, which is the same
constant that georeferences the map (`GRID_PX`/`GRID_X0`/`GRID_Y0` in the
script, mirroring `geo`). Contamination had been minor (4.7% of track pixels
against 3.8% expected by area) but the straight-line artefacts are now gone.

## 2026-09-12 (later) — Singleton map: the road network, and the legend on the page
The second map shipped earlier the same day was thin: the road network barely
appeared, and nothing told a reader what the colours meant. Both fixed.

**Roads: the derivation was keying off the wrong channel.** It separated ink by
"warmth" (`R-B`), which lumps the sheet's BROWN contours in with its PINK
roads — after which no amount of geometry untangles them, and the road layer
came out nearly empty. Measured against the sheet instead: contours sit at
`G-B ≈ +14`, roads at `G-B ≈ 0`, which is a clean split and is exactly the
distinction the printed legend makes. Rebuilt
[tools/map/derive-singleton-map.py](tools/map/derive-singleton-map.py) around
the legend's own ink colours, and it now carries the classes the sheet
defines: hard-surface road, loose-surface road, track/trail, railway,
watercourse/dam, sector boundary, defence area boundary, cultivated land, and
vegetation in the legend's density bands.

- **The bug that actually cost the road network** was a white-halo test meant
  to find place names. Named features do print with a halo — but so does half
  this sheet, because the cleared training paddocks ARE white. It was marking
  23% of the map as "lettering" and deleting every road crossing the open
  ground. Type is now found geometrically (dark ink that doesn't run as a
  line), which is what already worked for the "COMMONWEALTH LAND" overprint.
  There is a comment in the script so nobody reinstates it.
- Two other corrections worth knowing: red ink on this sheet is 1–2px, so the
  3x3 erosion used to find "heavy" features removed essentially all of it (now
  2x2); and contours crowd together on the scarps into a solid reddish mass
  that passes every "is this pink ink" test, so a crowded-contour guard fences
  that country off before roads or boundaries are looked for. Without it the
  escarpments drew as kilometres of phantom boundary.
- Relief shading eased back and the route palette warmed, so roads read against
  the ground they cross and still survive the page's contrast(140%) filter.

**The legend is now on the interactive map.** A map record may carry a
`terrainKey` (see [src/lib/maps.js](src/lib/maps.js)) naming what its art's
colours mean; [MapLegend.jsx](src/components/MapLegend.jsx) renders it behind a
`+ TERRAIN` toggle beside the existing company key — reference material rather
than live state, so it does not permanently double the height of the key. The
wording is the sheet's own. NSW declares no key and shows no toggle.

⚠️ The key's colours mirror the palette in the derivation script. They are two
copies of one fact: change them together or the key starts lying.

## 2026-09-12 — Second map: the Singleton Military Area, and a per-map data model
Requested: a "secondary map" — the portal carries more than one map, each with
its own independently-saved everything, signed-out visitors see exactly one of
them, and RHQ switches between them in the Ops Centre.

**The map registry.** [src/lib/maps.js](src/lib/maps.js) is new and is now the
single description of what a map is: its art, its native pixel size, its
territory grid and its unpaintable fill. `territory.js` still exports the
primary map's constants (`TERR_COLS`, `MAP_IMAGE`, …) for the code paths that
predate this, but they're derived from the registry rather than written twice.
Maps are defined in code on purpose — a map needs art committed to
`public/map` and a grid sized to it, so it is a repo change either way. What
RHQ controls is which one visitors see and everything painted on top.

- **Per-map storage, no rules change.** Each map gets its own `territory` and
  `campaignDefaultStart` slice. The primary map keeps the original unsuffixed
  document names so existing Firestore data is untouched; every other map gets
  `territory_<mapId>` / `campaignDefaultStart_<mapId>` beside them. Both are
  ordinary `content/*` docs, which the pending ruleset already covers.
- **Replay frames stay in ONE collection.** `campaignFrames` now carries a
  `map` field per document rather than getting a collection (and a rules
  block) per map; a frame written before this has no field at all, which reads
  as the primary map — exactly what it was. Consequence to remember when
  touching MapEditor: `persistCollection` deletes any document missing from
  what it is handed, so every frame write rebuilds one map's frames and
  carries the others through (`withMapFrames` in maps.js).
- **A territory says which map it belongs to** (`territory.map`), so PixelMap,
  the replay and both exporters pick up the right art, aspect ratio and grid
  with no extra plumbing. `normalizeTerritory` stamps it onto legacy data.
  Grid-mismatch rejection is now judged per map, so one map's stale frames
  can't take another map's history down with them.
- **`activeMap`** is a new single-value slice naming the map the public portal
  shows. Home and the Staff Centre read it; there is deliberately no public
  switcher. Ops Centre → Map: Territory gets the switcher, which separates
  *which map you're editing* from *which map is live* — switching the former
  changes nothing for visitors until "Show this map on the portal".
- `oceanMask.js` → **`unpaintableMask.js`**, parameterised by map. The NSW
  ocean still blocks painting; Singleton is landlocked and declares no blocked
  fill, so nothing there is unpaintable (and the editor's hint no longer talks
  about ocean tiles on a map that has none).

**The Singleton map itself.** Derived from the Defence AUSPEC0196 1:25,000
sheet (Singleton Range Special, Areas 8 & 9), 648x459 art over a 216x153 grid.
[tools/map/derive-singleton-map.py](tools/map/derive-singleton-map.py) is the
reproducible derivation, and documents its reasoning; the source PDF is not in
the repo (it is marked FOR DEFENCE PURPOSES ONLY).

- It reads the sheet by its own **legend** — green wash = vegetation density,
  warm line work = contours (the only relief signal a raster sheet carries),
  blue = drainage, white = cleared, heavy warm ink = the sealed road and the
  Commonwealth-land boundary, lavender band = the sector boundary.
- Two non-obvious things the script exists to get right. **Type is rejected
  geometrically, not by reading it**: a route runs a long way and is a thin
  line inside its own bounding box, where a word fills its own — that one test
  removes spot heights, grid numbers, place names and the big "COMMONWEALTH
  LAND" overprint without touching the highway. And the **palette is pinned to
  a narrow mid-tone band**, because the page draws every map through a
  `contrast(140%)` filter that crushes anything darker than mid-grey to black;
  the first passes looked right at full size and blocked up solid in the app.
- **`Ex Admin Area` is RHQ**, as asked: it is the seeded RHQ holding, and
  Singleton is the one map that ships with `showRHQ` on. Beacons are placed off
  the sheet — the sentry posts on the northern boundary, Sectors 7/8/9, the
  DFSW2 firing range, Yellow Billys Cave and Broken Back Range (strongholds),
  Calf Pen, Warringah, Retrans Peak.
- Verified end to end in LOCAL MODE: switching the edited map, painting and
  saving each map without disturbing the other, per-map campaign frames, the
  public replay, the weekly update image export at the new aspect, the Backups
  panel's per-map labelling, and the Staff Centre naming the live map.

## 2026-09-08 — Fixed: manually-dragged company label positions bled into every campaign replay frame
Reported: fixing a company name's on-map position (MapEditor's "Arrange
company labels manually", stored in `territory.labelOverrides`) was meant to
be a one-off escape hatch for a single tight/contested spot, but since
`CampaignReplayMap` spread the whole live `territory` object (overrides
included) onto every committed frame, the dragged position applied to the
*entire* replay history, not just the frame it was fixed for.

- Added `campaignFrames[].useLabelOverrides`: a boolean per frame, default
  unset (= automatic placement). Deliberately only ONE new field — the
  dragged coordinates themselves stay the single existing
  `territory.labelOverrides` store; this just decides which frames borrow
  them. See `frameUsesLabelOverrides()` in
  [src/lib/campaign.js](src/lib/campaign.js).
- `CampaignReplayMap.jsx` now tracks which frame index is actually committed
  to `PixelMap` (`committedIdx`, replacing the old `committed` cells-only
  state) and looks up that frame's flag each render, passing
  `labelOverrides: {}` to `PixelMap` for any frame that hasn't opted in.
- Added a "Manual labels" checkbox to each frame row in Map: Territory's
  Campaign replay panel ([MapEditor.jsx](src/pages/ops/MapEditor.jsx)),
  writing straight to `campaignFrames` like the existing relabel/reorder
  actions (not staged behind "Publish frame changes" — same immediacy as
  "Set as Default Start").
- Not touched: the live map / ops preview always applies
  `territory.labelOverrides` as before (there's no frame concept there to
  gate on) — this only affects the public/Staff Centre campaign replay.
- Pushed to `claude/map-label-frame-toggle-mgerph` for review before merging
  to `main`.

## 2026-08-24 — Fixed: concurrent intel approvals/edits could silently overwrite each other
Root-caused reported data loss ("approved different intel fragments in two
windows, then some disappeared"). `intel` is loaded once into each tab's React
state on page open with no live listener, and every add/edit/delete path —
Approvals' `publish`, the ops Intel editor, and the fragment-restore added
above — computed its new array from that tab's own copy and then did a blind
`setDoc` overwrite of the whole `content/intel` document. Two RHQ windows
approving *different* submissions around the same time each held a
now-stale copy of the array; whichever save landed second silently wiped out
whatever the other had just added, with no merge and no error. This is the
one slice where several independent single-fragment write paths plausibly run
concurrently in separate windows — everything else (map, narrative text,
branding) is realistically edited by one screen at a time.

- Added `mutateIntel(mutate)` in `src/lib/store.js`: a Firestore
  `runTransaction` that reads the array fresh at write time, hands it to
  `mutate`, and writes the result back atomically (LOCAL MODE re-reads
  localStorage fresh instead, for the same-device multi-tab case). Two
  concurrent single-fragment writes now serialise and merge instead of one
  clobbering the other.
- Added `DataContext.updateIntel(mutate)`, wrapping `mutateIntel` with the
  existing backup-on-replace and React-state-sync behaviour `updateSlice` already
  had. `ApprovalsQueue.publish`, `IntelEditor`'s upsert/remove, and
  `BackupsPanel`'s per-fragment restore now all go through this instead of
  `updateSlice('intel', wholeArrayComputedFromStaleState)`.
- Nothing else changed: whole-slice operations (the "Restore whole version"
  button, everything on every other content slice) still use plain
  `updateSlice` — a full-array replace is the deliberate intent there, not a
  bug to route around.
- Not covered by this fix: two people hand-editing the exact same fragment's
  fields at the same time will still have one edit win outright (last write,
  same as before) — the transaction only protects against two DIFFERENT
  fragments/ops colliding, which is what was actually reported and is the
  realistic case (Approvals is inherently one-fragment-per-action). A true
  field-level merge for simultaneous edits of one fragment was judged not
  worth the complexity.

## 2026-08-23 — Backups: restore individual Intel fragments, not just the whole slice
Restoring an `intel` backup previously only replaced the entire live array —
if RHQ needed back just one or two fragments that a later edit had dropped
(e.g. an import overwriting a hand-written one), the only option was to
revert *every* fragment to that older snapshot, discarding anything written
since. Fine when the whole slice regressed; wrong when only a couple of
items were lost.

- Opening an Intel backup (Backups → open a version) now shows an
  **"Individual fragments"** panel listing every fragment in that backup,
  each tagged **Missing from live now** / **Differs from what is live now** /
  **Identical**, with its own **Add back** / **Overwrite live** button
  (`IntelFragmentsView`, `BackupsPanel.jsx`). Restoring one fragment merges it
  into the *current* live `intel` array (by `id`) via the ordinary
  `updateSlice('intel', …)` path — so it still backs up what it replaces, and
  every other fragment written since is left untouched.
- Whole-slice restore is unchanged and still available ("Restore whole
  version") for when the entire snapshot is what's wanted back.
- Scoped to `intel` specifically (the only single-value slice that's an array
  of `{ id, … }` items) rather than generalised to every slice — nothing else
  under `SINGLE_SLICES` has that shape today.

## 2026-08-17 — Company map labels no longer stack on each other; manual override for the rest
`companyLabels.js` derived each company's name-label position purely from its
own holding, with zero awareness of where any OTHER company's label landed —
so companies holding adjacent/interleaved ground (the normal case at a
contested border) could get poles only a few cells apart, and the on-screen
text piled up into unreadable stacks (e.g. "A-COY/B-COY/D-COY/S-COY" all
overlapping in a tight contested cluster).

- **Automatic fix**: `companyLabelPoints` (and `mergedGainLabels`, used by the
  weekly export image) now place one company at a time and feed each already-
  placed label back in as an avoid point for the rest (`LABEL_AVOID_RADIUS =
  24` cells, wider than the 10-cell place-avoidance since text needs
  horizontal room, not just a clear point). Verified via synthetic grids run
  through the real module in-browser: wide, well-separated holdings are
  unaffected (no-op, as expected); moderately tight holdings get visibly
  spread apart (min label spacing went from 18 to ~24 cells in one test case).
  Font size and everything else about label rendering is unchanged.
- **Known limit, addressed by the next item**: when a company's entire
  holding sits within the avoid radius of a neighbour's label — a genuinely
  narrow multi-way contested pocket — there's nowhere left to place it that
  clears the radius, and the code falls back to the pre-fix "ignore
  avoidance" placement. Confirmed via a deliberately pathological synthetic
  case (five 10-cell-wide adjacent stripes) that reproduces the reported
  overlap almost exactly.
- **Manual override, for that residual case**: Map: Territory has a new
  **"Arrange company labels manually"** checkbox. When on, the live paint
  canvas shows the derived labels (normally hidden while painting, since a
  label over cells you're editing is in the way) and each one becomes
  draggable, the same interaction as place-name markers. A dragged position
  is stored per company in `territory.labelOverrides` (`{ [code]: {x, y} }`,
  a new key on the existing `territory` slice — no rules change needed) and
  persists only on "Save map", same as everything else in that editor.
  Companies without an override keep placing themselves automatically —
  including steering clear of a manually-placed one, since overrides feed
  into the same avoid-list mechanism the automatic placements use. A new
  "Company label positions" panel lists any overrides with a per-company and
  a "reset all" button back to automatic. `PixelMap.jsx`'s existing
  place-marker drag plumbing (`dragging.current`) was generalised to carry
  `{ place: id } | { label: code }` instead of a bare place id, so both drag
  types share one pointer-event path. The two canvas export functions
  (`exportCampaignReplay`, `exportProgressImage`) now also pass
  `territory.labelOverrides` through, so exports match what's on screen.
  End-to-end verified in a local-mode sandbox (`VITE_FIREBASE_DISABLE=1`, no
  production Firebase touched): seeded the pathological overlap, signed in as
  the bootstrap admin, toggled the checkbox, dragged two labels via real
  pointer events, saved, and confirmed the public Home page rendered
  identically to the ops editor's saved state.

## 2026-08-17 — Campaign replay: no more phantom frame, and frame edits stage locally
Two related fixes to confusing behaviour in the Campaign Replay system
(Map: Territory + the public replay it drives).

- **Removed the "live drift" synthetic frame.** `CampaignReplayMap.jsx`
  used to silently append `state.territory.cells` as an extra, unlabelled
  "Current state" bubble on the public timeline rail whenever it differed
  from the last recorded frame — so the live map masqueraded as a real frame
  that nobody could see, edit, relabel or delete from the Map: Territory
  panel, because it wasn't actually a `campaignFrames` doc. Once any frames
  are recorded, the public replay now shows **only real, saved frames** —
  the live territory is purely the starting point for the *next* frame you
  choose to add, never part of the replay on its own. Trade-off: if RHQ
  paints the live map and saves without also clicking "+ Add Frame from Live
  Map", the public site keeps showing the last recorded frame until they do
  — no more automatic, invisible sync. To make that deliberate rather than
  surprising, **Map: Territory** now shows a "Live map has changed since the
  last recorded frame" notice (with its own Add Frame button) whenever the
  two differ.
- **Repainting a frame no longer publishes immediately.** "Update Frame" used
  to write straight to the live `campaignFrames` collection the instant you
  clicked it. It now only stages the paint job in local editor state
  (`draftFrameCells`, keyed by frame id) — the frame row gets an
  **● UNPUBLISHED** tag, and a banner with a **Publish frame changes** button
  appears whenever any frame has a pending edit. Nothing reaches the public
  site until that button is clicked (one write for every pending frame).
  Re-opening Edit on a staged frame resumes from the staged paint. Every
  OTHER campaign action (relabel, reorder, duplicate, delete, Set Default
  Start) is unchanged — still instant, per explicit user decision (only the
  cell-painting step needed staging, not the whole panel). Deleting a frame
  or clearing the whole replay also drops any pending staged cells for it.
- Verified in the browser (LOCAL MODE): seeded two frames, edited the second
  frame's cells and clicked "Update Frame" — confirmed via localStorage that
  `campaignFrames` was untouched — then clicked "Publish frame changes" and
  confirmed the write landed. Separately confirmed the public replay's frame
  rail shows exactly the real recorded frames (no phantom bubble) even with
  the live territory deliberately left drifted.

## 2026-08-17 — Map: Territory gets a "Preview Map" button
- New **Preview Map** button in [MapEditor.jsx](src/pages/ops/MapEditor.jsx),
  next to "Save map". Opens a portalled modal (`PreviewMapModal`, same
  `createPortal`-to-`document.body` pattern as `LoginModal`/`ConfirmDialog` —
  the sticky nav rail / fixed drawer would otherwise trap a `position: fixed`
  modal under page content) showing the **exact same `PixelMap` +
  `MapLegend` the public Home page renders at rest** (`showCompanyLabels`
  on, unlike the editor's own canvas which keeps it off on purpose since a
  label over cells being painted just gets in the way).
- Fed from `canvasCells` — whatever's currently on the paint canvas, i.e.
  `editing.cells` while repainting a historical campaign frame, otherwise the
  live `terr.cells` — **including unsaved strokes**. Lets RHQ sanity-check a
  painting (fills, place labels, where a company's derived name lands) before
  committing to "Save map", without needing to save-then-check-then-fix.
  Doesn't touch `state.territory` or any other slice — pure read of local
  editor state.
- Verified in the browser (LOCAL MODE): painted an unsaved Bravo stroke,
  opened Preview Map, and confirmed the modal showed the stroke plus a live
  "B-COY" label and the map key — all before "Save map" was ever clicked.

## 2026-08-16 — Recent Movements: a movement can now credit up to all six companies
- `narrative.movements` entries moved from a single `company` letter to a
  **`companies` array** (up to all six non-RHQ companies). `movementsOf()` in
  [seed.js](src/firebase/seed.js) normalises every entry to `companies` —
  an old entry that only has `company` is read as a one-element array — so
  nothing already saved needed migrating.
- **Home** ([Home.jsx](src/pages/Home.jsx)): the single company badge next to
  a movement's text is now a `BadgeCluster` — a small CSS grid, not a wide
  row, so a multi-company credit stays compact instead of pushing the row
  wide. Column count is chosen per count for the tightest packing: 1→1x1,
  2→2x1, 3→3x1, 4→2x2, 5→3+2, 6→3x2 (`CLUSTER_COLS`).
- **Ops Centre → Map: Narrative** ([NarrativeEditor.jsx](src/pages/ops/NarrativeEditor.jsx)):
  the per-row company `<select>` (one company only) is now a row of six
  letter-toggle chips — click any subset on/off. Matches the fixed set of six
  non-RHQ companies exactly, so "max of six" needed no separate cap.
- **Staff Centre** ([StaffCentre.jsx](src/pages/StaffCentre.jsx)) movements
  detail label now joins `companies` (`A/B/C-COY`) instead of reading the old
  single `company` field.
- Verified in the browser (LOCAL MODE): toggled a movement to three
  companies in the ops editor, saved, and confirmed the home page rendered
  the A/B/C cluster; also spot-checked the 1–6 badge count layouts directly
  against seed data.

## 2026-08-13 — One shared intel-fragment form; approvals can now edit everything and SEE the handouts
- **New [FragmentForm.jsx](src/components/FragmentForm.jsx)** — the fragment
  fields + resources panel, now used by all three places a fragment is authored:
  Ops Centre → Intercepted Intelligence, the COY Centre builder, and the
  Approvals review screen. They were three near-identical copies, and the
  approvals one had **silently fallen behind**: no `hint` field, no image
  upload, and the resources block only rendered `if (resources.length > 0)`, so
  a submission that arrived with none could never have any added. A reviewer who
  can't change a field can only dismiss and ask the commander to redo it, which
  defeats the point of the queue.
- Callers pass their own **`audience`** node (RHQ gets the `<select>`; the COY
  Centre and Approvals get a read-only line) because both of those paths
  re-stamp `company` on save — a picker there would misreport what gets written.
- **Resources are now shown as what they are**, not as a filename: image
  thumbnails with click-to-expand, links openable in a tab, and both the title
  and a link's URL editable inline. This is the "visualise the handouts" half of
  the request and it landed in the shared component, so all three screens got it.
- Oversized images now say so (`> 150 KB, resize it`) instead of silently
  dropping the file — the cap exists because resources are inlined as data URLs
  into the world-readable `intel` slice.
- Approvals also gained: **👁 Preview as recruit** on the review screen (the same
  inert `IntelPreview` the authoring screens use), and a one-line attachment
  summary on each queue row (`📄 document · 🖼 2 images · 💡 hint`) so a reviewer
  can see a submission carries a handout before opening it.
- `attachmentSummary` lives in [src/lib/fragments.js](src/lib/fragments.js), not
  beside the component: a module that exports both a component and a plain
  function breaks React Fast Refresh, and Vite was logging a full-reload
  invalidation on every edit to FragmentForm.
- No data-model, rules or auth change — same `intelSubmissions` → `content/intel`
  flow as before.
- **Verified**: `npm run build` clean; all four changed modules transform under
  the dev server; a headless `renderToString` pass over FragmentForm in all
  three caller shapes — including a **legacy submission missing the `hint`,
  `docUrl` and `resources` keys**, which is the realistic shape of anything
  already sitting in the queue.

## 2026-08-09 — Privacy notice rewritten for the no-login majority; timeline rail overflow fix
- **[Privacy.jsx](src/pages/Privacy.jsx) restructured around who actually reads
  it.** Only ~20 of ~800 unit members hold a login, so the notice now opens with
  "nothing about you is stored — which covers almost everyone in the unit", and
  the roster fields moved down into a separate *"If you've been issued a login"*
  section. It previously led with roster/login material, which implied every
  reader had a record.
- Softened the "full roster access is limited to RHQ staff" line: it now says
  the roster holds the details staff entered "and nothing about how anyone uses
  the site" — the real reassurance is that no per-member activity is logged.
- **Password wording is deliberately split in two.** The notice states that the
  password a member *chooses* is hashed by Firebase Auth and unreadable by
  anyone including RHQ (true), and says only that the one-time registration code
  "isn't your password". It does **not** claim temp passwords are hashed,
  because they are still stored plain text in `roster` and RHQ reads and exports
  them ([UsersAdmin.jsx](src/pages/ops/UsersAdmin.jsx) — the table cell and the
  temp-password sheet). **If temp passwords are ever hashed, strengthen this
  section in the same commit**; until then don't let the claim widen.
- Contact routing rewritten — the **Help** option no longer exists in the nav,
  so it now points at chain of command / unit staff / a direct email, and tells
  readers without a login there is nothing to correct or remove.
- **Fixed: the campaign timeline rail gave the whole page a horizontal
  scrollbar.** `.replay-bubble-tip` was centred on its bubble, so the *last*
  bubble's tip extended past the rail's right edge — and an `opacity: 0` element
  still contributes to scrollable overflow, so this happened without anyone
  hovering, the moment the rail rendered. The sticky header then sat one
  viewport wide while the body scrolled wider, which is what read as the title
  bar "not aligning". Tips are now anchored by `--tip-p` (the bubble's 0..1
  position along the rail): left-aligned at the first bubble, right-aligned at
  the last, centred in between, and width-capped so a long RHQ frame label wraps
  instead of growing without limit.

## 2026-08-05 (ops) — Backups: automatic version history for all content
- **New "Backups" section in the Operations Centre** (ADMIN group) — the past
  versions of everything RHQ edits: the map, the narrative, briefings, intel,
  branding, the welcome page, company pages, staff access.
- **Capture has exactly ONE hook**: `DataContext.updateSlice` files the value it
  is about to overwrite before writing the new one. Every editor already saves
  through `updateSlice`, so no editor needed changing — and any future editor
  gets history for free. This is why it's worth resisting any temptation to
  write slices directly from a component.
- Entries carry `{ slice, value, ts, by, byId, size }`. `AuthContext` pushes the
  signed-in user down via a new `setBackupActor` (it is mounted *inside*
  `DataProvider`, so it cannot be pulled up).
- **Skipped** when the value is unchanged (repeated Saves don't pile up
  duplicates), undefined, over 600 KB, or unserialisable. `recordBackup` never
  throws — a failed backup must not be the thing that stops RHQ saving.
- **20 versions kept per slice**, pruned on write. Painting the map is the
  expensive case at ~24 KB per snapshot, which is what set that ceiling.
- **No composite index needed, deliberately.** `where('slice','==',…)` +
  `orderBy('ts')` would require one created by hand in the console, and this
  repo's standing problem is console steps nobody performs. Filtering and
  sorting happen client-side over a small capped set instead.
- **Restore is an ordinary save**, so it backs up the version it replaces — the
  undo is always undoable. Also per-entry Download, Delete, and a
  **"Download everything"** JSON of all current content + campaign frames, for
  a copy that survives the Firebase project itself.
- **Deliberately NOT versioned**, and the panel says so in its own copy:
  - `roster` — the one collection holding personal data (names, IDs, emails,
    plain-text temp passwords). Copying it into a second collection on every
    edit would multiply that exposure for no operational gain.
  - `campaignFrames` — already an explicit, editable history, and snapshotting
    the whole set would push one document near Firestore's 1 MiB limit.
- `staffAccess` IS versioned, which is safe precisely because `backups` is
  **RHQ-read-only** under the rules — unlike the world-readable `content/*`
  documents it snapshots. Immutable too: `allow update: if false`.
- ⚠️ **Needs the pending rules republish** (HANDOVER §0) before the panel can
  list anything. Capture still runs meanwhile — writes fail silently by design —
  and the panel names §0 in its error rather than looking broken.
- Verified with throwaway harnesses, 28 checks: per-slice change summaries
  (cell-diff counts for the map, added/removed for arrays, changed keys for
  objects), size formatting, the roster exclusion in the full export, and a
  LOCAL MODE round trip covering pruning at the cap, newest-first ordering,
  per-slice isolation, duplicate detection and all three skip paths. The
  Firestore path is unverified — see HANDOVER §3.

## 2026-08-05 (ops) — Briefings video: paste an embed code
- **The Briefings video field now takes a full `<iframe …>` embed code**, not
  just a link. It also stops mangling the cases it always should have handled:
  a YouTube **Share → Embed URL** (`youtube.com/embed/<id>`), `/shorts/`,
  `/live/`, `youtube-nocookie.com`, Vimeo's **unlisted** `/<id>/<hash>` form
  (the hash has to travel as `?h=`, or the embed is refused), and Google Drive
  `/file/d/<id>/view` → `/preview` (the `/view` page refuses to be framed).
  Every one of those previously fell through to a bare "Open video ↗" link.
- **Vimeo specifically** resolves from every shape it hands out: the share link,
  the unlisted `/<id>/<hash>` link, the `player.vimeo.com` URL, the real embed
  block (Vimeo wraps its `<iframe>` in a sizing `<div>` and follows it with a
  `player.js` `<script>` — both are ignored, only the src is read), and the
  longer paths that bury the id at the end: `manage/videos/<id>` (the dashboard
  URL, i.e. what's in the address bar while you look at your own video, so the
  likeliest paste of all), `channels/…`, `groups/…/videos/…`,
  `showcase/…/video/…`. Live events use their own `/event/<id>/embed` form.
  `/ondemand` stays a link — it's a purchase page with no plain embed.
- **The pasted string is stored as-is** and re-resolved at render. That keeps a
  signal we'd otherwise lose: an embed code is RHQ explicitly saying "this is
  meant to be framed", which is what lets an **unrecognised** provider
  (SharePoint, Stream, Canva, anything the unit gets handed) embed properly
  instead of degrading to a link. The HTML is never injected — only its `src`
  is read out.
- ⚠️ **Scheme guard added and load-bearing**: only `http:`/`https:`/`blob:`
  srcs are accepted. A `javascript:` or `data:` src inside a pasted embed code
  would otherwise execute in the page's origin. Don't drop it when adding a
  provider.
- The link input became a 2-row textarea (an embed code doesn't fit a one-line
  field) with a live note under it saying what the value resolved to — embed
  recognised / direct file / unrecognised provider / unusable — so a bad paste
  shows up in the editor rather than on the live site.
- Verified with a throwaway harness over 24 inputs: every provider shape above,
  protocol-relative `//` srcs, `&amp;`-escaped embed params, an iframe with no
  src, and four hostile inputs (`javascript:`/`data:` in an embed code and
  bare) which all resolve to `null`.

## 2026-08-05 (access) — Staff roles, RHQ Staff approvals, password out of code
- **The Staff Centre password is no longer hard-coded.** It moved from a
  `const STAFF_PASSWORD` in StaffCentre.jsx to the new `staffAccess` single-value
  slice, edited in **Ops Centre → Users** by the bootstrap administrator (ID
  190990) only — nobody else, including other RHQ accounts, even sees the panel.
  - A **missing doc falls back to the seed default**, so `SCUNARRATIVE` keeps
    working until it's changed — deploying this locks nobody out.
  - An **empty** stored password matches nothing, so a misconfigured slice fails
    closed instead of becoming an open door.
  - ⚠️ This did **not** make it a secret. `content/*` is world-readable (the
    public site must work signed-out), so it is exactly as recoverable as it was
    in the JS bundle. Still fine for the same reason as before — the page shows
    only already-public content, no PII, no write access — but it is a latch,
    and anything needing real authority now uses an account instead.
- **Two new roles** (`ROLES` in seed.js), both of which land in the Staff Centre
  and **neither of which is `isRHQ`**, so neither can reach the Ops Centre or
  the COY Centre:
  - **`Staff`** — the read-only overview, signed in and attributable.
  - **`RHQ Staff`** — the same PLUS a working COY intel approval queue across
    **every** company: approve, edit-then-approve, dismiss.
- **Only ID 190990 can create staff logins.** Other RHQ accounts get the role
  dropdown with both filtered out; opening an existing staff user shows the role
  **frozen rather than absent**, because silently dropping the option would let
  a save rewrite their role to whatever landed in the empty `<select>`. Enforced
  in the **UI only** — the rules don't distinguish one RHQ from another. The
  spreadsheet import can't mint staff either (it hard-codes `COMMANDER_ROLE`).
- **Approval queue extracted** to [ApprovalsQueue.jsx](src/components/ApprovalsQueue.jsx),
  used by BOTH Ops Centre → Approvals and Staff Centre → Approvals; only the page
  chrome differs, via a `Header` prop taking `{ title, sub, children }`.
  `SubmissionsEditor.jsx` is now a three-line wrapper — **put queue changes in the
  shared component**, or the two surfaces drift.
- `useAuth()` gains `isStaff`, `isRHQStaff` and `isAdmin` (ID 190990), all
  suppressed while emulating like `isRHQ`. `ADMIN_ID` is now exported.
  TopBar/Sidebar gain a role-aware **STAFF CENTRE** button.
- The Staff Centre gate now offers **Sign in** alongside the password box, and a
  signed-in account gets **Sign out** where the password visitor gets **Lock**
  (that page has no TopBar, so there was otherwise no way out).
- **`firestore.rules`**: new `isRHQStaff()` granting exactly three things —
  read/write `intelSubmissions`; write **`content/intel` only**, via an extra
  `match /content/intel` block (overlapping matches are OR'd, so every other
  `content/*` doc stays RHQ-write-only); and **create-only** on `audit`, so it
  logs what it approved but can't read the log back.
- ⚠️ **RHQ Staff approvals do not work live until the rules are republished** —
  the same pending console action as everything else in HANDOVER §0. Approving
  will fail with a permission error against the live project until then. The
  audit write is best-effort and already swallowed, so that part degrades quietly.
- Not browser-verified. See HANDOVER §3.

## 2026-08-04 (ops) — Drag-and-drop briefing video upload
- **You can now drag a video file straight into Ops Centre → Briefings.**
  Previously the only option was pasting a URL, which meant uploading to
  YouTube first. The link field is **still there** and still the better choice
  for anything long (see the caveat below) — the drop zone sits above it.
- New [VideoDropZone.jsx](src/components/VideoDropZone.jsx): drag a file, click
  to browse, or drop a *link* (dragging a video's address bar works). Upload
  progress + Cancel, inline errors, preview, Remove.
  - It installs a **window-level `dragover`/`drop` guard** while mounted. A file
    dropped just outside the zone otherwise makes the browser navigate to it,
    binning every unsaved edit in the editor.
- New [videoUpload.js](src/lib/videoUpload.js): the app's **first and only** use
  of Firebase Storage — every other asset is a repo file under `public/`.
  Uploads to `briefings/<timestamp>-<name>`, 512 MB cap, resumable + cancellable.
  Non-MP4/WebM files upload but raise a playback warning rather than being
  blocked. LOCAL MODE hands back an object URL so the UI is testable offline,
  with a loud "this cannot be published" note.
- New **[storage.rules](storage.rules)** — public read on `briefings/*`, RHQ
  write/delete (RHQ read from the Firestore user profile, same definition as
  `firestore.rules`), size + content-type pinned, everything else denied.
- ⚠️ **Two console actions before this works live** (neither is a code change):
  enable Storage for the project, then publish `storage.rules`. Until then
  uploads fail with `storage/unauthorized` and the drop zone says so and points
  at the link field — it degrades to exactly the old behaviour, nothing breaks.
  Note Firebase now requires the **Blaze** plan to enable Storage on projects
  created after Oct 2024; this project's `.firebasestorage.app` bucket name
  suggests it is one.
- `briefings.videoPath` added to the slice — the Storage object path when the
  video was uploaded here, empty for an external link. Used only to label the
  file and to tidy up *this session's* abandoned uploads; the already-published
  object is never auto-deleted (the RHQ user may walk away without saving).
- `resolveVideo()` in [VideoEmbed.jsx](src/components/VideoEmbed.jsx) now
  recognises `firebasestorage.googleapis.com` / `storage.googleapis.com` by
  **host**: the filename is inside the escaped object path and an uploaded file
  may have no extension at all, so the old `\.mp4$`-on-pathname test would have
  rendered an uploaded video as a bare "Open video ↗" link. Also added
  `mov`/`m4v`/`ogv` and `blob:` (the LOCAL MODE preview).
- Not browser-verified — no browser automation here. See HANDOVER §3.

## 2026-08-04 (home page) — Recent Movements box, Meridian boxes merged
- **New "Recent Movements" box** on the home page, above the company-roles box.
  Short entries — one per company action that actually moved the line — so the
  map's current state has an explanation next to it. The roles box says what a
  company is *for*; this says what it has *done*.
  - Stored as `narrative.movements` (`{ show, title, intro, entries: [{ id,
    company, text }] }`) — a key on the existing slice, so no new Firestore
    collection and **no rules change**. Seeded with filler entries.
  - `movementsOf()` in [seed.js](src/firebase/seed.js) merges older stored
    narratives that predate the key, exactly like `smeacOf()`. `entries` is
    defaulted separately from the rest: a narrative CAN legitimately have an
    empty list (RHQ deleted every row) and that must not resurrect the filler —
    only a missing key does.
  - **RHQ-toggleable**: a "Show on site" checkbox in Ops Centre → Map:
    Narrative hides the whole box, so it never sits there stale between
    updates. Removing every row hides it too. Rows are free-form (add/remove/
    reorder, company picker each) rather than one fixed row per company —
    most weeks only a couple of companies actually move.
  - Also surfaced in the Staff Centre narrative detail view.
- **Fixed the background seam on long pages** ([index.css](src/index.css)). The
  two ambient corner glows were background layers on `<body>`, but
  `html, body { height: 100% }` pins the body box to VIEWPORT height — so the
  gradients were sized and positioned against that box, not the document. The
  bottom-left teal glow anchored itself one screen down instead of at the
  bottom of the page, and everything past the body box fell back to flat
  `--bg`, leaving a hard horizontal edge across every page taller than the
  window. Moved both gradients into the existing `body::before` fixed overlay
  (with per-layer `background-size`, since the grid tiles at 40px while the
  gradients fill the viewport). Being `position: fixed` they're sized to the
  viewport by construction, so no page length can produce an edge.
- **The two Meridian boxes are now one, with two headings.** Was two panels and
  three headings (OBJECTIVE / MOTIVE / WHY WE STOP THEM), which gave the threat
  more of the page than it warranted. No RHQ copy was dropped: `whyStop` keeps
  its paragraph but runs on under MOTIVE instead of carrying its own heading —
  it's the consequence of the motive, not a separate topic. `whyHeading` is no
  longer rendered anywhere, and the ops editor now says so in place of the old
  "Box 3 heading" field. Staff Centre mirrors the same two-heading shape.

---

## 2026-08-04 (intel) — Hints, decrypt progress, anonymous solve counts, author preview
Framing that drove all of this: intel fragments are a **fun optional side
activity**, not a delivery channel for must-know unit admin. So difficulty is a
feature (no forced reveal), but nothing brings a cadet back to an optional thing
except visible accumulation — hence progress being the centrepiece.

- **Hints.** New optional `hint` field on a fragment, set in both the RHQ intel
  editor and the COY Centre. Cadet-side it sits behind a `? Hint` button — opt-in,
  so nobody who wants the puzzle intact has it spoiled. No forced/automatic
  reveal: with nothing critical behind the answer, being stuck costs nothing.
- **Decrypt progress, device-local**
  ([intelProgress.js](src/lib/intelProgress.js)). Solved fragment ids in
  localStorage — same no-auth posture as [useUnseen.js](src/hooks/useUnseen.js),
  because the public tabs have no accounts to attribute a solve to. Counts only
  fragments that actually have an answer (a fragment with none is a notice, not a
  puzzle, and would sit in the denominator forever). Scoped to what the visitor
  can see — unit-wide + own company — via the same `visibleIntel()` the unread
  alert uses, so the meter and the alert can't disagree.
  - **Intel tab**: `IntelHeader` — ONE panel carrying both the RHQ intro copy
    and the progress meter (they're the same thought, and two near-identical
    stacked panels looked like a mistake). Intro title left, big `04 / 07`
    opposite it, intro paragraph under, and a segment bar along the bottom —
    one lit `.decrypt-seg` per puzzle, whole panel glowing accent when all are
    done. Either half can be absent (intro hidden / no puzzles yet) and the
    panel still composes. Fragment cards show ✓ decrypted / Review, and
    reopening a solved fragment restores the answers rather than re-asking.
  - **Home**: the existing red alert now also carries "N STILL ENCRYPTED". When
    there's nothing NEW but puzzles remain, a **quiet accent variant**
    (`.alert-banner.quiet`, no blink) nudges instead — deliberately not
    threat-red, since "you haven't finished" is not the same event as "RHQ
    posted something".
- **Anonymous decrypt telemetry** ([intelStats.js](src/lib/intelStats.js), new
  `intelStats` Firestore collection). One doc per (company, fragment) holding
  `{ company, fragmentId, solves, lastAt }` — **no name, ID, login or device
  identifier**. Written with a merge + `increment(1)`, fired only on a device's
  FIRST solve of a fragment (deduped through the localStorage record above), and
  every failure is swallowed so telemetry can never interrupt a puzzle.
  - `firestore.rules`: public read, public **create with `solves == 1`** and
    **update of exactly +1** that may not rewrite which company/fragment the doc
    is about, shape-pinned to those four fields; delete is RHQ-only. The Intel
    tab has no login, so public write is unavoidable — the rules make the worst
    case "inflate one counter, one request at a time", never forge or move a
    total. ⚠️ **Not emulator-verified** (like the `campaignFrames` block).
  - Ops Centre → Intercepted Intelligence gained a **Decrypts** panel: total,
    per-company split, per-fragment counts, and an explicit call-out of
    fragments with **zero** solves (they have no stats doc, so they'd otherwise
    be invisible — and a zero is the most useful number here). Labelled an
    engagement signal, not a score, because it counts devices and isn't
    tamper-proof.
- **Stopped Chrome's "Save ID card" prompt on the intel answer boxes.** Chrome's
  identity-document autofill was classifying an answer box as a document
  *Number* field and offering to save what a cadet typed. `autoComplete="off"`
  does not cover that path — Chrome ignores it there and falls back to its own
  classifier, and a short, nameless, dot-placeholdered text box sitting in a row
  is close to what that classifier expects an ID number to look like. Each box
  now carries an explicit `name`/`id`/`title` naming it as a decrypted word
  (an unambiguous non-identity signal for the classifier) plus the
  `data-1p-ignore` / `data-lpignore` / `data-form-type` opt-outs the third-party
  password managers read. Heuristic, not a guaranteed switch — if a future
  Chrome still misfires, the only certain fix is not using `<input>` here.
- **Stopped Chrome offering to "save your info" in the ops Users dialog**
  ([UsersAdmin.jsx](src/pages/ops/UsersAdmin.jsx)). Name + student ID + email in
  one dialog is exactly the cluster Chrome's address/contact autofill
  recognises, and it was offering to save it — except the details in that
  dialog are some OTHER cadet's, so accepting would file a member's name, ID
  and email into the RHQ staffer's personal Google autofill profile and sync it
  to their account. Fixed with `autoComplete="off"` on every field in the
  dialog (Chrome honours it for contact autofill; the documented exception is
  passwords). Password save prompts on the real login are left alone — those
  are wanted.
- **Answer input reworked** (`AnswerBoxes` in [Intel.jsx](src/pages/Intel.jsx)).
  Kept word-per-box rather than collapsing to one free-text field, because the
  split is what makes per-word marking possible — "the second word is wrong" is
  the difference between a cadet adjusting and a cadet giving up. So the
  fiddliness got fixed instead: boxes **grow as you type** (they were pinned to
  the answer word's length, so a longer guess scrolled out of sight inside the
  box), **space** jumps to the next word and **backspace in an empty box** jumps
  back, arrows cross box boundaries, **Enter** submits, and pasting or typing
  several words at once **spreads them across the boxes** from wherever the
  caret is — decode the phrase elsewhere, paste it in one go. Autocorrect,
  autocapitalise and spellcheck are all off: a phone "fixing" a decoded word
  into a real one is indistinguishable from a wrong answer.
- **Preview as recruit** ([IntelPreview.jsx](src/components/IntelPreview.jsx)) in
  both editors. Renders the REAL `FragmentView` (now exported from
  [Intel.jsx](src/pages/Intel.jsx)) against the unsaved draft rather than a mock,
  so the thing most worth checking — how many answer boxes the solution string
  produces — is exactly what's checked. A `preview` flag keeps it inert: no solve
  recorded, no telemetry, so an author testing their own puzzle can't move RHQ's
  counters.
- **Privacy notice updated** ([Privacy.jsx](src/pages/Privacy.jsx)): a new
  "Decrypt counts" section spelling out exactly what's sent and that it can't
  identify anyone, plus device-storage wording covering solved fragments. The
  old "the public pages collect nothing" line was no longer true and had to go.
- Verified: pure-logic harness over `decryptProgress`/`markSolved`/`summarise` —
  non-puzzle fragments excluded from the denominator, other companies' fragments
  excluded, telemetry fires exactly once per fragment, roll-up keeps counts for
  deleted fragments. UI not browser-verified.

---

## 2026-08-04 (later) — Timeline rail, derived company names, map key, weekly-image fix
- **Replay transport is now a "train line"**
  ([CampaignReplayMap.jsx](src/components/CampaignReplayMap.jsx)): a **▶ PLAY**
  button plus one **bubble per recorded frame** on a single rail that fills as
  playback advances. Hover/focus a bubble to see that frame's label ("Week 5");
  click it to cut straight to that frame — an instant swap, never an animated
  replay of everything in between. **Playback no longer pauses**: PLAY runs
  from RHQ's default start frame through to the live state, and clicking a
  bubble mid-play simply snaps there and stops. **PLAY resumes from whichever
  frame is on screen** — click a bubble, press PLAY, and the campaign continues
  from there; only pressing PLAY while already at the live state (where
  "continue" would mean nothing) restarts from the default start frame. This
  REPLACES the earlier
  play/pause + skip buttons, the thin progress bar and the "Jump to a frame…"
  dropdown (all removed) — the bubbles are the picker now. Frames before the
  default start still appear on the rail and are still clickable; they're just
  skipped by the automatic playback, as before.
- **New: derived per-company name labels on the map**
  ([companyLabels.js](src/lib/companyLabels.js)). The grid has no zone
  entities, so "where does A-COY's name go?" is computed from the cells every
  render: split the owner's cells into connected components, keep the
  **largest**, then place the name at that component's **pole of
  inaccessibility** (deepest cell by multi-source BFS inward from its
  boundary). A plain mean-of-coordinates centroid was rejected because it lands
  *outside* concave/ring/split holdings, which is the common case here.
  Holdings under `MIN_LABEL_CELLS` (45) get no name. Because it's derived, the
  labels track the campaign replay frame-by-frame with no authoring and no
  stored state, exactly like the place beacons.
  - Shown on the **public map, the Staff Centre map and both exports**;
    deliberately **NOT** in the ops Map: Territory editor (`showCompanyLabels`
    prop on PixelMap, default off) — a label over cells you're trying to paint
    is in the way.
- **New: map key** ([MapLegend.jsx](src/components/MapLegend.jsx) +
  `renderHatchSwatch`/`drawLegend` in
  [terrainRender.js](src/lib/terrainRender.js)). Each swatch is drawn with the
  **same cached hatch pattern the territory layer fills cells with**, not a flat
  colour chip, so the key reads as a literal off-cut of the map. **Static** —
  the full roster is always listed (`legendCodes()`), never filtered to whoever
  currently holds ground, so it can't reshuffle or drop rows as the replay
  animates; RHQ is the sole conditional row, since `showRHQ: false` means it
  isn't drawn on the map at all. One renderer serves the page and the exports,
  so they can't drift apart; the export strip auto-shrinks to fit the frame.
- **Weekly Update Image — fixed the "every name and colour at once" bug.** Two
  causes, both in [replayExport.js](src/lib/replayExport.js):
  - The window's "before" state fell back to a **blank map** whenever the
    earliest in-window frame was also frame 0 — the normal case for a campaign
    younger than a week — so every held cell counted as a gain and the whole
    campaign lit up. "Before" is now the last frame recorded before the cutoff,
    or the campaign's own start frame, never a blank grid.
  - Labels were the video's **per-cluster** conquest flashes; a week of frames
    is dozens of small clusters, so the same handful of names stacked all over
    the map. Now `mergedGainLabels()` draws **one name per company**, placed at
    the pole of that company's combined gains.
- **Weekly image headline is editable.** `defaultProgressTitle()` seeds an
  IMAGE HEADLINE field in the Campaign replay panel; blank falls back to the
  generated "PROGRESS UPDATE — <date> TO <date>".
- **Export place names now match the live map's markers.** `drawPlaces()` was a
  plain white dot + name; it now mirrors [Beacon.jsx](src/components/Beacon.jsx)
  — dot in the **current occupier's** colour, glow ring on strongholds, and the
  occupier tag ("A-COY", "1ATF") in its own dark chip beside the name, with the
  recaptured state's bordered white-text variant. Occupancy is derived from the
  frame being rendered, so it tracks the replay.
- **MP4 export hardening** (intermittent 0-byte files). Fixes, all in
  `exportCampaignReplay`: draw the first frame **before** `captureStream()` +
  `recorder.start()` (an unpainted canvas can hand the encoder an empty track);
  **pause the recorder and stop the clock while the tab is hidden** —
  `requestAnimationFrame` halts in a backgrounded tab, so the canvas froze
  while the recorder kept running, which is the most likely cause; a
  `recorder.onerror` handler that surfaces a real message; `requestData()`
  before `stop()`; `stop()` guarded so a throw can't leave the outer promise
  hanging forever; and an **explicit error instead of a silent 0-byte
  download** if the blob comes back empty, naming backgrounding as the cause
  when that's what happened.
- Not changed but worth knowing: the ops editor's **Edit → paints the frame
  being edited** behaviour was already correct in this working tree
  ([MapEditor.jsx](src/pages/ops/MapEditor.jsx) feeds `editing.cells` to
  PixelMap); it is new/uncommitted work, so testing an older build would show
  the live map instead. Not verified by driving the UI.

---

## 2026-08-04 — Weekly progress image, sharper video export, default start frame, history picker
- **Fixed blurry video/exported map art.** Root cause:
  [replayExport.js](src/lib/replayExport.js) applied the map art's CSS-style
  filter (`IMAGE_FILTER`) DURING a scaled-up `drawImage` — in some browsers a
  filtered `drawImage` is routed through a different internal raster path
  that re-enables smoothing regardless of `imageSmoothingEnabled`, silently
  softening the pixel art. Fixed by `renderBaseMap()`: apply the filter at
  the image's native 648×336 resolution first (a 1:1 draw, nothing to
  resample), then upscale that already-filtered result with smoothing
  explicitly off. Also bumped export resolution 1296×672 → 1944×1008 (SCALE
  2 → 3) and video bitrate 8 Mbps → 20 Mbps — the hatch fill's fine repeating
  high-contrast lines are exactly the pattern video codecs compress worst, so
  a typical "screen recording" bitrate wasn't enough to keep them crisp.
- **New: Export Weekly Update Image** (Map: Territory → Campaign replay
  panel). A still PNG: current map state + place names, with whatever
  changed in frames recorded over the last 7 days highlighted (a settled
  wave overlay + the conquest-name flashes held at full opacity instead of
  fading) — a single shareable "what we achieved this week" snapshot, not a
  full campaign recap. Cumulative across the window (diffs from the state
  just before the earliest frame in range straight to current, so several
  moves in one week don't produce overlapping highlights); if the campaign
  itself started within the window, "before" is treated as a blank map.
  Disabled with a tooltip when nothing was recorded in the last 7 days.
  New `exportProgressImage()` in replayExport.js, shares `renderBaseMap`/
  `renderHatch`/`drawPlaces`/`drawFlashes`/`drawBanner` with the video
  exporter (extracted from what used to be closures private to
  `exportCampaignReplay`).
- **New: default start frame.** Each frame row in the editor gets **Set as
  Default Start** — writes the frame's id to a new single-value slice,
  `campaignDefaultStart` (`null` = earliest frame, the original behaviour).
  This is where the PUBLIC replay's auto-play begins; frames recorded before
  it are untouched and still fully reachable, just skipped by the automatic
  playback. Deleting the frame currently marked default (or "Clear replay
  history") resets it back to `null` rather than pointing at nothing.
- **New: manual history picker.** [CampaignReplayMap.jsx](src/components/CampaignReplayMap.jsx)
  gained a "Jump to a frame…" dropdown in the replay transport — any visitor
  can stop and view any recorded frame directly (an instant cut, not an
  animated replay of everything in between), including frames before the
  default start. A "Return to current" button (shown only while viewing a
  historical pick) and the existing "⟲ Replay" both get back to the live
  state. The progress bar and "MOVE k / N" counter were adjusted so the
  auto-play range (default-start..end) reads as its own 0–100%, rather than
  starting partway filled when the default isn't the earliest frame.
- ⚠️ **Be careful to keep data** was an explicit instruction this session
  (unlike the previous "start fresh" campaign-storage rewrite) — everything
  above is additive: no destructive change to existing `campaignFrames` docs,
  no new normalization path that could wipe them. `campaignDefaultStart`
  simply defaults to `null` (existing behaviour) when unset.
- Verified with `npm run build` (clean). Not manually exercised in a live
  browser in this session — no headless-browser tool was available; RHQ
  should sanity-check the new image export, the default-start control, and
  the history picker once deployed. `firestore.rules` needs no changes for
  this session's work (`campaignDefaultStart` is a normal `content/*` slice,
  already covered by that wildcard rule).

## 2026-08-04 — Campaign replay rebuilt as editable per-frame collection
- **Replaced the diff-chain campaign storage with a `campaignFrames`
  collection**, one Firestore document per frame (`{ order, cells, label,
  ts, updatedAt }`, a full grid snapshot each). The old model
  (`content/campaign` = `{ start, timeline: [{ts, diff}] }`, decoded by
  replaying diffs from the start state) made every frame's existence depend
  on replaying everything before it — there was no way to edit, reorder, or
  delete a single historical frame without breaking every diff after it, and
  "re-record start state" was the only undo, at the cost of wiping the whole
  timeline. Requested explicitly: "I want a way to edit every frame."
  ⚠️ **No migration** — any previously recorded campaign history is gone;
  this was confirmed acceptable (no real recorded history existed yet).
- [src/lib/campaign.js](src/lib/campaign.js) dropped the diff codec
  (`diffCells`/`applyDiff`/`appendSave`/`buildFrames`/`frameLabels`/
  `campaignValid`/`EMPTY_CAMPAIGN`) for plain array helpers over frame
  objects: `sortFrames`, `framesValid`, `frameCells`, `frameCaptions`,
  `renumberFrames`. `transitionPlan`/`transitionDuration` (the conquest-wave
  animation math) are untouched — they only ever needed two cell-strings.
- **Map: Territory → Campaign replay panel rebuilt**
  ([MapEditor.jsx](src/pages/ops/MapEditor.jsx)): **+ Add Frame from Live
  Map** replaces the old Select-Start-State/Record-Progress-Frame split (the
  first frame added just becomes the start — no separate step). Each frame
  row: an inline **label** (commits on blur/Enter, not per keystroke),
  **↑/↓** reorder, **Duplicate** (inserts a copy right after — how you add a
  step mid-sequence now), **Delete** (confirm-guarded), and **Edit** — loads
  that frame's cells into the *same* paint canvas used for the live map, with
  an accent-coloured banner making clear you're editing a historical frame,
  plus its own **Update Frame** save. "Save map" still only ever publishes
  the live territory, unaffected by whatever frame is loaded for editing;
  switching frames (or cancelling) while there are unsaved paint strokes on
  the currently-loaded frame prompts a confirm before discarding them.
- `store.js`: `campaignFrames` moved from `SINGLE_SLICES` (`campaign`, one
  doc) to `COLLECTION_SLICES` — reuses the existing generic
  `updateSlice`/`persistCollection` batch-write machinery (same pattern as
  `territory`/`places`), no new Firestore-call plumbing needed.
  `normalizeCampaignFrames` replaces `normalizeCampaign`: a frame whose cell
  string doesn't fit the current grid resolution invalidates the *whole* set
  (same "can't replay a wrong-resolution grid" reasoning as before), not just
  that one frame.
- `CampaignReplayMap.jsx`, `replayExport.js`, `Home.jsx`, `StaffCentre.jsx`
  updated to read `state.campaignFrames` instead of `state.campaign` — the
  animation/export internals didn't need to change, they already worked off
  a generic `frames: string[]` + `captions: string[]` shape.
- **`firestore.rules`**: new `campaignFrames` block (public read, RHQ write —
  same shape as `content/*`), added *before* the default-deny catch-all.
  ⚠️ Needs a **rules republish** in the Firebase Console like the other
  pending rule changes (see "Firebase setup checklist" in CLAUDE.md) — until
  then RHQ can't write campaign frames against the live project at all. This
  new block hasn't been run through the `firebase-tools` emulator the way
  the rest of the ruleset was in an earlier session.
- Verified with `npm run build` (clean). Not manually exercised in a live
  browser in this session — no headless-browser tool was available; RHQ
  should sanity-check Add/Edit/Duplicate/Reorder/Delete and the Home page
  replay once deployed.

## 2026-08-04 — Onboarding simplified; Home layout reshuffled; map polish
- **Help & Support removed as a user-facing feature**: the button + modal
  ([SupportModal.jsx](src/components/SupportModal.jsx), deleted) is gone from
  the sidebar, the login modal, and `/Classified`. The `support` Firestore
  collection and auto error-filing (`reportError` → `notifyAdmin`, Ops Centre
  → Help) are untouched — only the manual "send a message to RHQ" form went
  away.
- **`/Classified` simplified**: no longer connects to login/registration at
  all. Removed the "HOW TO LOG IN" box, the "Already registered? Sign in"
  button, and the Help & Support button; `LoginModal` is no longer imported.
  "Continue" now navigates straight to `/`.
- **CompanyGate copy trimmed**: the boot screen's skip button now just reads
  "Skip" (was "Skip — show unit-wide content only"), and the explanatory
  "Your company decides which intelligence you receive…" paragraph is gone.
- **Home page reshuffled**: SMEAC brief now sits alone on the left; company
  roles, the Meridian objective box, and the Meridian motive/why-we-stop-them
  box are stacked on the right (`MeridianBrief` split into `MeridianBox` +
  `MeridianInfoBox` in [Home.jsx](src/pages/Home.jsx)). Removed the blinking
  "THREAT: SEVERE" tag. SMEAC's `C` section renamed "COMMAND AND SIGNALS"
  (was "COMMAND / CONTROL / COMMS").
- **Map: recaptured-stronghold tag is now "1ATF"** (was "SCU") —
  `SCU_LABEL` in [territory.js](src/lib/territory.js).
- **Fixed a place-label positioning bug**: [Beacon.jsx](src/components/Beacon.jsx)
  used to be rendered inside a flex row that PixelMap centred as one block
  (dot + name + tag), so the dot's apparent position on the map silently
  drifted depending on how long the name/tag text next to it was — two places
  at the same grid coordinate could show their dot in visibly different
  spots. Beacon now owns its own positioning: the dot is pinned to `(x, y)`
  via its own transform, and the name/tag flow right from a separately
  positioned span that never moves the dot.
- **Pinch/wheel zoom replaced with +/- buttons**: `PixelMap.jsx` no longer
  attaches a wheel listener or tracks touch pinches — zoom is now two on-theme
  buttons (turquoise on translucent grey, bottom-right of the map),
  click-to-step via `zoomAt`. Drag-to-pan once zoomed is unchanged. Updated
  the stale "pinch/scroll to zoom" copy in StaffCentre and the Map: Territory
  editor's helper text to match.
- ⚠️ Not yet updated: this file's own [Working constraints] /
  [Territory / map system] prose in CLAUDE.md still says "No scrollbar/zoom
  buttons — panning and zooming are gesture-driven," which the zoom-button
  change above reverses. Update that bullet next time you're in there.
- Verified with `npm run build` (clean) — no browser-driving tool was
  available in this environment to visually confirm in a live page; the user
  should sanity-check the map zoom buttons and beacon alignment on their
  build.

## 2026-08-03 — Territory ownership labels + modal layering fix
### Every held region names its holder
- `regionLabels()` in [territory.js](src/lib/territory.js) flood-fills the grid
  into contiguous same-owner regions and returns a label anchor for each, so
  the map reads "A-COY" / "MERIDIAN" directly on the ground instead of making
  viewers match colours to the key.
- Anchor is the region's most **interior** cell (multi-source BFS inward from
  its edge), not the centroid — a centroid frequently lands outside a concave
  or crescent holding, which is exactly what contested ground looks like.
- Text size scales with the room available (`radius` × cell size, clamped
  7–15px) and, because the labels live inside the zoom/pan stage, they scale
  with the map when zoomed. Regions under 40 cells get no label — a label
  wider than the ground it names is worse than none.
- Labels avoid named places: those beacons already print the same owner tag,
  so `avoid`/`avoidRadius` moves the region label to the best interior spot
  clear of them, and skips it entirely if the whole region sits under one.
- On by default for read-only maps, off in the editor (`regionLabels` prop) —
  they'd sit under the brush and recomputing regions per paint event is work
  the editor doesn't need.

### Fixed: Help / Access modals appeared *behind* the map
- Reported by the user and reproduced: the Help & Support and Access modals
  rendered under the map and other content.
- Cause: they mount from inside the nav (`.app-rail`, `position: sticky`, and
  the mobile drawer, `position: fixed`). **Both create a stacking context**, so
  a `position: fixed` child is confined to that layer no matter how high its
  z-index — the rail has no z-index and comes before `.app-main` in DOM order,
  so page content painted over the modal.
- Fix: `SupportModal`, `LoginModal` and the confirm dialog now render through
  `createPortal(..., document.body)`, escaping any ancestor stacking context.
  z-index values unchanged (900 / 950 / 1500) and now actually meaningful.
- Verified by hit-testing `document.elementFromPoint` at each modal's centre —
  the modal is the topmost element, and is confirmed to be mounted outside the
  rail/drawer.
- Verified overall: 11 checks for these two changes (labels present, correct
  size, sitting on their own side's ground, zooming with the map, sliver
  skipped, both modals topmost + portalled), and all nine other suites re-run
  green (167 checks total).

---

## 2026-08-02 — Briefings narrative updated to the supplied text
- `DEFAULT_BRIEFINGS` in [seed.js](src/firebase/seed.js) replaced with the
  unit's supplied narrative, verbatim: 01 Situation (3 paras), 02 The Unit,
  03 The Mission (mission statement as the `highlight` callout, with the
  Mondays/BIVOUAC/AFX paragraphs as the body), 04 The Progress Map, 05 Your
  Directive. Existing closing quote kept (the supplied text didn't include
  one).
- **New "Load default text" button** in Ops Centre → Briefings. A stored
  Firestore doc always overrides the seed, so updating the narrative in the
  repo would otherwise never reach the live site. The button loads the
  shipped text into the editor (keeping the video link) for review; nothing
  publishes until Save. Confirm-guarded.
- Verified (24 checks): every supplied paragraph/heading renders on a fresh
  install, no old wording remains, a stored doc does override the seed, the
  loader pulls the new text in and preserves the video link, and saving
  publishes it to the Briefings tab.
- ⚠️ Two things left for RHQ, both deliberate:
  1. **The live site still shows the old briefing** until someone opens Ops
     Centre → Briefings, presses *Load default text*, and Saves.
  2. The supplied text says **"1st Allied Task Force"** whereas the rest of
     the site says "1st Australian Task Force" (header, narrative slice,
     seed). Used verbatim as supplied; flagged rather than silently
     reconciled — a global rename is a one-line change if wanted.
- The supplied document also lists a **"00. YOUR COMPANY"** section but gave
  no body text for it, so no such section was created.

---

## 2026-08-01 — Staff Centre: full drill-down detail
Rebuilt [StaffCentre.jsx](src/pages/StaffCentre.jsx) from a flat summary into
an overview of **clickable section cards**, each opening a detail view with the
actual content. Cards needing attention (pending approvals, a scheduled
distribution) outline in red. Eight sections:
- **Approvals** — each pending request in full: company, upsert vs removal,
  the fragment's title/coded message/solution/reveal text, who submitted it.
- **Intercepted Intelligence** — every fragment grouped UNIT-WIDE then per
  company (A-COY…S-COY), showing the coded message, the **solution**, the
  reveal text, attachments, and any embedded doc. This is what cadets see,
  with the answers.
- **Video & Distribution** — the video actually **plays** (reuses
  `VideoEmbed`), plus title/caption/schedule, any unpublished RHQ draft, and
  the Briefings-tab video.
- **Briefings** — full section text, highlights and closing quote.
- **Operational Map** — the live `PixelMap` rendered inline (zoomable), named
  places with stronghold status, and the campaign timeline with each frame's
  label.
- **Activity Feed** — entries newest-first.
- **Operation Brief** — the full SMEAC text, the Meridian threat block, the
  company roles, and the Welcome/Classified copy.
- **Content Status** — last-updated for all ten editable slices.
- Still strictly read-only, still no PII. The two restricted feeds
  (`intelSubmissions`, `activity`) remain RHQ-gated by the security rules, so
  each shows an explicit notice explaining why it's empty for a password-only
  visitor rather than pretending there's nothing there.
- Verified: 27 new headless checks on the drill-downs (real intel text,
  embedded player, activity entries, map render, SMEAC, back-navigation) plus
  the original 22 gate/label checks.

---

## 2026-07-31 — "A-COY" map labels + Staff Centre
### Map labels are unit-style and persist
- `coyLabelOf()` in [territory.js](src/lib/territory.js): companies now read as
  **"A-COY"** (was "ALPHA") on the persistent occupier beacons AND in the
  conquest flashes during replay, so the name that flashes when ground is
  taken is the one that stays on the zone afterwards. RHQ stays "RHQ",
  Meridian stays "MERIDIAN". Recaptured strongholds keep the assure-blue
  "SCU" state.
- (The labels already persisted after a replay — they are derived from the
  cells on every render. What changed is the format.)

### New `/staff-centre` ([StaffCentre.jsx](src/pages/StaffCentre.jsx))
URL-only, not linked from anywhere. Single shared password `SCUNARRATIVE`
(case-insensitive); unlock is remembered per device with a Lock button to
clear it. Read-only overview in one page: pending COY→RHQ approval requests,
scheduled/published video distribution, intel counts per company, territory +
campaign replay timeline (with each frame's label), and content freshness for
every editable slice.
- ⚠️ **Security model, stated plainly:** the password ships in the client
  bundle, so it is a latch against casual visitors, NOT a secret. That is
  acceptable *only because this page shows nothing that isn't already
  public* — every `content/*` slice is world-readable by design so the
  signed-out site works. It grants no writes and touches no personal data
  (roster, help inbox and audit log are deliberately not shown).
- ⚠️ **Approvals queue caveat:** `intelSubmissions` is restricted by the
  Firestore rules to RHQ and the submitting commander. A password-only staff
  visitor isn't signed in to Firebase at all, so against LIVE Firebase that
  read is denied by design. The page tries anyway and shows an honest notice
  when it can't read them; it works in LOCAL MODE, and live if an RHQ or
  commander session already exists in that browser. Making it work for
  password-only staff would require relaxing the rules to expose unapproved
  drafts publicly — NOT done, flagged for the user to decide.
- Verified: 18 headless checks (A-COY in flash + after replay + on the static
  map, gate rejects/accepts, no content before unlock, persistence, Lock
  re-gates, all five sections, pending requests listed).

---

## 2026-07-30 (5) — Brush performance (3x faster), per-frame replay labels
### Brush lag — profiled and fixed
Painting was still heavy. A CPU profile of a 60-move stroke put **434 ms in
`drawImage`**, and the whole stroke cost **894 ms of main-thread time
(~15 ms per pointer move)** — enough to feel laggy on anything slower than a
desktop. Two causes, both fixed in [terrainRender.js](src/lib/terrainRender.js)
+ [PixelMap.jsx](src/components/PixelMap.jsx):
1. **Every paint event redrew the entire map.** PixelMap now diffs the new
   grid against the last-rasterised one and passes the dirty CELL bounds
   (padded 2 cells so neighbouring borders rebuild correctly) to
   `renderTerritoryLayer`, which clears+clips to that region. Full redraws
   still happen on resize, first paint, and large changes (>25% area), e.g.
   replay commits and clear-all.
2. **The real hotspot: `source-in` is a GLOBAL composite.** The hatch mask
   used a full-map scratch canvas, so the browser reprocessed the whole
   canvas per owner colour even when only a few cells were drawn — the
   region optimisation alone barely helped (894→737 ms). Sizing the scratch
   to the region (rounded to a 128px grid, grow/shrink hysteresis) is what
   actually paid off.
- **Result: 894 ms → 304 ms per stroke, script time 673 → 148 ms,
  `drawImage` 434 → 8 ms, ~15 ms → 5.1 ms per pointer move** (comfortably
  inside a 16 ms frame). Output verified **pixel-identical** to a full
  redraw after three overlapping multi-colour strokes.
- Remaining minor cost is MapEditor's per-event `split('')/join('')` of the
  24k-cell string (~0.6 ms/move) — left alone as it is no longer material.

### Per-frame replay labels
- **Record Progress Frame** now takes an optional label (input above the
  button, Enter submits, cleared after recording), stored as `label` on the
  timeline entry (`appendSave(..., label)`, capped 80 chars).
- The campaign panel lists the **recorded timeline** — start date plus each
  frame's date and label (or "(unlabelled)") — so RHQ can see what the
  replay will play back.
- During playback the label shows as a caption along the bottom of the map
  (`.replay-caption`, fades in per move, clears at the end) and is drawn
  into the **exported video** in the same position. Unlabelled frames simply
  show no caption; the synthetic "live drift" final frame never has one.
- Verified (10 checks): field hidden until a start state exists, label
  stored/cleared, timeline listing, unlabelled frames allowed, caption
  appears during the right move and disappears at rest.

### Test-suite note
Two older scratch tests painted at a spot that is **ocean** (deliberately
unpaintable) and had been passing only because the ocean mask hadn't
finished loading yet; the faster paint path made the mask win the race, so
the app now correctly refuses the no-op. Tests repointed at land — this was
a test bug, not a regression.

---

## 2026-07-30 (4) — First-visit company gate, company-scoped intel alerts, site audit
### Boot-screen company gate
- New [CompanyGate.jsx](src/components/CompanyGate.jsx): the boot screen now
  reads "SECURE LINK ESTABLISHED" and asks the visitor to pick their company
  before the public shell renders — **once per device**, then it sticks from
  localStorage. Includes a "Skip — show unit-wide content only" path for
  staff/parents/visitors.
- `CompanyContext` gained `chosen` (the localStorage key EXISTS) separate
  from `company` (may be `''` when skipped), so skippers aren't re-prompted
  on every visit. Gating happens in a `PublicShell` wrapper in App.jsx, so
  the Classified landing page and the RHQ/COY consoles bypass it.

### Company-scoped intel alerts
- The home-page new-intel banner previously used the intel slice's
  `updatedAt`, so ANY company's intel edit alerted EVERY cadet. It now
  fingerprints only the fragments that visitor can see — unit-wide (`ALL`)
  plus their own company — via `intelSignature()` in
  [useUnseen.js](src/hooks/useUnseen.js), tracked per company key.
- First visit, and any later company switch, silently records a baseline
  (`hasIntelBaseline`), so the alert only ever fires on a genuine change
  rather than greeting new arrivals with "NEW".
- Banner now names the scope, e.g. "NEW INTERCEPTED INTELLIGENCE — BRAVO /
  UNIT". Briefings/taskings keep the simpler whole-slice stamp.
- Verified (9 checks): first visit silent; Charlie's edits don't alert Bravo;
  own-company and unit-wide edits do; opening Intel clears it; switching
  company doesn't false-alert.

### Site audit (back to front)
Swept all 8 routes at 1280/820/390px for blank pages, horizontal overflow,
broken images, console/page errors and off-viewport controls.
- **Fixed — closed off-canvas menus stayed in the tab order.** Both the
  public mobile drawer and the Ops Centre mobile rail were only translated
  off-screen, so keyboard users could tab into an invisible menu. Both now
  also toggle `visibility`, which removes them from the tab order; confirmed
  by tabbing 25 times on each and asserting focus never lands on a hidden
  element.
- No blank pages, no horizontal overflow, no broken images, no page errors
  on any route/viewport. The one `scu-logo.png` request failure seen was a
  dev-server flake (serves 200; Logo also falls back to the SVG).
- Firestore rules reviewed: every collection the code touches is covered,
  header comment updated to say so; re-verified on the emulator (19 checks
  across both rule suites) including `content/campaign` and COY submission
  scoping. **Rules still need re-publishing in the Firebase Console** — repo
  is current, live is not.

---

## 2026-07-30 (3) — Explicit start/progress recording + persistent occupier beacons
### 1. Two-action replay recording ([MapEditor.jsx](src/pages/ops/MapEditor.jsx))
- **Behaviour change**: "Save map" no longer auto-appends a replay frame.
  Previously every save that changed cells silently became a replay step, so
  routine touch-ups polluted the timeline; recording is now deliberate.
- Before a start state exists: one **Select Start State** button (as before).
  Once it exists, two clearly-separated actions appear (both gated on the
  start state, each with an explanatory tooltip + an inline legend):
  - **+ Record Progress Frame** (primary) — appends the current map to
    `campaign.timeline` via the existing `appendSave()`; start state
    untouched. Refuses a no-op with a toast rather than silently doing
    nothing.
  - **⟲ Re-record Start State** (danger) — overwrites `campaign.start` and
    **clears all progress frames**; confirm dialog states the frame count.
- Both actions publish the current painting (`updateSlice('territory')`)
  before recording, so the live map can never drift from the frame just
  recorded — verified by reconstructing the timeline and comparing.
- Frames stay ordered and flow into the existing replay/export unchanged
  (same `appendSave`/`buildFrames` path). Panel now counts "PROGRESS FRAMES".

### 2. Persistent occupier beacons ([Beacon.jsx](src/components/Beacon.jsx))
- The Marrangaroo/Singleton marker was **inline JSX inside PixelMap**, not a
  component — extracted verbatim into `<Beacon>` and reused (no rebuild).
  New props: `color`, `pulse`, `label`, `tag`, `tagColor`, `variant`
  ('plain' | 'boxed').
- There are no zone/region entities — territory is a flat cell grid — so a
  "zone" is a `territory.places` entry, and its occupier is the **majority
  owner of the cells around it** (`occupierAt()` in territory.js, radius 3;
  sampled rather than read from the single cell under the label, which is
  often on a boundary/unpainted). Occupier is now shown statically at all
  times, not just mid-animation, in that faction's existing colour.
- **Recaptured strongholds**: `beaconStateFor()` returns the assure-blue
  `SCU` state when a place flagged as a Meridian stronghold (`place.hostile`,
  the editor's existing "Meridian stronghold" tick) sits on ground held by
  any 1ATF company. Blue = `ASSURE_BLUE` in territory.js (**one constant to
  restyle every recaptured stronghold** — value chosen to be distinct from
  Alpha's blue; change it if the unit has an exact brand blue). The SCU tag
  uses the boxed variant (glowing border, white text) so it reads
  differently from an ordinary occupier tag.
- Reactive by derivation: occupancy is computed from the cells on every
  render, so it updates with no reload — verified flipping MERIDIAN → SCU
  mid-replay (the replay feeds PixelMap each committed frame).
- Both tag variants sit on a dark chip; without it, tags were unreadable
  over the hatch fill.
- **Verified**: 24 headless checks (gating, save-doesn't-record, frame
  append/order, start-state untouched, no-op refusal, live-map==latest-frame,
  re-record clears, static occupier tags, company colour, SCU blue + boxed
  tag, mid-replay flip). Brush/zoom/nav/replay suites re-run green.
- ⚠️ Note for RHQ: in the current data **none** of the three places are
  flagged as strongholds, so none show the pulsing/recapture treatment until
  the "Meridian stronghold" box is ticked for Marrangaroo/Singleton in
  Map: Territory → Place names.

## 2026-07-30 (2) — Live copy auto-reworded: "hostile" → "threat"
The seed defaults were reworded on 2026-07-29, but narrative text already
saved to Firestore still carried the old word (e.g. `MERIDIAN // HOSTILE`),
which needed a manual RHQ edit of every field. `store.js` now rewrites it at
READ time (`normalizeNarrative`/`dehostile`): whole-word, case-preserving,
applied recursively across the whole `narrative` slice. Nothing is written
back to Firestore and RHQ edits still win for all other text — the swap just
re-applies on each load, so live copy complies with no manual pass. Verified
with a simulated pre-reword doc: home page renders `MERIDIAN // THREAT` and
no visible "hostile" anywhere.

---

## 2026-07-30 — Unread alerts, responsive nav, SMEAC brief
Four changes, all e2e-tested headless at 1200/800/390px widths (25 checks).
- **Unread-content banners** ([src/hooks/useUnseen.js](src/hooks/useUnseen.js)):
  red pulsing banners on Home, just above the map — "NEW INTERCEPTED
  INTELLIGENCE" / "NEW BRIEFING / TASKING" — shown when the `intel` /
  `briefings` slice's `updatedAt` is newer than the device-local seen stamp
  in localStorage. Opening the page (banner links there) marks it read on
  that device; the stored stamp is the content's own `updatedAt`, so RHQ/
  member clock skew can't break the comparison. Intel approvals write
  `content/intel` via `updateSlice`, so approved COY intel triggers the
  banner too. No auth/server state — "read" is per-device. (`tasks` has no
  public page/readable collection, so "new task" = the briefings feed.)
- **Public nav is responsive**: ≥768px the menu is a permanently pinned left
  rail (`.app-shell`/`.app-rail`, active-page highlight); phones keep the
  hamburger + slide-in drawer. Both render the same `NavContent`
  (extracted from Sidebar.jsx); the hamburger button hides on desktop.
- **Ops Centre inverted for mobile**: ≤820px the side rail is no longer
  pinned (it previously stacked full-width on top) — it's now an off-canvas
  drawer opened from a ☰ MENU bar above the work area, closing on backdrop
  tap or section pick. Desktop unchanged (pinned). CommanderPanel doesn't
  use ops-shell, unaffected.
- **Home brief is now SMEAC**: new `narrative.smeac` {situation, mission,
  execution, admin, command} rendered as an "OPERATION BRIEF // SMEAC"
  panel with lettered sections (empty sections skipped); company-roles
  badges + Meridian panel unchanged below it. `smeacOf()` merges older
  stored narratives — their edited `oneatf.mission` becomes the Mission
  paragraph and other sections fall back to seed text, so the live doc
  shows sensible copy before RHQ ever edits it. Narrative editor's Mission
  field replaced by the five SMEAC fields (old `oneatf.mission` data left
  intact as the fallback source).

---

## 2026-07-29 (5) — Gesture zoom, crest favicon
- **Map zoom is now gesture-driven** — the "+" button is gone. `PixelMap`
  holds a continuous `view {scale, x, y}` (1x–4x): mouse-wheel / trackpad
  scroll zooms anchored at the cursor (trackpad pinches arrive as ctrlKey
  wheel events and get a stronger response); two-finger touch pinch zooms
  anchored at the pinch centre (which gives two-finger panning for free).
  Read-only: one-finger/mouse drag pans once zoomed; at 1x touch swipes and
  wheel-downs pass through to normal page scroll (`touch-action: pan-x
  pan-y` + a wheel listener that only preventDefaults when it actually
  zooms), so the map never traps page scrolling. Edit mode: one finger/click
  still always paints; a second finger cancels any live stroke and pinches;
  middle/right-mouse drag pans (context menu suppressed in edit). Wheel
  listener is attached manually (non-passive) since React's onWheel can't
  reliably preventDefault. Verified headless: wheel in/out, cursor-anchored,
  drag-pan, CDP-synthesized pinch, 1x scroll pass-through, painting + brush
  suite + replay suite still green.
- **Tab icon is now the real crest**: generated square-padded
  `public/favicon.png` (512², transparent) and `public/apple-touch-icon.png`
  (180², dark-navy background) from `public/scu-logo.png`; `index.html` now
  links those instead of the placeholder SVG. Regenerate both if the crest
  changes.
- "hostile" audit: repo copy was already clean (2026-07-29 (3)); remaining
  matches are code identifiers/comments and the language-checker rule
  itself. The live Firestore `content/narrative` doc still carries the old
  seeded `MERIDIAN // HOSTILE` title — RHQ must edit it in Ops Centre →
  Map: Narrative (Meridian "Section title" field).

---

## 2026-07-29 (4) — Custom domain: build for root path
The user attached a custom domain to GitHub Pages (Settings → Pages), which
serves the site from the domain ROOT — but the build still targeted the
`/<repo>/` project-pages subpath, so every asset 404'd (blank page).
- `deploy.yml`: `VITE_BASE` → `/`. `public/404.html`:
  `pathSegmentsToKeep` → `0`. Both carry comments on how to revert if the
  custom domain is ever removed (the github.io/<repo>/ URL now just
  redirects to the domain, as GitHub does automatically).
- No CNAME file needed: with Actions-based Pages deploys the custom domain
  lives in the repo's Pages settings, not in the artifact.
- ⚠️ Firebase Console → Authentication → Settings → **Authorized domains**
  must include the custom domain or all sign-ins fail there.

---

## 2026-07-29 (3) — Privacy notice page + "hostile" → "threat" wording
- **New `/privacy` page** ([src/pages/Privacy.jsx](src/pages/Privacy.jsx)):
  small, plain-language member-facing privacy notice (what's collected, why,
  Firebase storage + own-record-only access, local-storage use, how to get
  data corrected/removed via Help, parent/guardian line for minors, fiction
  disclaimer). Static/repo-versioned by design — not an RHQ-editable slice.
  Linked from a new minimal footer in `Layout.jsx` (shows on all three
  public tabs). Closes the "no member-facing privacy notice" TODO in
  CLAUDE.md.
- **Wording: "hostile" → "threat"** in user-visible copy. Seed defaults:
  Meridian brief title `MERIDIAN // HOSTILE` → `MERIDIAN // THREAT`, mission
  line "…until the line holds no threat.", classified body "an expansionist
  threat known as THE MERIDIAN", demo activity line. `language.js`
  `BANNED_TERMS` now suggests **threat** for "hostile" (still `review`
  level), so editors get steered to the approved word. Code identifiers
  (`--hostile` CSS var, `.hostile` class, `p.hostile` flag) deliberately
  unchanged — they're invisible to users and renaming them is pure churn.
  ⚠️ Seed changes only affect fresh installs: the LIVE site's narrative /
  classified copy lives in Firestore `content/*` docs, so RHQ must edit
  those in the Ops Centre (the LanguageWarning now flags "hostile" with the
  "threat" suggestion, which makes the spots easy to find).

---

## 2026-07-29 (2) — Map editor: smooth, gapless brush strokes
Fixes the "glitchy" brush in Ops Centre → Map: Territory. Two root causes,
both in the paint path; rendering output is unchanged (screenshot-compared).
- **Gapless strokes**: pointer events are sampled, so a fast drag only fired
  a handful of moves and painted a dotted line. `PixelMap` now remembers the
  last painted cell and walks a Bresenham line to each new sample — including
  the browser's coalesced pointer events (`getCoalescedEvents`) for the
  pointer's true path between frames. The whole segment is batched into ONE
  `onPaint(points[], brush, size)` call (signature changed from per-cell
  `(x, y, ...)`; `MapEditor.paint` stamps the batch in a single state
  update). Ocean-mask blocking still applies per cell.
- **Cheaper redraws**: every painted cell triggers a full territory-layer
  redraw, which previously re-stroked hundreds of diagonal hatch lines AND
  allocated two full-size canvases per owner code, per redraw.
  `terrainRender.js` now caches the hatch pattern per code+size (it doesn't
  depend on cells) and masks it through one reused scratch canvas via
  `source-in` — no per-draw allocations. `PixelMap` also coalesces redraws
  to one per animation frame instead of one per pointer event. Benefits the
  campaign replay and video export too (same shared renderer).
- **Verified** (LOCAL MODE + headless Chromium): a 4-event fast drag across
  ~40% of the map paints the exact same continuous stroke as a 200-event
  slow drag (holes identical — only ocean-masked water cells); ocean stays
  unpaintable; full replay e2e suite still passes; hatch render screenshot
  matches pre-change.

---

## 2026-07-29 — Campaign Territory Replay: animated conquest history + video export
The public map can now REPLAY the whole campaign: RHQ picks a start state,
every later "Save map" records a move, and visitors watch ownership sweep
across the pixels move-by-move (with the conquering company's name flashing
over each captured area) before the map settles on the current state.
`npm run build` passes; logic + UI + export all emulator/browser-verified
(see below).
- **Data model** — new `content/campaign` single slice (added to
  `SINGLE_SLICES` in `store.js`): `{ start: { cells, ts }, timeline: [{ ts,
  diff }] }`. Timeline entries are **run-length diffs** against the previous
  frame (`src/lib/campaign.js` `diffCells`/`applyDiff`, `<index36>:<run>`
  segments), not 24 KB full snapshots — hundreds of saves fit inside
  Firestore's 1 MiB doc cap. If the doc would still outgrow a 700 KB budget,
  `appendSave` folds the OLDEST moves into the start state (replay just
  starts one move later). `normalizeCampaign` in `store.js` discards a
  campaign recorded against a different grid resolution (same rationale as
  `normalizeTerritory`).
- **No firestore.rules change needed** — `campaign` lives under `content/*`,
  which is already public-read / RHQ-write. Nothing to re-publish for this
  feature.
- **Replay renderer** (`src/components/CampaignReplayMap.jsx`, used by
  `Home.jsx`; falls back to the plain `PixelMap` when no campaign exists —
  full backward compatibility): auto-plays once on load, then rests on the
  live state (no loop). Per-move "conquest wave": changed cells are
  clustered per owner and ripple outward (BFS rank, seeded from the owner's
  existing front line — `transitionPlan` in `campaign.js`) on a cheap
  flat-tint overlay canvas; the expensive hatch layer (PixelMap) redraws
  only ONCE per move when the frame commits, so the animation stays smooth
  regardless of map/timeline size. Controls: play/pause, replay, skip-to-
  current, progress bar + move counter. `prefers-reduced-motion` skips
  straight to the final state. If the live territory has drifted from the
  last recorded frame, a synthetic final move is appended so the replay
  always ends on what's actually live.
- **Conquest name flash**: each conquering cluster (≥6 cells, so tiny
  touch-ups don't spam) flashes its company name (ALPHA/…/MERIDIAN, owner
  colour) at the cluster centroid — `.conquest-label` + `conquest-flash`
  keyframes in `index.css`. Ground lost to nobody sweeps dark, no label.
- **PixelMap refactor**: the hatch+border drawing moved verbatim into
  `src/lib/terrainRender.js` (`renderTerritoryLayer`, plus the new
  `renderWaveLayer`), shared by the on-screen map AND the video exporter so
  the two can't drift apart. PixelMap also gained an `overlay` prop (node
  rendered inside the zoom/pan stage) so replay layers track zooming.
- **Ops Centre → Map: Territory** now has a **Campaign replay** panel
  (`CampaignPanel` in `MapEditor.jsx`): **Select Start State** (uses the map
  as currently painted in the editor; re-selecting erases history —
  confirm-guarded), Clear replay history, move counter, and **Export
  Campaign Replay**. Saving the map appends a move only when cells actually
  changed (no-op saves add nothing). All actions audit-logged.
- **Video export** (`src/lib/replayExport.js`): re-renders the replay
  offscreen at 1296×672 (2× map art; same shared renderers + ctx.filter for
  the agency look, incl. place labels and name flashes) and records it in
  real time via `canvas.captureStream()` + `MediaRecorder` — **MP4 where
  the browser can mux it (Chrome/Edge/Safari), WebM fallback (Firefox)**,
  ~8 Mbps. Memory stays flat for any campaign length (only the current
  hatch layer is cached; chunks stream to the recorder). Cancellable; the
  tab must stay visible while it renders (rAF-driven real-time capture).
- **Verified** (Firestore-free, LOCAL MODE + headless Chromium — scratch
  scripts, not committed): 19 unit checks on the diff codec (random-grid
  round-trips), timeline append/no-op/folding and wave planning (seed ranks,
  cluster labels, loss clusters); 11 e2e checks on the Home replay
  (auto-play, name flash, pause freezes progress, completion → CURRENT
  STATE, replay/skip); 11 e2e checks on the editor flow (bootstrap-admin
  login → select start → paint → save records move 1 → no-op save adds
  nothing → persisted diff); 5 e2e checks on export (real 909 KB MP4
  downloaded, decodes at 1296×672, frames show wave + MERIDIAN flash +
  settled hatch).
- **Assumptions/notes**: replay history tracks CELLS only (place labels
  always render at their current position, incl. in the export); the
  Firestore campaign doc is written whole on each save (same pattern as
  every other content slice); browsers without `MediaRecorder` see a
  disabled export button with an explanatory tooltip; the on-screen replay
  compresses long campaigns (~0.75–1.8 s per move, ≤ ~20 s total animation).

---

## 2026-07-23 — Roster privacy hardening: RHQ + own-record only reads
Closes the privacy gap flagged in CLAUDE.md: `roster`/`tasks`/`activity` were
readable by *any* signed-in member, leaking every member's name/ID/email and
plain-text temp passwords. `firestore.rules` only — no app code changes.
- **`roster`**: read now requires RHQ **or** the caller's own record. Added an
  `isOwnId(idNumber)` helper that matches the caller's Firebase Auth email
  (`id-<idNumber>[.v<epoch>]@1atf.unit`, see `idToEmail()` in
  `AuthContext.jsx`) against `resource.data.idNumber`. This exactly matches
  what temp-password registration already does client-side —
  `where('idNumber','==', id)` — so the query still returns the caller's own
  doc and nothing else; everyone else's roster records are now unreadable to
  non-RHQ members. Writes unchanged (RHQ-only).
- **`tasks`/`activity`**: reads tightened to RHQ-only (writes were already
  RHQ-only). Their only current readers are `src/pages/Tasks.jsx` and
  `Activity.jsx`, which are legacy and **not linked from any route** — see
  CLAUDE.md "App shape" — so this is safe today. Re-linking those pages later
  would need a rethink (they'd need to read only the signed-in member's own
  items, similar to the roster fix).
- **Verified against the real rules engine**, not just by inspection: ran the
  `firebase-tools` Firestore emulator + `@firebase/rules-unit-testing`
  locally (scratch scripts, not committed) covering: owner reads own roster
  record (incl. after a `.v<n>` password-reset email bump) → allowed; owner
  reads another member's record → denied; a signed-in stranger → denied on
  both; RHQ → allowed on everything; `tasks`/`activity` → RHQ-only; the exact
  `where('idNumber','==', id)` query pattern registration uses → returns only
  the caller's own doc; the same query filtered to a *different* idNumber →
  denied (so a member can't just edit the query to fish for someone else's
  temp password). All 11 checks passed. `npm run build` also passes.
- Assumption carried over from the original writeup: IDs are digits-only
  (`LoginModal` strips non-digits before anything touches auth/roster), so
  `cleanId(id) === idNumber` and the email-pattern match in `isOwnId` is
  exact — no need to run the value through `cleanId`'s lowercase/strip step
  in the rule itself.
- **Known residual gap, intentionally out of scope**: an *unregistered* member
  who knows their own ID can still sign themselves up and, via this same
  own-record path, read their own record's plain-text `tempPassword` — that's
  inherent to storing temp passwords in plain text and is closed by the
  separate deferred "hash temp passwords" task, not this one.
- ⚠️ **`firestore.rules` must be re-published** in the Firebase Console for
  this to take effect on the live site (stacks with the still-pending
  `intelSubmissions` republish from 2026-07-22 — one republish covers both).
  LOCAL MODE (localStorage) is unaffected either way, since it never goes
  through Firestore rules.

---

## 2026-07-22 — Company Commander role + intel approval workflow + language filter (`d449092`)
Adds a full draft→approve pipeline so a company's own commander can maintain
their intel without touching the live site directly, plus a config-driven
language check for public copy. Built in phases; `npm run build` passes.
- **New "Company Commander" role** (`seed.js` `ROLES`, new `COMMANDER_ROLE`),
  now the **default** when RHQ creates a user (both `newUser` and spreadsheet
  `mapRow` in `UsersAdmin.jsx` — was `'General'`, which stays valid for legacy
  rows). Bound to one company; may only ever see/act on their own company's
  data. `AuthContext` exposes `isCommander` (false while emulating, like
  `isRHQ`).
- **COY Centre** (`/company-command`, `src/pages/CommanderPanel.jsx`): a
  deliberately simple, URL-only panel where a commander drafts/edits **only
  their own company's** intel fragments. Nothing publishes directly — each
  change becomes a pending submission with clear **LIVE / PENDING** status
  chips. Commander can edit a live fragment, request its removal, or withdraw a
  pending change. Company-locked (can't retarget another company).
- **RHQ Approvals** section in the Ops Centre ("Approvals (COY intel)",
  `src/pages/ops/SubmissionsEditor.jsx`): RHQ sees every company's pending queue
  and can **approve as-is**, **review/edit then approve**, or **dismiss**.
  Approving an edit writes the live `content/intel` slice; approving a removal
  takes the fragment down. Every action is audit-logged. No reject-with-reason
  loop by design — RHQ edits or approves, commander resubmits if dismissed.
- **Draft/pending layer** = new company-scoped Firestore collection
  `intelSubmissions` (`src/lib/submissions.js`), sitting in front of the
  published `intel` slice. Managed directly (not via `store.js` slice load) so a
  commander only ever writes their own company's docs. Works in LOCAL MODE
  (localStorage) with no Firebase.
- **Config-driven language check** (`src/lib/language.js` `BANNED_TERMS` +
  `src/components/LanguageWarning.jsx`): one editable list (e.g. *enemy →
  opposing force / OPFOR*, plus `review`-level flags like *hostile*) drives a
  **non-blocking advisory** shown in the RHQ intel editor and the COY Centre.
  Edit the list to change policy — no UI changes needed. Audit found no literal
  banned words in active copy; "hostile" (the fictional Meridian OPFOR) is
  flagged for review, not rewritten.
- **Nav**: login entry relabelled **"RHQ" → "Access"** (TopBar + Sidebar);
  post-sign-in console button is role-aware — **OPS CENTRE** (RHQ) /
  **COY CENTRE** (commander).
- ⚠️ **`firestore.rules` must be re-published** in the Firebase Console for the
  approval flow to work on the live site — added an `intelSubmissions` block
  (commander read/writes own company only via `isCommanderOf(coy)`; RHQ manages
  all) and a shared `isCommanderOf` helper. Rest of the site + LOCAL MODE work
  without republishing.

---

## 2026-07-21 — Map v2: full-bleed pixel-perfect territory map, natural pan/zoom, layout consolidation
- **New map art**: replaced `public/map/nsw-terrain.jpeg` with a cropped
  `public/map/nsw-terrain.png` (648x336, trimmed from the top/right of a
  658x359 source render) with a CSS filter applied
  (`contrast(140%) sepia(60%) brightness(75%) saturate(80%)`) for the
  intelligence-agency look. `MAP_ASPECT`/`MAP_PIXEL_WIDTH`/`MAP_PIXEL_HEIGHT`
  in `src/lib/territory.js` updated to match.
- **Pixel-perfect grid**: `TERR_COLS`/`TERR_ROWS` moved from 128x80 to
  216x112 so every colourable cell is an exact 3x3 block of the source
  image (648/3, 336/3) — the overlay grid was previously an arbitrary
  resolution that didn't line up with the art. `firebase/seed.js`'s
  `DEFAULT_TERRITORY` (blob positions, place-marker coords) rescaled
  proportionally to the new grid — since the underlying art changed too,
  RHQ should sanity-check placements in Map: Territory and drag as needed.
- **Ocean-tile blocking**: new `src/lib/oceanMask.js` majority-samples the
  source image per cell against the flat `#3c82b4` ocean fill (exact colour,
  no anti-aliasing in the art) to build a shared unpaintable mask, used by
  `MapEditor`'s paint handler and visualised as a dark overlay in edit mode.
  Lives in the shared data layer so any future paint surface enforces the
  same rule off one source of truth.
- **PixelMap rewrite** (`src/components/PixelMap.jsx`): replaced the native
  `overflow:auto` scroll box + `+`/`-` zoom buttons with a custom
  transform-based pan/zoom — one-finger/mouse drag pans in read-only mode,
  pinch or scroll-wheel zooms everywhere, and no scrollbar. Edit mode keeps
  one-finger/click painting as the priority gesture and adds two-finger
  touch (or middle/right-mouse) drag-to-pan instead, so painting and
  navigating can't fight over the same gesture. Boundary rendering switched
  from each cell stroking its own edge in its own colour (silently
  overwritten by whichever neighbour rasterised later — a position-dependent
  bug) to a single neutral outline colour drawn once per unique edge.
- **Brush size fix**: `MapEditor`'s NxN brush previously used
  `floor((size-1)/2)` as a radius, which collapsed even sizes like the
  default "2" down to a 1x1 stamp. Now paints an actual size x size block.
- **Layout**: `Home.jsx` map is now full viewport width (rendered outside
  the `.container` max-width wrapper), with the 1ATF/Meridian brief boxes
  moved below it instead of beside it. Collapsed the four separate per-
  company "role" panels into one panel per side: 1ATF's four recruit
  companies (A/B/C/D) now share a single role line (`narrative.oneatf.
  recruitRole`, new field) instead of each having unique text, with Echo/
  Support keeping their own; Meridian's three panels (title, motive, why-
  stop) collapsed to two, both consistently red-styled.
  `NarrativeEditor.jsx`'s Ops Centre form updated to match (one shared
  recruit-role field instead of one per company).
- **Support company colour**: was a flat grey (`#5b6f8c`, read as "no
  identity assigned"); changed to a rose/magenta (`#c9528a`) distinct from
  the other five company hues.
- **Map: Territory swatches**: reorganised into two explicit rows (Full /
  Contested) instead of one interleaved row.
- **Ops Centre default landing section** changed from Map: Narrative to
  Map: Territory (`OperationsCentre.jsx`).
- ⚠️ If Firestore already has real (non-seed) `narrative`/`territory`
  content saved from earlier testing, it will keep the old shape/resolution
  until RHQ re-saves it from the Ops Centre — `oneatf.recruitRole` will
  render blank and the territory grid will render at its old (lower)
  resolution until then. No crash either way; `PixelMap` renders whatever
  `cols`/`rows`/`cells` the stored `territory` doc actually has.
- Not verified in a running browser this session — no Node/npm available in
  this environment to run `npm run dev`/`build`. Reviewed all changed files
  manually; next session (or the user) should smoke-test pinch/drag/zoom on
  both the public map and Map: Territory, and confirm the ocean mask lines
  up with the coastline, before considering this done.

---

## 2026-07-22 — Territory map ships the hatch tint (decision made after the design-artifact round below)
Follow-up to "territory-tint options explored (design only)" below — RHQ picked a
direction after tuning it live in the throwaway Hatch Lab artifact; this
session wired the chosen settings into `PixelMap.jsx` for real.
- **Flat 40%-alpha wash replaced with diagonal hatch, per owner colour**
  (`src/components/PixelMap.jsx`): each held cell's colour now comes from a
  45°, 12px-spaced, 3.1px-thick hatch line pattern at 48% opacity instead of
  a solid fill — terrain stays visible through the gaps, including under a
  large Meridian holding, which was the original complaint. No underwash
  (no flat fill layer at all under the lines). New constants
  `HATCH_ANGLE`/`HATCH_SPACING`/`HATCH_THICKNESS`/`HATCH_OPACITY`/`HATCH_DASH`.
  `IMAGE_FILTER` (the CSS filter on the base map image) is unchanged.
- **Boundary border**: still the single neutral colour for every edge
  (unchanged reasoning — see the border-ambiguity note further down this
  file), just retuned to `rgba(6, 10, 18, 0.6)` at 3px (was 0.85 alpha /
  1.5px).
- **Rendering technique**: each owner's hatch is drawn full-canvas then
  masked down to that owner's cells via an offscreen bitmap +
  `destination-in` composite, not a `clip()` path built from thousands of
  unioned per-cell rects — the latter produced a hard rasteriser seam
  artifact under testing. One pass over the grid buckets cells into
  per-code mask canvases (not one full grid pass per code) to keep this
  cheap with up to ~16 codes present (8 letters × lighter/full variants).
- **Canvas now sized to its real on-screen resolution, not a fixed
  `cols*CELL` buffer left for the browser to rescale.** The old fixed buffer
  (216×112 cells at a constant 8px/cell) got rescaled by the browser to
  whatever the container's actual CSS width was — almost never an integer
  ratio — and nearest-neighbour (`image-rendering: pixelated`) rescaling at
  a non-integer ratio is exactly wrong for a fine periodic pattern like
  hatch lines: it aliases into a denser, uneven wash. The draw effect now
  measures `containerRef`'s `getBoundingClientRect().width` × `devicePixelRatio`
  and sizes the canvas buffer to match exactly, with a `ResizeObserver`
  (120ms debounced) to redraw on container resize. `CELL = 8` is kept only
  as the fallback JSX attribute for the very first paint before the effect
  runs. This fix isn't hatch-specific — it was already true for the old flat
  fill and border too — but flat colour and even a 1.5px border don't alias
  visibly the way periodic hatch lines do, so it went unnoticed until now.
- Verified this session in a real browser: the public Home map against
  live production Firestore data, the "+" zoom button, and the Ops Centre
  Map: Territory editor (painting + save) — the last of those against a
  throwaway local-mode account (`VITE_FIREBASE_DISABLE=1` in a `.env.local`
  created and deleted within the session, never committed) so as not to
  touch production data just to test the editor.
- Superseded from the exploration session below: the "current" flat-wash
  baseline described there is no longer what ships; the hatch option (and
  the border-colour-ambiguity reasoning for keeping one neutral border) is
  now the live behaviour, not just a comparison artifact.

---

## 2026-07-22 — Home spacing/Meridian third box; territory-tint options explored (design only)
- **Company-roles row spacing** (`Home.jsx` `OneATFBrief`): widened the gap
  between each badge group and its role text (8px → 14px), dropped the
  dividers between the three rows now that they're all the same left-aligned
  shape, and added a touch more line-height on the role text to compensate
  for losing those dividers as a visual separator.
- **Meridian brief**: the `THREAT: SEVERE` tag now sits on the same row as
  the `MERIDIAN // HOSTILE` heading (was stacked below it) via a
  `row between center` header. Added a third heading+body pair — reused the
  `objective` field that already existed in `DEFAULT_NARRATIVE`
  but was never rendered anywhere, and gave it a matching `objectiveHeading`
  (default `'OBJECTIVE'`) so it now shows between Motive and Why We Stop Them.
  `NarrativeEditor.jsx`'s Meridian Brief form gained the matching "Box 2"
  heading/content fields (existing Why fields renumbered to Box 3).
- **Territory tint exploration**: built a standalone comparison artifact
  (not part of the app/repo) rendering the current flat-wash-plus-border
  approach against four alternatives — border-led/low-wash, diagonal hatch,
  pixel stipple, and a "frontline glow" (colour intensity falls off with
  distance from the territory's own boundary, so secure interior ground
  reads clear and only contested edges glow) — over the real map art with a
  synthetic sample layout. This was the side-by-side comparison flagged as
  deferred in the 07-21 entry below ("current semi-transparent fill washes
  out terrain detail, worst under Meridian red"). Recommended border-led as
  the safe default and frontline-glow as the strongest narrative fit if RHQ
  wants to prototype further; hatch as a middle ground; stipple flagged to
  verify on phone-width screens specifically. **No code changed in
  `PixelMap.jsx` from this** — purely a design-review artifact for RHQ/the
  user to pick a direction from before anyone implements one.

---

## 2026-07-22 — Home brief cleanup, merged tabs, Briefings content, map saturation
- **Company-roles box alignment fix** (`Home.jsx` `OneATFBrief`): the Echo and
  Support rows used `.row center` (`justify-content:center`), which centred
  those two short rows in the panel while the A/B/C/D badge row above stayed
  left-aligned (`.row` only) — the visual indent the user flagged. All three
  rows now use the same left-aligned `.row` + `alignItems:'center'` pattern,
  badge(s) followed by role text.
- **Removed the 1ATF/Meridian tab switcher** on Home — both briefs now render
  stacked, always visible, instead of one being hidden behind a tab click.
  `useState`/tab buttons deleted from `Home.jsx`.
- **Briefings tab now has real content.** `briefings.content` (a single free
  -text blob) replaced with `briefings.sections` (an array of
  `{ heading, body, highlight? }`) plus a `closingQuote`, seeded in
  `firebase/seed.js` `DEFAULT_BRIEFINGS` with the full "Operation Sovereign"
  brief text (Situation / The Unit / The Mission / The Progress Map / Your
  Directive) transcribed from the unit's briefing PDF. `Briefings.jsx` renders
  each section in its own panel with a small accent numbered heading; the
  Mission section's `highlight` (the actual mission statement) renders as a
  bold bordered callout above its body paragraphs, visually distinct from
  ordinary body text — the "different styles for headers vs. the mission
  sub-part" the user asked for. `BriefingsEditor.jsx` (Ops Centre) rewritten to
  match: editable heading/body per section, plus the highlight field only on
  sections that have one, plus video and closing-quote fields.
  `Briefings.jsx`/`BriefingsEditor.jsx` both fall back to the seeded default
  sections if a stored doc predates this change (has no `sections`), so an
  old `{video, content}` doc won't render an empty page.
- **Map saturation** bumped 15% (`saturate(80%)` → `saturate(92%)` in
  `PixelMap.jsx`'s `IMAGE_FILTER`) per user request.
- Browser-verified this session (dev server + Playwright/Chromium
  screenshots) — Home shows both briefs stacked with consistent left-aligned
  rows, Briefings shows all five sections with the mission callout styled
  distinctly, no console errors.

---

## 2026-07-22 — Browser-tested the 07-21 map rewrite, fixed what broke in practice
Follow-up to "Map v2" below, now actually exercised in a running browser (that
session had no Node/npm available and shipped unverified). **Supersedes** that
entry's interaction-model description and its "not verified" caveat — the
image/grid/data-shape/layout-consolidation parts of 07-21 stand unchanged.
- **Found the actual cause of the "5x5 brush paints wider than tall" bug**:
  it wasn't a fresh alignment bug — Firestore still had the *old* 128x80
  territory doc from before the pivot, which cannot render squarely against
  the new image's aspect ratio (128x80 ≠ the same ratio as 216x112). Added a
  self-heal in `src/lib/store.js` (`loadState`/`normalizeTerritory`): if the
  stored territory's cols/rows don't match the current grid constants, fall
  back to the fresh default instead of rendering a skewed grid. No forced
  writes — this persists for real once RHQ next saves in Map: Territory.
- **Replaced 07-21's pinch/wheel/two-finger pan/zoom entirely** — in
  practice it fought the page's own scroll on both touch and trackpad ("the
  scrolling map... doesn't work because of the scrolling of the whole
  website"). New model, deliberately minimal: public map gets one "+"/"−"
  button that zooms to a single fixed step, centred; only once zoomed does
  click-and-drag pan. `touchAction` now only switches to `none` when there's
  actually something to drag, so an unzoomed map no longer traps normal
  page-scroll swipes on mobile. The Ops Centre editor gets **no pan/zoom at
  all** — the full grid always fits the container (this alone was the actual
  fix for "broken zoom, can't see the RHQ marker"); one finger/click always
  paints, full stop.
- **Coastline resolution**: the paint-blocking ocean mask is still
  grid-cell-resolution (that's the right granularity for "can I click here"),
  but `src/lib/oceanMask.js` now also builds a separate *native-resolution*
  overlay image (`getOceanOverlayUrl`) for the editor's visual coastline
  shading, so it reads as a crisp coastline instead of a blocky 3px-grid
  approximation — same underlying pixel data, two different jobs.
- **Layout**: pulled the map back from full 100vw-width into the same
  `.container` margins as the rest of the page — full-bleed was "a bit much"
  against the boxes below it, which keep their own container width.
- Border-rendering fix (single neutral outline colour instead of
  each side stroking its own fill colour) and the brush-size NxN fix both
  carry over unchanged from 07-21 — re-confirmed still correct.
- Deferred (explicitly, not forgotten): a side-by-side comparison of
  different territory-tint rendering approaches — the current semi-transparent
  fill washes out terrain detail underneath it, worst under Meridian red.
  Flagged for its own follow-up session rather than guessing at a fix blind.

---

## 2026-07-21 — Docs sync: CLAUDE.md corrected to match the post-pivot app; changelog started
- Read through the actual current codebase (routes, data layer, map component,
  auth, Firestore rules) and found [CLAUDE.md](CLAUDE.md) was stale relative to
  two recent pivots (`568b459`, `5a05de8` below): it still described a
  Leaflet/react-leaflet zone-and-arrow map with member ID login gating the
  public site, per-member Tasks/Activity/Company pages, and EmailJS.
- Rewrote CLAUDE.md to describe what's actually shipping: the pixel-grid
  `<canvas>` territory map (`PixelMap`/`territory.js`), the three no-login
  public tabs (Home / Intel / Briefings) with a device-local company dropdown
  instead of member auth gating content, RHQ-only auth still guarding
  `/operations-centre`, and the current Firestore slice/collection list.
  Confirmed EmailJS (`src/lib/notify.js`) and the error-auto-report system
  (`src/lib/errors.js`) are both still live and unchanged — kept those
  sections, just clarified where they live.
- No functional/code changes this session — docs only.
- Created this file (`CHANGELOG.md`) itself, seeded with the full prior commit
  history condensed below, so future sessions have continuity.

---

## Prior history (condensed from git log, pre-dates this changelog)

**2026-07-20 — Pivot to pixel-grid NSW map + no-login public tabs** (`568b459`, `5a05de8`, plus the terrain-image lead-up `90ea060`, `20f1471`, `9bd1f5f`, `c624151`)
- Replaced the Leaflet zone/arrow map with a custom pixel-grid `<canvas>` map
  over a committed NSW terrain image (`public/map/nsw-terrain.jpeg`).
- Removed member ID login as a gate on the public site; added a device-local
  company dropdown (`CompanyContext`) so visitors can see their company's
  intel without authenticating.
- Split content into three public tabs (Home, Intel, Briefings) and renamed/
  reorganised the Operations Centre sections accordingly.
- Public Intel fragments introduced as decrypt-style puzzles.

**2026-07-14 to 2026-07-16 — Map & activity refinements** (`510be46`, `2214f5b`, `a9416a4`, `66ff45e`, `4d6be81`, `6d460ea`, `924cc83`)
- Gradual territory conquest on movement lines (RHQ-controlled layer) — later
  superseded by the pixel-grid rebuild above.
- Per-user rank stored and surfaced (dropdown with long/short forms), home
  welcome greeting shows rank from roster.
- Activities: inline document embedding (repo path / direct link / Google
  Drive), resources sidebar, "decipher" activity type, re-distribution, RHQ
  company handling.

**2026-07-03 to 2026-07-06 — Auth/credential hardening** (`88bd79a`, `e65af67`, `e772edf`, `71a2128`)
- Temp passwords marked used and hidden once consumed, re-issued on demand.
- Regenerating a temp password now resets the member's login (bumps the
  credential epoch — see `authIndex` in CLAUDE.md's auth model section).
- Home video draft/deploy/schedule flow, RHQ "view as" emulation introduced,
  admin self-heal, clearer login copy (Student ID wording, numbers-only).

**2026-06-29 to 2026-07-01 — QoL passes + map zone system** (`c8226b7`, `3abe524`, `019d92b`, `e1dddf7`, `64dc5d4`, `269cf4a`, `f52d777`, `2975740`)
- Hardened Firestore rules; fixed reset-request write path.
- Map (Leaflet-era): zone save fixes, custom/state zone types with overlap
  resolution, live move, coastline clipping, border-hugging movement lines.
- Error boundary, toasts, confirm dialogs, login hardening.
- Last-updated timestamps + RHQ audit log.
- Accessibility and mobile polish.
- Bulk roster delete.

**2026-06-25 to 2026-06-26 — Early build-out** (`8ead728`, `d917f53`)
- Map editing, help system, error reporting introduced.

**2026-06-24 to 2026-06-25 — Repo initialised**
- Initial upload/setup of the 1ATF portal project.
