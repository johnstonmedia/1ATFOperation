# 1ATF Operational Portal — project context & handoff

Futuristic, intelligence-agency–styled portal for the **Shore Cadet Unit / 1st
Australian Task Force (1ATF)**. Presents an interactive operation to regain
territory from the hostile **Meridian** across a pixel-art map of NSW,
Australia.

This file is the running context for any Claude/Claude Code session. Read it
first. See [CHANGELOG.md](CHANGELOG.md) for a running log of what's actually
been changed session-to-session — read that too before touching code, so you
don't repeat or undo recent work.

## Stack & deployment
- **Vite + React + React Router**. Map is a custom `<canvas>` pixel-grid
  (`PixelMap`), not Leaflet — `leaflet`/`react-leaflet` remain dependencies but
  are unused by the live map. **Firebase** (Auth + Firestore) backend, `xlsx`
  for spreadsheet import, **EmailJS** ([src/lib/notify.js](src/lib/notify.js))
  for admin/member email notifications — silent no-op until `VITE_EMAILJS_*`
  keys are set, request is always stored in Firestore regardless.
  **Google Analytics 4** ([src/lib/analytics.js](src/lib/analytics.js)) is the
  same shape: entirely absent until `VITE_GA_ID` is set — no script, no cookie,
  no request. See "Analytics" below before touching it.
- Hosted on **GitHub Pages** via [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
  (deploys `dist/` on every push to **main**). Pages Source must be **GitHub
  Actions**. Served from the root of a **custom domain** (set in Settings →
  Pages), so the build uses `VITE_BASE=/` and `public/404.html` keeps 0 path
  segments — both must be reverted (to `/<repo>/` and 1) if the custom domain
  is ever removed. The custom domain must also be in Firebase Auth's
  **Authorized domains** list or sign-ins fail.
- SPA deep links handled by `public/404.html` + a restore snippet in `index.html`.
- **Firebase is enabled by default** — real keys are hard-coded as fallback
  defaults in [src/firebase/config.js](src/firebase/config.js) (they're public
  by design; security is via Firestore rules). Set `VITE_FIREBASE_DISABLE=1` in
  a local `.env.local` to force LOCAL MODE (localStorage) for offline dev
  without touching production content.
- The repo's deploy branch is **`main`** (not a `claude/*` branch — update this
  note if that changes).

## App shape (current)
Three **public, no-login** tabs behind the main shell, plus chrome-less
routes — see [src/App.jsx](src/App.jsx):
- `/` **Home** — hero + unread-content alert banners (red, above the map —
  see `useUnseen` below) + the pixel territory map of whichever map `activeMap`
  names (visitors never see any other) + **SMEAC operation brief**
  (`smeacOf()` in seed.js merges older stored narratives) + **Recent
  Movements** + company roles + Meridian brief. *Recent Movements* is
  `narrative.movements` (`{ show, title, intro, entries: [{ id, company, text
  }] }`, merged by `movementsOf()` the same way) — short notes on what each
  company DID to change the map, sitting above the roles box; RHQ toggles the
  whole box off with `show`, and an empty entry list hides it too. The
  **Meridian brief is ONE box with exactly two headings** (2026-08-04):
  `whyStop` still publishes but runs on under MOTIVE, so `whyHeading` is no
  longer rendered anywhere — don't reintroduce a third heading. Public nav is responsive: pinned left rail ≥768px,
  hamburger drawer below (`NavContent` in Sidebar.jsx is shared by both);
  the Ops Centre is the inverse — rail pinned on desktop, ☰ MENU drawer
  ≤820px. **Unread tracking** (`src/hooks/useUnseen.js`, device-local, no
  auth): briefings use `useUnseen(slice)` — the slice's `updatedAt` vs a
  stored stamp. **Intel is company-scoped**: `useUnseenIntel(company)`
  fingerprints only the fragments that visitor can see (`ALL` + own company)
  via `intelSignature()`, so another company's edits never light their alert;
  a first visit (or a company switch) silently records the baseline
  (`hasIntelBaseline`) so the alert only ever fires on a real change.
  Intel/Briefings pages mark themselves seen on open.
- **First-visit company gate** ([CompanyGate.jsx](src/components/CompanyGate.jsx)):
  the boot/"SECURE LINK ESTABLISHED" screen asks for the visitor's company
  before the public shell renders, once per device. `CompanyContext` exposes
  `chosen` (the localStorage key **exists**) separately from `company` (which
  may be `''` if they skipped), so skippers aren't re-prompted. Gate applies
  only to the `PublicShell` routes in App.jsx — Classified / ops / COY
  consoles bypass it.
- `/intel` **Intel** — "Intercepted Intelligence": RHQ-wide fragments plus
  company-specific ones, gated only by the **company preference** (chosen at
  the boot gate, changeable from the nav dropdown; device-local, no auth —
  [CompanyContext](src/context/CompanyContext.jsx)).
  Fragments are decrypt-style puzzles (fill in redacted words) with optional
  `hint`, linked docs/images. **Intel is a fun optional side activity, not a
  delivery channel for must-know unit admin** — that's why hints are opt-in and
  there's deliberately no forced reveal. Keep it that way: if a reveal ever
  carries real logistics, being stuck starts costing attendance.
  **Decrypt progress** ([src/lib/intelProgress.js](src/lib/intelProgress.js)) is
  device-local like `useUnseen` — solved fragment ids in localStorage, counted
  only over fragments that have an answer and that this visitor can see. Drives
  the `04 / 07` meter on the Intel tab, the ✓ ticks on fragment cards, and the
  Home banners (red = RHQ posted something new; the quiet accent variant =
  you have puzzles left). **Anonymous solve counts**
  ([src/lib/intelStats.js](src/lib/intelStats.js)) go to the `intelStats`
  collection — see "Data model" and the privacy notice.
- `/briefings` **Briefings** — a video embed + free text, admin-edited. The
  video is a link, a **pasted `<iframe>` embed code**, or a file **dragged into
  the ops editor** and uploaded to Firebase Storage — see "Briefing video
  upload" and "Video resolution" below.
- `/privacy` **Privacy Notice** — small static member-facing privacy policy
  ([src/pages/Privacy.jsx](src/pages/Privacy.jsx)), linked from the footer in
  [Layout.jsx](src/components/Layout.jsx). Deliberately repo-versioned, not an
  RHQ-editable slice.
- `/Classified` (and `/classified`) — the original standalone landing page
  cadets are sent to. Purely a splash screen now (2026-08-04): "Continue"
  goes straight into the public portal at `/` — it no longer connects to
  member login/registration or Help & Support.
- `/operations-centre/*` — **RHQ-only** admin console (see below). URL-only,
  not linked from nav.
- `/staff-centre` — **Staff Centre**: URL-only unit overview
  ([src/pages/StaffCentre.jsx](src/pages/StaffCentre.jsx)). **Two ways in**
  (2026-08-05): a signed-in `Staff` / `RHQ Staff` account, or the shared staff
  password — which is no longer hard-coded, it lives in the `staffAccess` slice
  and is changed by ID **190990 only** in Ops Centre → Users. Moving it out of
  the bundle did NOT make it a secret (`content/*` is world-readable); it is
  still a latch, acceptable because the page only shows already-public
  `content/*` data and no PII. Shows pending
  COY approvals, scheduled video distribution, intel per company, the campaign
  timeline and content freshness — as an overview of clickable cards, each
  opening a detail view with the real content (intel fragments incl. answers,
  the video playing, the live map, activity feed, full SMEAC/briefing text).
  NOTE: `intelSubmissions` is RHQ / RHQ Staff / own-commander only under the
  rules, so the approvals list is empty-with-a-notice for a password-only
  visitor against live Firebase (works in LOCAL MODE / when signed in).
- `/company-command` — **Company Commander-only** "COY Centre"
  ([src/pages/CommanderPanel.jsx](src/pages/CommanderPanel.jsx)). URL-only;
  reached via the role-aware **COY CENTRE** button shown once a commander signs
  in. See "Company Commander & intel approval" below.

## Staff roles & the Staff Centre (v2.4, 2026-08-05)
- Two roles whose only home is `/staff-centre` — neither is `isRHQ`, so neither
  can ever reach the Operations Centre or the COY Centre:
  - **`Staff`** — the read-only overview, but signed in and attributable.
  - **`RHQ Staff`** — the same, **plus a working COY intel approval queue** for
    **every** company: approve, edit-then-approve, dismiss.
- `useAuth()` exposes `isStaff` (either staff role), `isRHQStaff`, and
  **`isAdmin`** (ID `190990`). All are suppressed while emulating, like `isRHQ`.
- **Only ID 190990 may create staff logins.** Any other RHQ sees a role
  dropdown with `Staff`/`RHQ Staff` filtered out, and opening an existing staff
  user shows the role frozen rather than missing — dropping the option silently
  would let a save rewrite their role to whatever landed in an empty `<select>`.
  Enforced in the **UI only**; the rules do not distinguish one RHQ from
  another. Spreadsheet import can't mint staff either (it hard-codes
  `COMMANDER_ROLE`).
- The **shared staff password** moved from a `const` in StaffCentre.jsx to the
  `staffAccess` single-value slice, edited in the `StaffAccessPanel` in
  Ops Centre → Users (administrator only). A **missing doc keeps the seed
  default**, so `SCUNARRATIVE` still works until it's changed — nobody is
  locked out by deploying this. An **empty** stored password matches nothing,
  so a misconfigured slice fails closed rather than opening the door.
- The approval queue is ONE component,
  [src/components/ApprovalsQueue.jsx](src/components/ApprovalsQueue.jsx), used
  by both Ops Centre → Approvals and Staff Centre → Approvals. Only the page
  chrome differs, via a `Header` prop taking `{ title, sub, children }` (pass
  `OpsHeader`, or `StaffSectionHeader`). `SubmissionsEditor.jsx` is now a
  three-line wrapper — put queue changes in the shared component, not there.
- **Rules**: `isRHQStaff()` in [firestore.rules](firestore.rules) grants exactly
  three things — read/write `intelSubmissions`, write **`content/intel` only**
  (an extra `match /content/intel` block; overlapping matches are OR'd, so every
  other `content/*` doc stays RHQ-write-only), and **create-only** on `audit`
  (it logs what it approved but can't read the log back). ⚠️ Needs the pending
  rules republish — until then RHQ Staff approvals fail live.

## Company Commander & intel approval (v2.1)
- **Company Commander** is a role (now the **default** at user creation), bound
  to one company; it may only ever see/act on that company's data. `useAuth()`
  exposes `isCommander` (suppressed while emulating, like `isRHQ`).
- Login entry is labelled **"Access"** (TopBar + Sidebar); after sign-in the
  console button is role-aware — **OPS CENTRE** (RHQ) / **COY CENTRE**
  (commander). Commanders use the same temp-password auth as everyone else.
- In the COY Centre a commander drafts/edits **only their own company's** intel
  fragments. Nothing publishes directly — each change becomes a pending
  `intelSubmissions` doc (company-scoped Firestore collection; LOCAL MODE uses
  localStorage). Helpers: [src/lib/submissions.js](src/lib/submissions.js).
- RHQ approves in the Ops Centre **Approvals** section
  ([src/pages/ops/SubmissionsEditor.jsx](src/pages/ops/SubmissionsEditor.jsx)):
  approve as-is, edit-then-approve, or dismiss. Approval writes the live
  `content/intel` slice; removal requests take a fragment down.
- **The fragment editor is ONE component**,
  [src/components/FragmentForm.jsx](src/components/FragmentForm.jsx) (fields +
  the resources/handouts panel), shared by the ops Intel editor, the COY Centre
  builder and the Approvals review screen — so a reviewer can change *every*
  field the author could, hints and handouts included. It was three copies until
  2026-08-13 and the approvals copy had drifted (no hint, no images, resources
  unaddable). Put fragment-editing changes there, not in a caller. Each caller
  supplies its own `audience` node: a `<select>` for RHQ, a read-only line where
  `company` is re-stamped on save anyway.
- **Language compliance:** config-driven `BANNED_TERMS` in
  [src/lib/language.js](src/lib/language.js) + `<LanguageWarning>` (advisory,
  non-blocking) in the intel editors / COY Centre. Edit the list to change
  policy — no UI changes needed.

Member login/auth **still exists** (ID-number sign-in, temp-password
registration, RHQ role) but it now only gates the **Operations Centre**, not
the three public tabs. There is currently no per-member Tasks/Activity page in
the routed app (`tasks`/`activity` slices and their admin plumbing still exist
in the data layer but aren't surfaced on a public route — check before
assuming a page exists).

## Auth model (`src/context/AuthContext.jsx`)
- Members authenticate with their **ID number** (not email). Firebase Auth
  uses a synthesised email `id-<id>[.v<version>]@1atf.unit`.
- **First-time / post-reset:** `register()` — ID + issued temp password (validated
  against the roster) + a new password they choose.
- **Returning:** `signIn()` — ID + password.
- **Password reset:** RHQ bumps a per-ID **credential epoch** (`authIndex`, see
  `lib/store.js getAuthVersion/setAuthVersion`); the versioned email makes the
  member re-register with a fresh temp password.
- **Bootstrap admin: ID `190990`** is RHQ and can always sign in, even before
  any roster exists; it's auto-written into the roster (`ensureAdminRoster`) so
  it shows in Users.
- **RHQ "view as" emulation**: `?emulate=<company|GENERAL>` on any URL overlays
  a synthetic General member on top of a real RHQ session (`AuthContext`
  `emulation` state, shown via the banner in [Layout.jsx](src/components/Layout.jsx)).
  Reads still run under the real RHQ session; only a genuine RHQ user can
  trigger it.
- Roles: **Company Commander** (default at creation, company-bound), **RHQ**,
  **RHQ Staff**, **Staff**, and legacy **General** (`ROLES`/`COMMANDER_ROLE`/
  `STAFF_ROLE`/`RHQ_STAFF_ROLE`/`RESTRICTED_ROLES`/`isStaffRole` in
  `src/firebase/seed.js`) — see "Staff roles" below.
  Companies (phonetic letters): A Alpha, B Bravo, C Charlie, D Delta, E Echo,
  S Support. Meridian is the threat force (red on the map; code keeps
  `hostile` as an identifier — user-visible copy says "threat").

## Data model
- Firestore single-value docs under `content/{slice}`: `narrative`,
  `classified`, `branding`, `companyPages`, `video`, `intel`, `intelIntro`,
  `briefings`, `staffAccess`, `activeMap`, plus **per map** a `territory` and a
  `campaignDefaultStart` doc (public read, RHQ write) — see `SINGLE_SLICES` in
  [src/lib/store.js](src/lib/store.js), which builds that list from the map
  registry. `activeMap` names the one map the public portal shows;
  `campaignDefaultStart` is just a frame id (or `null`) — see "Campaign
  replay" below. **The primary map keeps the original unsuffixed names**
  (`territory`, `campaignDefaultStart`) so existing documents are untouched;
  every other map gets `territory_<mapId>` / `campaignDefaultStart_<mapId>`.
  Adding a map therefore needs no Firestore rules change — see "Maps" below.
- Collections: `roster`, `tasks`, `activity`, `support`, `resetRequests`,
  `audit`, `campaignFrames` — see `COLLECTION_SLICES` in the same file.
  `campaignFrames` is the territory replay history for **every** map (see
  "Campaign replay" below): one document per frame,
  `{ order, cells, label, map, ts, updatedAt }` —
  each frame a full grid snapshot, not a diff, so RHQ can edit/reorder/
  duplicate/delete any single frame independently via
  [src/lib/campaign.js](src/lib/campaign.js)'s pure `sortFrames`/
  `framesValid`/`frameCells`/`frameCaptions`/`renumberFrames` helpers.
  `map` scopes a frame to one map (absent = the primary map) — deliberately
  one shared collection rather than one per map, so a new map needs no new
  rules block. ⚠️ `persistCollection` DELETES any document missing from what
  it is handed, so every write of `campaignFrames` must carry the other maps'
  frames through: use `withMapFrames()` from `lib/maps.js`, never a bare
  filtered array. Plus
  two collections managed directly, not through `store.js`:
  `intelSubmissions` (the Company Commander approval queue, via
  [src/lib/submissions.js](src/lib/submissions.js)) and **`intelStats`**
  (anonymous decrypt counts, via
  [src/lib/intelStats.js](src/lib/intelStats.js)) — one doc per
  (company, fragment), `{ company, fragmentId, solves, lastAt }`, written by
  UNAUTHENTICATED visitors with a merge + `increment(1)` (the Intel tab has no
  login, so public write is unavoidable). It carries **no identity of any
  kind**, and the rules pin it to exactly those four fields with create-at-1 /
  update-by-exactly-+1 so the worst case is inflating one counter one request
  at a time. Treat it as an engagement signal, never a score: it counts
  devices, not people. Surfaced in Ops Centre → Intercepted Intelligence
  ("Decrypts"), and described in [Privacy.jsx](src/pages/Privacy.jsx) —
  **update that notice if the shape ever changes**.
- ⚠️ **LOCAL MODE is a deployment hazard, not just a dev convenience.** A build
  made with `VITE_FIREBASE_DISABLE` set reads and writes the browser only, so
  every panel shows seeded defaults and an empty campaign — while sign-in still
  appears to work, because the bootstrap admin is accepted with ANY password in
  that mode (`signIn`'s LOCAL MODE branch). A preview deploy carrying that
  variable therefore looks exactly like a live site that has lost its content.
  The Ops Centre now says so outright (`LocalModeWarning` in
  OperationsCentre.jsx), alongside `LoadErrors`, which lists any Firestore read
  that failed — reads fall back to the seed silently, so a denied
  `content/territory` otherwise reads as wiped progress.
- Data layer in `src/lib/store.js` (mode-agnostic: same async API over
  Firestore or localStorage). `DataContext` provides `updateSlice`,
  `replaceRoster`, `append`, `reportError`, `reload`, `logAudit`.
- Defaults/seed content in [src/firebase/seed.js](src/firebase/seed.js).

## Maps (`src/lib/maps.js`) — there is more than one (2026-09-12)
- ⚠️ **A map's `id` is baked into stored data** — its slice names
  (`territory_<id>`) and the `map` field on every campaign frame — so only the
  DISPLAY NAME (`name`/`short`/`sub`/`blurb`) is ever safe to change. The two
  maps were renamed on 2026-09-13 (`nsw` → "1ATF Full Progress Map",
  `singleton` → "1ATF Regional Progress Map") with their ids left alone for
  exactly this reason; renaming an id orphans its documents.
- **`MAPS` in [src/lib/maps.js](src/lib/maps.js) is the single description of
  what a map is**: art file, native pixel size, territory grid, an optional
  `blockFill` (a flat colour in the art that can never be painted) and an
  optional `imageFilter` (see below). Two ship:
  - **`nsw`** — **1ATF Full Progress Map**, `public/map/nsw-terrain.png`,
    648×336, 216×112 grid, ocean `#3c82b4` unpaintable. The **primary** map
    (`PRIMARY_MAP_ID`), and the seeded default.
  - **`singleton`** — **1ATF Regional Progress Map** (Singleton Military Area,
    **Sector 8**, AUSPEC0196), **432×306 grid — four times the cells of every
    other map** (2026-09-14). Ground here is taken a fraction of an activity
    area at a time, and at 216×153 a cell was ~59 m: High Ropes was seven cells
    across, so a part-taken fill could not follow its outline and read as a
    blocky approximation sitting over the shape rather than inside it. At
    432×306 a cell is ~30 m and the fill hugs the boundary. ⚠️ Refining it
    INVALIDATED every stored singleton frame and territory (length no longer
    matches — `normalizeCampaignFrames`/`normalizeTerritory` drop and re-seed),
    which is safe only because those frames are generated from the plan; NSW is
    untouched. Rebuild with **Build N Frames from Camp Plan**. ⚠️ **It OPENS on Sector 8**, not
    the whole sheet: `focus: { x0, y0, x1, y1, label }` on the map record,
    applied once by PixelMap via `focusView()` in maps.js (never in edit mode —
    RHQ paints the whole map). Every zone the camp plan touches lies west of
    the sector line; Sector 9 is empty ground and framing both made the half
    that matters small. It is a STARTING VIEW, not a crop — the imagery, the
    traced boundaries and the Sector 7/9 markers all still cover the full
    sheet, and a visitor can zoom out to them. Because the frame is wider than
    the focus box, ground outside the area stays on screen, so the map states
    which area it is: the `◤ SECTOR 8 — AREA OF OPERATIONS` tag in PixelMap.
  - ⚠️ **The sector 8/9 line is YELLOW, not green** (2026-09-14). Once the map
    became Sector 8's, that line stopped dividing two halves of one picture and
    became the area's EASTERN BORDER — the same kind of thing the Commonwealth
    boundary is on every other side, so it takes the same yellow and closes the
    shape. Its narrower stroke still tells them apart up close. **A live satellite map**: it pulls NSW SIX Maps tiles at
    whatever zoom level the user is actually looking at, so zooming in reveals
    real detail instead of magnifying pixels.
  - **The frame is WEB MERCATOR** (`geo.merc`), and that is load-bearing. It
    used to be the paper sheet's own MGA Zone 56 rectangle — survey-correct,
    and the obvious choice while the art was derived from the sheet. MGA Zone
    56 is rotated **0.99° from the Web Mercator grid** every XYZ tile service
    publishes on: 180 m, about 3.7 grid cells, of skew corner to corner. Tiles
    dropped into the old frame sat visibly crooked under the boundaries. In a
    Mercator frame a tile lands with a pure linear transform and no warping,
    which is why there is no reprojection code in the browser.
    ⚠️ Anything that re-derives map geometry has to agree with `geo.merc`:
    `MERC_*` in `build-singleton-map.py` and in
    `trace-singleton-boundaries.py`. Change one and you must change all three.
  - **Grid references come from an affine**, not a projection
    (`geo.affine`, used by `eastingNorthingOf`/`gridRefOf`). Converting
    Mercator to MGA properly needs a Transverse Mercator series; over a 10 km
    frame a fitted affine is accurate to **2.1 m worst case, 0.46 m RMS**,
    against the 100 m digit a six-figure reference actually quotes — so no
    projection library ships to the browser. Verified against the surveyed
    Ex Admin Area point (−32.763022, 151.182969 → cell 104.01, 95.79 →
    `GR 297 735`, 0.29 m from a true pyproj conversion). Maps without `geo`
    (NSW) return null from both helpers.
  - **Tiles** ([TileBase.jsx](src/components/TileBase.jsx)) are `<img>`
    elements positioned as PERCENTAGES of the frame, inside PixelMap's existing
    zoom/pan transform — so the browser scales them with everything else, there
    is no redraw on pan, and there is no second coordinate system to keep in
    sync with the cell grid. Tile maths (`mercFrame`/`tileZoomFor`/`tilesFor`)
    lives in `lib/maps.js`. Deeper zoom ⇒ deeper tile zoom; the visible region
    is culled so a pan asks for ~35–80 tiles, not the ~350 a whole frame would
    need at z16.
    **Not Leaflet, deliberately** — Leaflet brings its own pan/zoom,
    coordinate space and DOM, and the whole territory system (hatch canvas,
    beacons, derived company labels, replay animation, both exporters) is built
    on one flat cell grid over one rectangle. Adopting Leaflet means rewriting
    every one of those. What it would actually contribute here is "fetch XYZ
    tiles and place them", which is ~60 lines given a Mercator frame.
  - ⚠️ **`map.image` is the FLOOR, not an alternative.** The committed
    `singleton.webp` (Sentinel-2, 10 m) renders *underneath* the tiles: it is
    what shows before they load and all that shows if they never do — no signal
    on camp, or the service moves. A wrong or dead tile URL therefore degrades
    to the old static map, never to a blank one. `TileBase` also gives up after
    8 consecutive failures with nothing successful, and hides a failed tile
    inline (a broken `<img>` otherwise paints a placeholder box over the
    fallback). **The SIX Maps endpoint has never been reached from a dev
    sandbox** — egress blocks it — so it is verified only by construction plus
    a local tile pyramid; if imagery never appears live, suspect the URL first.
  - ⚠️ **THIS IS NOT A SLIPPY MAP: ONE FIXED TILE LEVEL, FETCHED ONCE.**
    `fixedTiles()` in maps.js picks a single zoom from the map alone — never
    from the view — and `TileBase` renders that set and never re-requests. The
    obvious design (a deeper level per zoom step) was the defect: each step
    swapped the imagery on screen, so zooming flickered, and until the new
    level arrived the map fell back to the 10 m static still. Two attempts to
    smooth that over (hiding tiles until decoded, then holding the previous
    level underneath the incoming one) each made it less bad without making it
    right, because the swapping should not have been happening. What the map
    needs is ONE swap — static art to real imagery — after which the browser
    scales it under PixelMap's transform exactly as the static image always
    did. Don't reintroduce level-switching. Verified: z16, 132 tiles, identical
    before, during and after a zoom step, and a pan costs no requests at all.
    The level is whatever `FIXED_MAX_TILES` (160) affords over the map's
    `focus` region — Singleton lands on z16 over Sector 8, ~2 m/px against the
    static image's ~12.
  - **Boundaries are VECTORS, not baked into the art**
    ([mapLines.js](src/lib/mapLines.js) + [MapLines.jsx](src/components/MapLines.jsx)):
    the Commonwealth land boundary and the Sector 8/9 line (both yellow),
    traced off the AUSPEC0196 sheet into
    `src/data/singleton-boundaries.json` as grid-cell vertices.
    ⚠️ **Only SECTOR 8's boundary is drawn.** The traced Commonwealth boundary
    wraps the whole sheet, because that is what the survey sheet shows; this map
    is Sector 8's, so `clipToSector()` drops every run that strays east of the
    sector line and interpolates the cut ONTO that line, leaving one closed
    shape instead of Sector 8's border plus a big empty enclosure beside it.
    ⚠️ **Vertices are CELL COORDINATES and the JSON records the grid they were
    traced in**; `mapLines(map)` scales them to whatever grid the map declares
    now, which is what let the territory grid be refined without re-tracing.
    Pass the map RECORD, not an id, or you get unscaled vertices. They moved out
    of the image for two reasons — tiles render *over* the image and would bury
    them, and as vectors they stay hairline at any zoom instead of becoming a
    40px smear. `mapLines.js` is the single source for **three** renderers: the
    SVG overlay, `drawMapLines()` in the exporters, and `LINE_KEY` (consumed as
    the map's `artKey`), so the key cannot describe a colour nothing draws.
    Tracing is [trace-singleton-boundaries.py](tools/map/trace-singleton-boundaries.py):
    a coarse seed list read off the sheet is snapped to boundary ink and joined
    by a LEAST-COST PATH, so the line follows the printed one exactly and only
    straight-lines across gaps; it traces in the sheet's MGA frame and
    reprojects to the map frame as its last step. Vertices are committed, so a
    rebuild needs no PDF.
    ⚠️ An earlier attempt drew the sheet's whole EXTRACTED ROAD NETWORK over
    the imagery. Don't reinstate it: it breaks up wherever contours crowd,
    which blended into flat pixel art but reads as dirt on the lens over
    satellite — and the imagery shows the roads anyway.
  - The base imagery is built by
    [tools/map/build-singleton-map.py](tools/map/build-singleton-map.py) from
    Copernicus **Sentinel-2** on the AWS Open Data registry (attribute as
    "Contains modified Copernicus Sentinel data"), reprojected onto the
    Mercator frame and given ONE display stretch. **WebP, not PNG** (1.4 MB →
    340 KB). [derive-singleton-map.py](tools/map/derive-singleton-map.py) — the
    old path that redrew the sheet as flat pixel art — no longer builds this
    map but is kept: it documents how the sheet's legend ink colours separate
    (roads print pink, contours brown — `G-B` separates them; "warmth" does
    not), which is what the tracer's thresholds rest on, and the tracer imports
    its sheet loader.
    `Ex Admin Area` is the RHQ location, and this is the one map seeded with
    `showRHQ: true`.
  - **Camp ZONES are a third vector layer** ([mapZones.js](src/lib/mapZones.js)
    + [MapZones.jsx](src/components/MapZones.jsx)), under the territory hatch
    and distinct from both territory (ground held) and map lines
    (administrative boundaries). A zone is the unit of PROGRESS — "Alpha has
    been through the ropes course" is a fact about a zone, not about a cell.
    Singleton carries 28: 15 activity areas, 6 night locations, 7 HQ.
    - ⚠️ **Zone vertices are CELL COORDINATES against the grid the importer
      wrote them in** (recorded in the JSON). `zonesFor(map)` scales them to the
      map's current grid — pass the map RECORD, not an id, or a finer grid puts
      every zone in the top-left quarter of the map.
    - **Geometry is code, visibility is content.** Outlines are converted from
      the unit's BIV26 Google Earth project by
      [kml-to-zones.py](tools/map/kml-to-zones.py) into
      `src/data/singleton-zones.json` and committed — the camp plan changes
      once a year, which is a repo change. What is SHOWN is RHQ's call during a
      camp, so it lives in a per-map `zoneVisibility` slice
      (`zoneVisibilitySlice()` in maps.js, folded into `SINGLE_SLICES` by
      `mapSlices()`, so no rules change). **A missing slice shows everything** —
      committing zones is enough to get them on the map; RHQ only touches the
      panel to take something off. Controlled in Ops Centre → Map: Territory →
      ZONES (per zone, per kind, or a master toggle).
    - The importer pairs each zone's polygon with its label point **by
      containment, not by name**, because Earth's two names often differ
      ("Regimental Headquarters" polygon vs "RHQ" point; "NightLoc Ropes" vs
      "NL Ropes"). It deliberately skips the project's `Archive` and
      `2021 NLs` folders, and its `Borders` folder — the traced survey-sheet
      boundaries are better, though the two agree closely, which is a useful
      cross-check on both.
    - ⚠️ **Some camp ground is smaller than one grid cell.** The eating areas
      and field kitchen are ~20 m across against a 59 m cell, so they are
      stored with no outline and render as a dot plus a name that only appears
      past `DETAIL_LABEL_ZOOM`. Don't "fix" them into polygons; the grid cannot
      express them, and at 1x their names land on top of each other and RHQ's.
  - **The CAMP PLAN drives zone progress** ([campPlan.js](src/lib/campPlan.js),
    data in `src/data/singleton-schedule.json`, converted from the unit's plan
    workbook by [xlsx-to-schedule.py](tools/map/xlsx-to-schedule.py)). 86 visits
    across 22 zones, 11 sessions, 4 camp days (Day 1 SUN 20SEP – Day 4 WED
    23SEP; Days −1/0 are advance party).
    - **Progress is DERIVED, never recorded.** The whole plan is settled before
      camp, so the map needs one number — how far through we are — and computes
      everything else. `zoneProgress(mapId, throughDay, company?)` gives each
      zone its scheduled companies, who has been as at that day, and a
      percentage. There is deliberately no live ticking workflow.
    - ⚠️ **ONE MAP, AND IT IS THE UNIT'S** (2026-09-14 — this REVERSES the
      per-company view added earlier the same day; don't reinstate it). There
      is no company toggle, no per-company mask and no `company` argument on
      `zoneProgress`/`overallProgress`. The boot-gate company still exists — it
      scopes INTEL, not the map.
    - ⚠️ **PROGRESS IS COUNTED IN VISITS, NOT COMPANIES** (2026-09-14, second
      pass). A company is often booked into the same area more than once —
      NAVEX takes 13 visits across camp, AA Juliet 8 — so counting distinct
      companies said a zone was a third done after one of three had been,
      which flattered day one and stalled the last. `zoneProgress` returns
      `{ visits, done, total, pct, complete, companies, visited }`; a zone is
      finished on its LAST scheduled visit, not its last new company.
    - ⚠️ **GROUND IS TAKEN IN PIXELS, NOT IN A GRADIENT** (this REPLACED an
      OKLab red→blue colour ramp the same day; don't reinstate it). A zone
      visited 2 of its 13 scheduled times has **2/13 of its CELLS painted**, in
      the ordinary territory hatch — the map already has a language for held
      ground, and a zone half taken should look half taken rather than a
      different hue. Cells are allocated in CONQUEST ORDER
      (`zoneCellsOrdered` in zoneRaster.js — sorted by distance out from the
      zone's label point), so ground grows from the middle and is identical
      every render instead of flickering between frames; `visitSlice()` gives
      visit *i* a contiguous slice, and the slices tile the zone exactly so the
      last visit always finishes it. ⚠️ **No company ever OWNS an activity
      area**: the taken share is painted light `t` (1ATF, "newly gained") and
      the whole zone flips to solid `T` on the final visit. Painting each visit
      in its own company's colour (which this did briefly) made a busy area a
      patchwork that read as six companies competing for the same ground.
      Companies still do the conquering — the plan says who is where and the
      visit counts come from it — but an area is a PERCENTAGE TAKEOVER by the
      task force, not a prize one company holds. RHQ can still hand-paint
      company ground anywhere else on the map.
    - **The zone overlay therefore shows KIND, not progress** (`ZONE_TEXTURE`):
      teal activity / blue night location / amber headquarters, solid outline
      vs dashed for night locations, and a glyph on every name (▲ ☾ ◆) that
      survives greyscale and colour-blindness. The only progress it prints is
      the visit count (`2/13`), which is the same fact the painted cells show.
    - ⚠️ The converter **refuses to guess**: a cell that is not a recognisable
      company is reported by name and skipped, never silently dropped, and the
      run always prints what it ignored. The sheet legitimately contains
      "Off Limits" and "RECSPECS". It also carries the sheet's own typos
      ("Ssupport") and name mismatches ("Juliett" → `aa-juliet`; the sheet's
      "Ropes" ACTIVITY is `high-ropes`, a different place from its `nl-ropes`
      night location) as an explicit mapping rather than fuzzy matching.
  - **The replay is GENERATED from the plan**, not painted
    ([campFrames.js](src/lib/campFrames.js), rasterised by
    [zoneRaster.js](src/lib/zoneRaster.js)): Ops Centre → Map: Territory →
    Campaign replay → **⚙ Build N Frames from Camp Plan** writes one frame per
    camp day plus a camp-start frame. They are ordinary frames afterwards, so
    RHQ can repaint or delete any of them.
    - **First company in owns it WHILE the rest are still to come; once every
      scheduled company has been, the zone is 1ATF's** — its own owner code
      `T` (`TASKFORCE_CODE` in territory.js, assure-blue, labelled `1ATF`),
      not RHQ's `R`. Later companies pass through without the ground changing
      hands between companies, because a map that churns between friendly
      companies reads as confusion. The zone percentage is ALWAYS unit-wide,
      in the company view too: three companies booked onto the ropes course
      means one through reads 33% wherever it is shown.
    - **Held-ness reuses the grid's light/solid convention**: lowercase while
      some scheduled company still has to come, uppercase once all have. No new
      cell codes.
    - ⚠️ **The replay owns the camp day.** Generated frames carry a `day`, the
      committed frame reports it up via `onFrame`, and CampControls shows a
      readout instead of its own day buttons. Before this the timeline and the
      day selector were rival clocks that could disagree on screen. Don't
      reintroduce a second day control while generated frames exist.
    - ⚠️ **Generated frames arrive HIDDEN** except the camp-start frame. Camp
      is painted in full before it starts, so publishing the lot would show
      cadets the last day on day one: each frame doc carries `hidden`,
      `releasedFrames()` in campaign.js filters the PUBLIC replay only, and
      Map: Territory gives each row **Reveal** / **Visible ✓** plus **Reveal
      to here** (reveals up to that frame and re-hides the rest, so the public
      timeline never has a gap). The Ops Centre always works on the full set.
  - A map may declare an **`artKey`** (+ `artKeyLabel`): what its own art
    carries under the territory hatch, rendered by
    [MapLegend.jsx](src/components/MapLegend.jsx) behind a `+ <artKeyLabel>`
    toggle next to the company key. Singleton's is the two boundary lines,
    labelled `BOUNDARIES`; NSW has none, and so shows no toggle. It is not
    hand-written: Singleton sets `artKey: LINE_KEY` from `lib/mapLines.js`, the
    same module that draws the lines, so the key can't drift from them.
  - **`imageFilter`**: the page draws every map through `IMAGE_FILTER`
    (`contrast(140%) sepia(60%) …` in `terrainRender.js`), which was written
    for flat pixel art and would crush satellite imagery to black and stain it
    one colour. A map whose art is photographic declares its own, gentler
    filter; `imageFilterFor(map)` in
    [terrainRender.js](src/lib/terrainRender.js) is the single accessor, used
    by both PixelMap and the exporters so page and video can't diverge.
- **Maps are code, not content.** New art has to be committed and its grid
  sized to it, so adding a map is a repo change: art in `public/map`, a record
  in `MAPS`, optionally a seed territory in `seed.js`. No rules change.
- **A territory object names its own map** (`territory.map`), so `PixelMap`,
  `CampaignReplayMap` and both exporters resolve art/aspect/grid via
  `mapFor(territory)` with no extra plumbing. `normalizeTerritory` in store.js
  stamps it onto pre-2026-09 data and re-seeds any territory whose cols/rows
  don't match its map.
- **`activeMap` is the DEFAULT map, not the only public one** (2026-09-13 —
  this REVERSES the earlier "the public sees exactly one map, there is
  deliberately no public switcher" rule; don't reinstate it), **but a
  non-default map is invisible until DISTRIBUTED** (2026-09-14): a per-map
  `mapRelease` slice, `isMapPublic()`/`publicMaps()` in maps.js, and
  **Distribute to the portal** / **Withdraw** in Ops Centre → Map: Territory.
  The default map is always public (a default nobody may open leaves Home
  with no map on it); every other map has no switch button and cannot be
  reached by a session override until RHQ distributes it. RHQ sets the
  default in Ops Centre → Map: Territory ("Make this the default map"), and a
  visitor lands on it. A **map switch under the map on Home** then lets them
  view any other map — one button per map that isn't on screen, so a third map
  needs no new UI.
  - That choice is **per device and per session**
    ([useViewedMap.js](src/hooks/useViewedMap.js), `sessionStorage`): no login,
    no write, nothing of RHQ's is touched. Session and not local storage is
    deliberate — a permanent override would make RHQ's default meaningless on
    that device forever, so the default has to reassert itself on the next
    visit. Choosing the default again CLEARS the override rather than pinning
    it, so the visitor returns to "whatever RHQ says". Every storage read is
    guarded (private mode throws; a stored id can name a map deleted in a
    deploy) and falls back to the default.
  - ⚠️ **A DISTRIBUTED map is fully public.** Editing it is not invisible —
    the Ops Centre copy distinguishes all three states (default / distributed
    / not distributed) and must keep doing so, because it is what tells RHQ
    whether what they save is public. Anything saved on the default map, or on
    any distributed map, can be seen by anyone.
  - The Staff Centre still shows only `activeMap`; it is an RHQ/staff overview
    of the live picture, not a browser.
  - *Which map you're editing* and *which map is the default* remain two
    separate controls in the ops editor. Editing state (painting, staged frame
    edits) is local to the map being edited and is discarded on switch, behind
    a confirm.
- **Palette constraint for any new PIXEL-ART map**: the default
  `IMAGE_FILTER` crushes anything below mid-grey to black and blows out
  anything much lighter, so a stylised tile has to sit inside a narrow mid-tone
  band; art that looks right at full size can block up solid in the app.
  Photographic art escapes that by declaring its own `imageFilter` (above), but
  then has to be judged THROUGH that filter, not at full strength. See
  [public/map/README.md](public/map/README.md).

## Territory / map system (`src/lib/territory.js`, `src/components/PixelMap.jsx`)
- A **cell grid** (each map's `cols`/`rows`) overlaid on its raster art. The
  grid is deliberately sized so each cell is an exact 3×3 block of source-image
  pixels — keep any future resolution divisible the same way so the grid stays
  pixel-aligned to the art. Each cell is a single character in a flat string:
  `.` empty, `A B C D E S` = the six companies, `M` = Meridian, `R` = RHQ (only
  rendered when `territory.showRHQ` is on). Lowercase = "lighter" variant
  (newly gained / loosely held). `TERR_COLS`/`TERR_ROWS`/`MAP_IMAGE`/
  `MAP_ASPECT` in `territory.js` are the PRIMARY map's values, derived from the
  registry and kept only for the code paths that predate multiple maps.
- Some maps have unpaintable ground: `src/lib/unpaintableMask.js`
  majority-samples a map's art per cell against its `blockFill` to build a
  shared `Uint8Array` mask, enforced in `MapEditor`'s paint handler and shown
  as a dark overlay in edit mode. On NSW that's the ocean; Singleton declares
  no blocked fill, so the mask is all-zero and the image is never even loaded.
- **Painting is incremental**: `PixelMap` diffs the grid against the last
  rasterised one and redraws only the dirty cell region; `renderTerritoryLayer`
  clips to it and its hatch-mask scratch canvas is sized to that region (the
  `source-in` mask is a global composite, so a full-map scratch made every
  stroke pay a full-resolution composite per colour — that was the brush lag).
  Full redraws on resize / large changes. Don't reintroduce a full-canvas
  scratch or a whole-grid redraw per pointer event.
- `PixelMap` renders the image (with a CSS filter for the intelligence-agency
  look) + a `<canvas>` overlay (tinted fills + a single neutral boundary
  outline per edge — deliberately not per-side coloured, since that
  previously let whichever neighbour rasterised later silently overwrite the
  other's line), `image-rendering: pixelated` throughout for a crisp
  pixel-art look. **Zoom is an explicit +/- button pair** (bottom-right,
  turquoise-on-translucent-grey, `ZoomControls` in PixelMap.jsx) — no wheel
  or pinch zoom (removed 2026-08-04; used to fight with page scroll and
  painting). `MAX_SCALE` is **8**, raised from 4 once a map could carry a live
  tile basemap: on a 10 m static image the extra steps only magnified pixels,
  but against tiles each step pulls a deeper zoom level. Two things follow from
  that ceiling and should not be undone — the territory canvas buffer follows
  the zoom (`CANVAS_DETAIL_MAX`, capped so it can't approach the browser's
  texture limit) so the hatch stays crisp, and **place beacons and company
  labels counter-scale by 1/zoom** so they hold their on-screen size instead of
  growing into banners across the map. Panning is still gesture-driven: one-finger/mouse drag pans in
  read-only mode once zoomed in; edit mode reserves one-finger/click for
  painting and uses two-finger touch or middle/right-mouse drag to pan
  instead, so painting and navigating never fight over the same gesture.
  Read-only by default; pass `edit`/`brush`/`brushSize`/`onPaint` to enable
  painting, `onMovePlace` to drag place-name labels, `oceanMask` to
  block/shade unpaintable cells while editing.
- **Place-label markers own their own positioning** ([Beacon.jsx](src/components/Beacon.jsx)):
  the dot is pinned to `(x, y)` via its own transform, and the name/tag flow
  right from a separately-positioned span. Don't go back to centring dot +
  name + tag as one flex row — that makes the dot's apparent position drift
  depending on the label text length instead of staying on the real point.
- Authored entirely in-app via **Operations Centre → Map: Territory**
  ([MapEditor.jsx](src/pages/ops/MapEditor.jsx)) — pick a colour swatch (solid
  or light variant), paint with a sized brush, add/drag/rename place labels,
  toggle RHQ visibility. There is no code-level territory editing path.
- ⚠️ **Modals must be portalled**: `.app-rail` (sticky) and the mobile drawer
  (fixed) create stacking contexts, so a `position: fixed` modal mounted
  inside the nav gets trapped under page content whatever its z-index.
  LoginModal / ConfirmDialog render via `createPortal(..., document.body)` —
  keep it that way for any new overlay.
- **Place beacons / occupancy**: `territory.places` entries are the map's
  named "zones", labelled unit-style ("A-COY" via `coyLabelOf()`, shared with
  the replay's conquest flashes). [Beacon.jsx](src/components/Beacon.jsx) (the ping-ring
  marker, extracted out of PixelMap) renders each one, coloured by the
  **majority owner of the surrounding cells** (`occupierAt`/`beaconStateFor`
  in territory.js) so occupancy is legible statically, not just during the
  conquest animation. A place flagged `hostile` (the editor's "Meridian
  stronghold" tick) that sits on 1ATF-held ground flips to the assure-blue
  **1ATF** recaptured state (`ASSURE_BLUE`/`SCU_LABEL` in territory.js — one
  constant restyles/relabels them all).
  All derived at render time, so it tracks replays frame-by-frame with no
  reload.
- **Company name labels & map key** (2026-08-04): the grid has no zone
  entities, so each company's name is PLACED BY DERIVATION every render —
  [src/lib/companyLabels.js](src/lib/companyLabels.js) takes the owner's
  largest connected component and puts the label at its **pole of
  inaccessibility** (deepest cell by BFS inward from the component's
  boundary). Don't swap this for a mean-of-coordinates centroid: that lands
  outside concave / ring / split holdings, which is the normal case here.
  Holdings under `MIN_LABEL_CELLS` get no name, and the chosen cell is kept
  clear of named places (`avoid`) — a place beacon already prints the same
  owner tag beside its name, so an overlap just says it twice. **One label per
  owner, not per region**, and a fixed type size: a 2026-08-03 branch labelled
  every contiguous region and scaled the text to the room available; that was
  deliberately not merged (too busy, and the resizing read as inconsistent). Rendered as DOM (`.company-label`)
  on screen and via `drawCompanyLabels()` on canvas for the exports.
  Shown on the public map, the Staff Centre map and both exports, and
  deliberately **off in the ops Map: Territory editor** (`showCompanyLabels`
  prop on PixelMap, default false) — a label over cells you're painting is in
  the way. The **map key** ([MapLegend.jsx](src/components/MapLegend.jsx) /
  `drawLegend()`) draws its swatches with the SAME cached hatch pattern the
  territory layer fills with, via `renderHatchSwatch()` — one renderer for page
  and exports so they can't drift. The key is **static**: `legendCodes()`
  returns the full fixed roster, NOT whoever currently holds ground, so it
  never reshuffles or drops rows as the replay animates. RHQ is the one
  conditional entry (hidden when `showRHQ` is off, since it isn't drawn then).
  Manually-dragged label positions (`territory.labelOverrides`, set via
  MapEditor's "Arrange company labels manually") are **one global set of
  coordinates, not one per frame** — deliberately, per "No need to add more
  than one storage". Whether a given campaign frame actually USES them is a
  separate per-frame flag, `campaignFrames[].useLabelOverrides` (2026-09-08,
  a "Manual labels" checkbox on each frame row in Map: Territory's Campaign
  replay panel; see `frameUsesLabelOverrides()` in
  [src/lib/campaign.js](src/lib/campaign.js) and `CampaignReplayMap.jsx`,
  which zeroes out `labelOverrides` for any committed frame that hasn't
  opted in). Unchecked (the default) — a frame always places labels
  automatically. Before this flag existed, dragging a label into place bled
  into every frame of the public replay, not just the one it was fixed for.
- **Campaign replay** (v2.3, 2026-08-04; v2.4, 2026-08-17; per-map 2026-09-12):
  every frame is its OWN Firestore document in the `campaignFrames` collection —
  `{ id, order, cells, label, map, ts, updatedAt }`, a full grid snapshot, not a
  diff against the previous frame (that was v2.2's design; see CHANGELOG for
  why it was replaced). In **Map: Territory**'s "Campaign replay" panel:
  **+ Add Frame from Live Map** snapshots the current painting onto the end
  of the timeline (the first frame added becomes the start; there's no
  separate "select start state" step anymore). Each frame row supports
  **Edit** (loads that frame's cells into the SAME paint canvas used for the
  live map — a banner above it makes clear you're editing a historical frame,
  not the live one), an inline **label** field (commits on blur/Enter),
  **↑/↓** reorder, **Duplicate** (inserts a copy right after — the way to add
  a step mid-sequence), and **Delete**.
  `order` is kept contiguous 0..N-1 by `renumberFrames()`, reassigned on every
  structural change. Because frames don't chain, editing frame 0 no longer
  wipes anything after it — that was only ever a limitation of the old
  diff-chain. Each row also has **Set as Default Start**, which writes the
  frame's id to that map's single-value `campaignDefaultStart` slice (`null` =
  "earliest frame", the original behaviour) — this is where the PUBLIC
  replay's auto-play begins; frames before it are untouched, just skipped by
  the automatic playback, and stay reachable through the picker described
  below. [src/lib/campaign.js](src/lib/campaign.js) holds only pure helpers
  over a frames array (`sortFrames`, `framesValid`, `frameCells`,
  `frameCaptions`, `renumberFrames`) plus the animation math
  (`transitionPlan`/`transitionDuration`, unchanged).
  ⚠️ **v2.4 (2026-08-17): repainting a frame no longer publishes on
  "Update Frame".** That button now only stages the paint job in local
  component state (`draftFrameCells`, keyed by frame id) — every OTHER action
  (relabel/reorder/duplicate/delete/Set Default Start) still writes straight
  to Firestore instantly, unchanged. Staged frames show an **● UNPUBLISHED**
  tag on their row, and a banner with a **Publish frame changes** button
  appears whenever any are pending — that's the one action that actually
  pushes staged cells to the live `campaignFrames` collection (one write for
  all pending frames). Re-opening **Edit** on a staged frame resumes from the
  staged paint, not the last-published version. Deleting a frame or clearing
  the whole replay also drops any of its pending staged cells. This mirrors
  how "Save map" already worked for the live territory — painting is local
  until an explicit publish action.
  The Home map renders through
  [CampaignReplayMap](src/components/CampaignReplayMap.jsx): an auto-playing
  conquest animation (per-owner BFS wave on a cheap flat-tint overlay; the
  expensive hatch layer commits once per frame) starting from the default
  frame, company-name flashes at each captured cluster, resting on the **last
  recorded frame**. ⚠️ **v2.4 also removed the old "live drift" synthetic
  frame**: earlier, if the live `territory` differed from the last recorded
  frame, `CampaignReplayMap` silently appended it as an extra, unlabelled
  "Current state" bubble on the public rail — a real-looking frame that
  wasn't actually a `campaignFrames` doc, so it couldn't be seen, relabelled
  or deleted from the Map: Territory panel. Once any frames exist, the live
  territory is now purely the starting point for the *next* frame — it never
  appears in the public replay on its own. Map: Territory shows a **"Live map
  has changed since the last recorded frame"** notice (with its own
  **+ Add Frame from Live Map** button) whenever `state.territory.cells`
  differs from the last frame, so that drift is always a deliberate,
  visible RHQ action, never invisible magic. Don't reintroduce the
  auto-append — see CHANGELOG 2026-08-17 for the reasoning.
  The transport (rewritten 2026-08-04) is a **▶ PLAY button plus a
  timeline rail with one bubble per frame** — hover names the frame, click cuts
  straight to it (an instant swap, never an animated replay of everything in
  between), and the rail fills as playback advances. **Playback does not
  pause**, and **PLAY resumes from the frame on screen** — click a bubble then
  PLAY and it continues from there; only pressing PLAY while already at the
  last frame restarts from the default start frame. A bubble click mid-play
  snaps there and stops. This replaced the old play/pause + skip buttons, progress
  bar and "Jump to a frame…" dropdown — don't reintroduce them. Frames before
  the default start stay on the rail and stay clickable; they're just skipped
  by the automatic playback. No frames → plain static PixelMap, exactly as
  before.
  The hatch renderer lives in
  [src/lib/terrainRender.js](src/lib/terrainRender.js), shared with two
  exports in [src/lib/replayExport.js](src/lib/replayExport.js):
  ⚠️ Both exports render through the map's **live tiles** where it has them:
  `renderBaseMap()` is async and composites XYZ tiles over `map.image` at
  export resolution, then applies the map's filter in ONE 1:1 pass (the
  no-resample rule below still holds) — the same single-filter-over-both
  arrangement the live page uses. Tiles load `crossOrigin='anonymous'` so a
  server without CORS fails cleanly to the static art rather than tainting the
  canvas and throwing at the end of a long export; capped at 400 tiles.
  Without this an export of the Regional map rendered the Sentinel-2 FLOOR
  upscaled 3x, which is why it looked coarse beside the live map.
  **Export Campaign Replay** (offscreen re-render recorded in real time via
  MediaRecorder to MP4, WebM on browsers that can't mux MP4 — 1944×1008,
  20 Mbps: hatch fills are fine high-contrast repeating lines, exactly what
  video codecs blur worst, so this needs to run well above a typical
  screen-recording bitrate to stay sharp; it also **pauses the recorder while
  the tab is hidden**, since `requestAnimationFrame` halts in a backgrounded
  tab and the frozen canvas was producing intermittent 0-byte files, and it
  errors loudly rather than downloading an empty blob) and **Export Weekly
  Update Image** (a still PNG of the current state + place names + whatever
  changed in the last 7 days highlighted as a settled wave overlay, with ONE
  merged name per company that gained ground — not the video's per-cluster
  flashes, which stacked the same names all over the map — under an RHQ-
  editable headline; disabled when nothing was recorded in that window). Its
  "before" state is the last frame before the cutoff, or the campaign's start
  frame — never a blank grid, which used to make the entire campaign count as
  one week's progress. Both share `renderBaseMap()`, which
  applies the map art's CSS-style filter at native resolution FIRST and only
  then upscales with smoothing off — applying the filter during the scaled
  draw (the original approach) silently re-enabled smoothing in some
  browsers' filter raster path regardless of `imageSmoothingEnabled`, which
  was the source of blurry exported video/images; don't recombine those two
  steps. Frames whose length doesn't match the current grid are dropped
  wholesale on load (`normalizeCampaignFrames` in store.js), like `territory`.
  `campaignFrames` needs its own `firestore.rules` block (it's a top-level
  collection, not a `content/*` slice — public read, RHQ write, same shape as
  the others); `campaignDefaultStart` is a normal `SINGLE_SLICES` entry so
  it's already covered by the generic `content/*` rule.
- **PDF export** ([src/lib/framesPdf.js](src/lib/framesPdf.js), the
  `🖨 Export N Frames as PDF` button in Map: Territory → Campaign replay): one
  **A3-landscape** page per frame at 150 dpi, cropped to the map's `focus` box
  so print shows what the screen shows. These are WALL SHEETS read from across
  a room, which sets every decision below.
  - **The map BLEEDS to the page edge** — no margin, no panel border, no gap —
    with one header line above it and the key beside it. A framed map on a wall
    sheet wastes the millimetres that decide whether an area is legible from
    across a room, and a border draws the eye to the edge of the paper instead
    of to the ground. The footer credits sit in the key column, since there is
    no margin left to put them in.
  - ⚠️ **THE EXPORT NEEDS CORS AND THE SCREEN DOES NOT** — the one way a print
    can come out worse than the page it came from. Displaying a cross-origin
    tile needs no permission; READING one back out of a canvas does, which is
    what `crossOrigin='anonymous'` asks for. A tile service that doesn't answer
    with `Access-Control-Allow-Origin` fails the load in the exporter while
    still displaying perfectly on the live map, so the print silently drops to
    the ~12 m static base. There is NO client-side workaround (`fetch` is
    blocked the same way; an opaque response has no readable bytes), so instead
    `exportFramesPdf` REPORTS what it got (`tiles: { tiled, drawn, total, z }`)
    and Map: Territory says so outright when a print came from the offline
    base. If that message appears, the fix is a tile source that sends the
    header — not a change in this code.
  - ⚠️ **Areas are NUMBERED on the map, named in a table beside it.** Printing
    each area's name, count and company letters on the map itself was tried and
    is unreadable: two dozen labels at a size legible from two metres collide
    into a mat, and shrinking them to fit defeats printing A3 at all.
    `drawMapZones(..., { numbered })` draws a badge per area; `drawAreaTable()`
    spells them out. Numbering is stable across all five sheets, so they can be
    compared area by area.
  - **Companies are named even though they own nothing.** The ground is 1ATF's
    — an area is a percentage takeover — but "has my company done the ropes
    course yet" is the question these sheets get asked, so every row carries the
    letters of the companies through it so far in their own colours.
    Attribution without ownership.
  - **Each sheet says what changed THAT DAY**: ground held on this frame and
    not the one before is outlined in `GAIN` on the map (`drawGains`, an outline
    over a light wash — a solid fill would hide the hatch and stop the sheet
    saying who holds the ground), and its table row is highlighted. Without
    this, five cumulative sheets look nearly alike.
  - A progress block totals off the same per-zone counts the map is drawn from,
    so the headline can't disagree with the ground.
  - ⚠️ **Print tiles are fetched for the CROPPED REGION ONLY**, and that is
    what makes the print sharp. The tile budget (`MAX_EXPORT_TILES`, 400) is
    what picks the zoom level, so spending it on the whole frame when the page
    only prints the focus box — about a third of the frame's area — cost two
    levels of detail in the part that actually prints. `renderTileLayer` now
    takes a `region` (0..1 frame fractions) and climbs zoom while the budget
    allows. Measured against a stand-in tile server: z15 over the whole frame
    before, **z16 over the region after — 132 tiles, ~2.0 m/px** in the printed
    area, i.e. twice the linear resolution for fewer requests. The map panel is
    also rendered at `SUPERSAMPLE` (2×) and drawn down, so the crop lands on the
    page already resolved instead of being upscaled into it.
  - **No PDF dependency, deliberately.** A PDF whose every page is one
    full-page JPEG is small and well specified — catalog → pages → per page a
    content stream drawing one `DCTDecode` image XObject (the canvas's JPEG
    bytes verbatim). That is ~80 lines against ~300 KB of library, and it
    renders through `renderPrintBase()` — the same base renderer the video and
    the weekly still use — so a printed page cannot drift from the screen. The
    trade is that page text is part of the image rather than selectable, which
    is why everything is drawn at print resolution.
  - Canvas has no letter-spacing in every browser this must run in, so the
    portal's wide heading tracking is drawn glyph by glyph (`textLine`).
- Changing grid resolution means updating `TERR_COLS`/`TERR_ROWS` **and** the
  seed's `territory.cells` string together (length must equal `cols * rows`).
- Always reference `MAP_IMAGE` via `import.meta.env.BASE_URL` (as
  `territory.js` already does) — a hard-coded `/map/...` path breaks once
  deployed under the GitHub Pages `/<repo>/` subpath.

## Operations Centre (`/operations-centre`, RHQ-only)
Side-rail sections (see `SECTIONS` in [OperationsCentre.jsx](src/pages/ops/OperationsCentre.jsx)):
Map: Narrative, Map: Territory, Intercepted Intelligence, **Approvals (COY
intel)**, Briefings, Welcome Page (Classified), Branding & Assets, Users, Help,
**Backups**, Audit Log. Every section edits exactly one data slice (or the
roster/support/`intelSubmissions` collections) via `updateSlice`/`replaceRoster`,
and most log an audit entry via `useAudit()`. **Approvals** is the RHQ side of
the Company Commander workflow (see "Company Commander & intel approval" above).
**Map: Territory** is the exception to "one section, one slice": it edits one
map at a time and writes that map's own slices — see "Maps" above.

### Backups / version history (2026-08-05)
[src/lib/backups.js](src/lib/backups.js) + the **Backups** section
([BackupsPanel.jsx](src/pages/ops/BackupsPanel.jsx)).
- **Capture is automatic and has ONE hook**: `DataContext.updateSlice` files the
  value it is about to overwrite into the `backups` collection before writing
  the new one. Every editor already saves through `updateSlice`, so nothing per
  editor is needed — and a new editor gets history for free.
- Skipped when the value is unchanged (repeated Saves don't pile up duplicates),
  when it's `undefined`, or when it exceeds `MAX_BACKUP_BYTES` (600 KB, well
  under Firestore's 1 MiB doc limit). `recordBackup` **never throws** — a failed
  backup must not be what stops RHQ saving.
- `BACKUP_KEEP` = 20 versions per slice; `prune()` drops the rest on each write.
- **Queries deliberately use a single field at a time.** `where('slice','==',…)`
  plus `orderBy('ts')` would need a hand-made composite index in the console,
  and this project's standing problem is console steps nobody performs — so
  slice filtering and sorting happen client-side over a capped, small set.
- **NOT versioned, on purpose**: `roster` (the one collection with personal
  data — copying it per edit multiplies the exposure for no gain) and
  `campaignFrames` (already an explicit editable history, and the whole set
  would approach the 1 MiB doc limit). Both are stated in the panel's own copy.
- **Restore is an ordinary `updateSlice`**, so it backs up what it replaces —
  an undo of the undo is always there.
- `staffAccess` IS versioned, and that's safe precisely because `backups` is
  RHQ-read-only under the rules, unlike world-readable `content/*`.
- "Download everything" writes a single JSON of all current slices +
  `campaignFrames` (`buildFullExport`) — the off-platform copy, for when the
  Firebase project itself is the thing that's gone.
- ⚠️ The `backups` rules block needs the pending republish. Until then the
  panel's list read fails (it says so, naming HANDOVER §0); writes fail silently
  by design, so nothing else breaks.

### Briefing video upload (Firebase Storage)
The Briefings editor's video field is a **drag-and-drop zone**
([VideoDropZone.jsx](src/components/VideoDropZone.jsx)) sitting above the
link input — drag a file in, click to browse, or drop/paste a URL. Files upload
to Firebase Storage via [src/lib/videoUpload.js](src/lib/videoUpload.js).

- This is the **only** thing in the app that uses Storage; everything else
  (logo, map art) is a repo file under `public/`. Don't broaden that without
  adding a named prefix to [storage.rules](storage.rules).
- Path `briefings/<timestamp>-<filename>`, 512 MB cap (`MAX_VIDEO_BYTES`,
  mirrored in the rules — change both). Non-MP4/WebM warns but uploads.
- **Keep the link field.** Uploads need Storage enabled + rules published, and
  a YouTube link costs the unit no bandwidth — it's the right answer for
  anything long, and the fallback when Storage isn't available.
- `briefings.videoPath` records the object path for an uploaded video (empty
  for a link). The editor deletes only uploads made **in the current editing
  session** when they're replaced; the already-published object is left alone,
  since the user may close the tab without saving.
- ⚠️ **Two console actions, both still outstanding:** enable Storage for the
  project, then publish `storage.rules` (Storage → Rules). Until then uploads
  fail `storage/unauthorized`; the drop zone reports it and points at the link
  field, so nothing else breaks. Note Storage now needs the **Blaze** plan on
  projects created after Oct 2024.
- The text box takes a **link OR a full `<iframe …>` embed code** (Share →
  Embed). `resolveVideo()` in [VideoEmbed.jsx](src/components/VideoEmbed.jsx)
  handles both — see "Video resolution" below.

### Video resolution (`resolveVideo` in VideoEmbed.jsx)
One function turns whatever RHQ pasted into `{ type: 'iframe' | 'video' |
'link', src }`; `null` means unusable, so callers hide the box.
- Handles YouTube in every shape (watch, `youtu.be`, `/embed/`, `/shorts/`,
  `/live/`, `youtube-nocookie`), Google Drive `/file/d/<id>/view` → `/preview`
  (the `/view` page refuses to be framed), direct video files, and Storage
  uploads.
- **Vimeo** needs more than one rule: the unlisted `/<id>/<hash>` form must
  become `?h=<hash>` or the embed is refused; `/event/<id>` embeds as
  `/event/<id>/embed`, not as a player; and `manage/videos/<id>` (the dashboard
  URL), `channels/…`, `groups/…/videos/…` and `showcase/…/video/…` all bury the
  id at the END of the path, so it's taken as the last all-digits segment —
  after the leading-digits check, since an unlisted hash can itself be numeric.
  `/ondemand` is excluded on purpose (purchase page, no plain embed).
- **Storage URLs are matched by HOST, not extension** — the filename is inside
  the escaped `/o/...` path and an upload may have no extension. Don't
  "simplify" that back to a pathname regex.
- **The raw pasted string is what gets stored**, embed snippet and all, and is
  re-resolved at render. That preserves one signal: an embed code is RHQ saying
  "this is meant to be framed", which is what lets an *unrecognised* provider
  (SharePoint, Stream, Canva…) still embed instead of degrading to a link. We
  never inject the pasted HTML — only its `src` is read.
- ⚠️ **The scheme guard is load-bearing**: only `http:`/`https:`/`blob:` srcs
  are accepted. A `javascript:` or `data:` src in a pasted embed code would
  otherwise run in the page's origin. Don't drop that check when adding a
  provider.

### Users / spreadsheet import
Captures only **name, ID number, company, email** (fuzzy `COLUMN_HINTS` in
`src/pages/ops/UsersAdmin.jsx`). Company accepts a letter or phonetic name.
Import **merges**: existing IDs are kept unchanged, only new IDs are added.
Issues temp passwords; can download a temp-password sheet; supports search.

## Analytics (2026-08-10)
[src/lib/analytics.js](src/lib/analytics.js) + `PageViews` in
[src/App.jsx](src/App.jsx).
- **Off unless `VITE_GA_ID` is set**, and there is deliberately **no hard-coded
  fallback ID** (unlike the Firebase/EmailJS keys) — an analytics property is
  account-level and shouldn't be inherited by accident. Live value comes from a
  GitHub Actions **variable** (not a secret: a measurement ID is public by
  design), passed through in `deploy.yml`.
- **SPA page views are sent manually.** gtag counts only the first load, so
  `config` uses `send_page_view: false` and `PageViews` sends one per route
  change off `useLocation`. Without that the whole site reads as one view.
- **The query string is stripped** before sending — `?emulate=<company>` and
  anything else appended to a URL is unit business.
- ⚠️ **Configured for an audience of minors.** `allow_google_signals: false`
  and `allow_ad_personalization_signals: false` are what keep the privacy
  notice's "no profiling, no advertising" true. The browser's **Do Not Track**
  signal is honoured (GA does not do this by itself) — a deliberate choice for
  a youth org, and a one-line removal if RHQ decides otherwise.
- **If any of that changes, update the "Site analytics" section of
  [Privacy.jsx](src/pages/Privacy.jsx) in the same commit** — that notice is
  repo-versioned exactly so it can't drift from what the code does.

## Error reporting (`src/lib/errors.js`)
Every failure maps to an internal code (`ATF-NET/AUTH/CFG/DATA/INP/UNK-*`).
Genuine technical/system faults are auto-filed to the `support` collection and
emailed to RHQ via `notifyAdmin` (`DataContext.reportError`); ordinary
user-input errors (wrong password, etc.) are shown to the user but not
auto-reported, to avoid flooding the Help inbox. Reports raised while offline
are queued in localStorage and resent on next load (`stashPending`/
`flushPending` in `src/lib/store.js`).

## Design system
CSS custom properties + utility classes in [src/index.css](src/index.css):
`--accent` teal `#36e0c0`, `--hostile` red `#ff3b46`, dark navy background,
Orbitron (headings) / Rajdhani (body) / JetBrains Mono. Utility classes:
`panel`, `panel-pad`, `row`, `col`, `mono`, `head`, `accent`, `hostile`,
`ghost`, `primary`, `tag`. Styling is a mix of these classes and inline
styles — there is no CSS-in-JS or component library.

## Firebase setup checklist (console)
1. Authentication → enable **Email/Password**. Add the custom domain under
   **Settings → Authorized domains** or sign-ins fail there.
2. Firestore → create DB → publish [firestore.rules](firestore.rules).
   ⚠️ **STILL PENDING (user action):** the rules in the repo are current, but
   must be **re-published in the Firebase Console** to take effect live.
   Five changes are waiting on that republish: the `intelSubmissions` block
   (COY-intel approval workflow), the roster read lockdown (RHQ + own-record
   only), the `campaignFrames` collection block, the `intelStats` block (both
   2026-08-04 — see below), `isRHQStaff()` (2026-08-05 — without it RHQ
   Staff accounts cannot approve anything live), and the `backups` block
   (2026-08-05 — without it the Backups panel cannot list history). Until then, live Firebase still runs the
   older rules, so against the live project RHQ can't write campaign frames at
   all and every anonymous decrypt count is silently rejected (by design the
   write failure is swallowed, so the puzzle still works — the counts just
   stay at zero).
3. Storage → **enable the default bucket**, then publish
   [storage.rules](storage.rules) (Storage → Rules). ⚠️ **STILL PENDING (user
   action)** — needed only for the Briefings drag-and-drop video upload; until
   it's done, uploads fail and RHQ must paste a link as before. Everything
   else (logo, map image) is a repo file under `public/` and needs no bucket.
   Storage requires the **Blaze** plan on projects created after Oct 2024.

**Rules coverage** — every collection/doc the app touches has a block:
`content/*` (all `SINGLE_SLICES` — adding a slice, or a whole MAP, needs no
rules change; see "Maps" above),
`campaignFrames` (every map's frames share it), `roster`, `tasks`, `activity`, `users`, `support`,
`resetRequests`, `audit`, `authIndex`, `intelSubmissions`, `intelStats`,
`backups` (plus a narrower `content/intel` override for RHQ Staff);
everything else default-denies. The `content/*`/`roster`/`intelSubmissions`
blocks were
verified against the real rules engine via the `firebase-tools` Firestore
emulator + `@firebase/rules-unit-testing` in an earlier session (19 checks:
roster own-record vs others, tasks/activity RHQ-only, public-read/RHQ-write
content, COY submission scoping) — no committed test suite reproduces that
run, though. The `campaignFrames` block added 2026-08-04 mirrors that same
already-verified public-read/RHQ-write shape exactly, but hasn't itself been
run through the emulator — worth doing before relying on it for anything
sensitive. The **`intelStats`** block (also 2026-08-04) is the only one that
grants an unauthenticated caller a WRITE, so it is the one most worth running
through the emulator: it needs create to be rejected unless `solves == 1`,
update to be rejected unless it's exactly +1 with `company`/`fragmentId`
unchanged, and any extra field to be rejected outright. It relies on the rules
engine seeing `increment()` already resolved in `request.resource.data`, which
is documented behaviour but untested here.

## Handover
[HANDOVER.md](HANDOVER.md) is the standing "what's still outstanding" brief —
blockers, unverified work and the agreed-but-unbuilt roadmap. Read it after
this file and the CHANGELOG; update it as items land rather than letting it go
stale.

## Known privacy gaps / TODO (discussed, not yet done)
- ✅ **Fixed 2026-07-23**: `roster` reads are now RHQ **or own-record only**
  (via an `isOwnId()` email-pattern check in `firestore.rules`, no app changes
  needed); `tasks`/`activity` reads are now RHQ-only. See CHANGELOG for the
  emulator-verified test coverage. ⚠️ Still needs a **rules re-publish** in
  the Firebase Console to take effect live.
- ⚠️ Residual, deliberately unsolved by the above: an *unregistered* member who
  knows their own ID can still register and then read their own record's
  plain-text `tempPassword` via the same own-record path — inherent to storing
  temp passwords in plain text.
- ⚠️ Temp passwords are stored **plain text** in `roster`. Consider hashing and
  only revealing at generation/download time. (Would also close the residual
  gap above.)
- ✅ **Fixed 2026-07-29**: member-facing privacy notice now exists at
  `/privacy` (static page, footer-linked).

## Working constraints (important)
- Deploy branch is **`main`**; pushes there trigger the Pages build/deploy.
- ⚠️ **Deploy gotcha**: [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
  uses `concurrency: { group: pages, cancel-in-progress: true }` — rapid
  successive pushes **cancel each other's in-flight deploy**, so the live
  site can silently stay on an old build. Push one commit and let that run
  finish (check the Actions tab for conclusion = `success`, not `cancelled`)
  before pushing again.
- Do NOT put the model identifier or these notes' "Claude-Session" lines into
  anything beyond commit metadata as already configured.
- Before starting work, skim [CHANGELOG.md](CHANGELOG.md) for the latest
  entries so you know what the last session already touched.
