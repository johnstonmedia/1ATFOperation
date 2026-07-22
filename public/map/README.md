# Map background image

The NSW terrain image lives here named exactly:

    nsw-terrain.png

648x336 px. The territory grid (`TERR_COLS`/`TERR_ROWS` in `src/lib/territory.js`)
is deliberately sized so each grid cell maps to an exact 3x3 block of this
image (648/3 = 216, 336/3 = 112) — keeps the colourable grid pixel-aligned to
the actual map art instead of an arbitrary overlay resolution.

Ocean tiles are auto-detected (majority-pixel sampling against the flat
`#3c82b4` ocean fill, see `src/lib/oceanMask.js`) and can't be painted in the
Operations Centre editor — if you replace this image, keep ocean rendered as
that exact colour (or update `OCEAN_COLOR` in `territory.js`).

If you swap in a differently-sized image, update `MAP_PIXEL_WIDTH`/
`MAP_PIXEL_HEIGHT`, `MAP_ASPECT`, and `TERR_COLS`/`TERR_ROWS` together in
`src/lib/territory.js` (and the seed's `territory.cells` string length, and
place marker positions, need to stay in sync — see CLAUDE.md).
