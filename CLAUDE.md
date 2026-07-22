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
- Hosted on **GitHub Pages** via [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
  (builds with `VITE_BASE=/<repo>/`, deploys `dist/` on every push to **main**).
  Pages Source must be **GitHub Actions**.
- SPA deep links handled by `public/404.html` + a restore snippet in `index.html`.
- **Firebase is enabled by default** — real keys are hard-coded as fallback
  defaults in [src/firebase/config.js](src/firebase/config.js) (they're public
  by design; security is via Firestore rules). Set `VITE_FIREBASE_DISABLE=1` in
  a local `.env.local` to force LOCAL MODE (localStorage) for offline dev
  without touching production content.
- The repo's deploy branch is **`main`** (not a `claude/*` branch — update this
  note if that changes).

## App shape (current)
Three **public, no-login** tabs behind the main shell, plus two chrome-less
routes — see [src/App.jsx](src/App.jsx):
- `/` **Home** — hero + pixel territory map + 1ATF/Meridian brief tabs.
- `/intel` **Intel** — "Intercepted Intelligence": RHQ-wide fragments plus
  company-specific ones, gated only by a **company dropdown** (device-local
  preference, no auth — [CompanyContext](src/context/CompanyContext.jsx)).
  Fragments are decrypt-style puzzles (fill in redacted words) with optional
  linked docs/images.
- `/briefings` **Briefings** — a video embed + free text, admin-edited.
- `/Classified` (and `/classified`) — the original standalone landing page
  cadets are sent to; "Continue" starts temp-password registration.
- `/operations-centre/*` — **RHQ-only** admin console (see below). URL-only,
  not linked from nav.

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
- Roles: **RHQ** and **General**. Companies (phonetic letters): A Alpha,
  B Bravo, C Charlie, D Delta, E Echo, S Support. Meridian is the hostile force
  (red on the map).

## Data model
- Firestore single-value docs under `content/{slice}`: `narrative`, `territory`,
  `classified`, `branding`, `companyPages`, `video`, `intel`, `intelIntro`,
  `briefings` (public read, RHQ write) — see `SINGLE_SLICES` in
  [src/lib/store.js](src/lib/store.js).
- Collections: `roster`, `tasks`, `activity`, `support`, `resetRequests`, `audit`
  — see `COLLECTION_SLICES` in the same file.
- Data layer in `src/lib/store.js` (mode-agnostic: same async API over
  Firestore or localStorage). `DataContext` provides `updateSlice`,
  `replaceRoster`, `append`, `reportError`, `reload`, `logAudit`.
- Defaults/seed content in [src/firebase/seed.js](src/firebase/seed.js).

## Territory / map system (`src/lib/territory.js`, `src/components/PixelMap.jsx`)
- Fixed **216×112 cell grid** (`TERR_COLS`/`TERR_ROWS`) overlaid on a raster
  NSW image (`public/map/nsw-terrain.png`, 648×336, aspect `MAP_ASPECT` =
  `648/336`). The grid is deliberately sized so each cell is an exact 3×3
  block of source-image pixels — keep any future resolution change divisible
  the same way so the grid stays pixel-aligned to the art. Each cell is a
  single character in a flat string: `.` empty, `A B C D E S` = the six
  companies, `M` = Meridian, `R` = RHQ (only rendered when `territory.showRHQ`
  is on). Lowercase = "lighter" variant (newly gained / loosely held).
- Ocean tiles are unpaintable: `src/lib/oceanMask.js` majority-samples the
  source image per cell against the flat ocean fill (`OCEAN_COLOR` in
  `territory.js`, `#3c82b4`) to build a shared `Uint8Array` mask, enforced in
  `MapEditor`'s paint handler and shown as a dark overlay in edit mode.
- `PixelMap` renders the image (with a CSS filter for the intelligence-agency
  look) + a `<canvas>` overlay (tinted fills + a single neutral boundary
  outline per edge — deliberately not per-side coloured, since that
  previously let whichever neighbour rasterised later silently overwrite the
  other's line), `image-rendering: pixelated` throughout for a crisp
  pixel-art look. No scrollbar/zoom buttons — panning and zooming are
  gesture-driven (one-finger/mouse drag pans in read-only mode; pinch or
  wheel zooms everywhere; edit mode reserves one-finger/click for painting
  and uses two-finger touch or middle/right-mouse drag to pan instead, so
  painting and navigating never fight over the same gesture). Read-only by
  default; pass `edit`/`brush`/`brushSize`/`onPaint` to enable painting,
  `onMovePlace` to drag place-name labels, `oceanMask` to block/shade ocean
  cells while editing.
- Authored entirely in-app via **Operations Centre → Map: Territory**
  ([MapEditor.jsx](src/pages/ops/MapEditor.jsx)) — pick a colour swatch (solid
  or light variant), paint with a sized brush, add/drag/rename place labels,
  toggle RHQ visibility. There is no code-level territory editing path.
- Changing grid resolution means updating `TERR_COLS`/`TERR_ROWS` **and** the
  seed's `territory.cells` string together (length must equal `cols * rows`).
- Always reference `MAP_IMAGE` via `import.meta.env.BASE_URL` (as
  `territory.js` already does) — a hard-coded `/map/...` path breaks once
  deployed under the GitHub Pages `/<repo>/` subpath.

## Operations Centre (`/operations-centre`, RHQ-only)
Side-rail sections (see `SECTIONS` in [OperationsCentre.jsx](src/pages/ops/OperationsCentre.jsx)):
Map: Narrative, Map: Territory, Intercepted Intelligence, Briefings, Welcome
Page (Classified), Branding & Assets, Users, Help, Audit Log. Every section
edits exactly one data slice (or the roster/support collections) via
`updateSlice`/`replaceRoster`, and most log an audit entry via `useAudit()`.

### Users / spreadsheet import
Captures only **name, ID number, company, email** (fuzzy `COLUMN_HINTS` in
`src/pages/ops/UsersAdmin.jsx`). Company accepts a letter or phonetic name.
Import **merges**: existing IDs are kept unchanged, only new IDs are added.
Issues temp passwords; can download a temp-password sheet; supports search.

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
1. Authentication → enable **Email/Password**.
2. Firestore → create DB → publish [firestore.rules](firestore.rules).
3. Storage is **not used** (logo and map image are repo files under `public/`).

## Known privacy gaps / TODO (discussed, not yet done)
- ⚠️ `firestore.rules`: `roster`/`tasks`/`activity` are readable by **any
  signed-in member** (`isSignedIn()`), so a technical user could read all
  names/IDs/emails and the **plain-text temp passwords**. Tightening to
  RHQ-only needs a rework of temp-password registration (which currently reads
  the roster client-side to validate) — e.g. a minimal public claim-check or a
  Cloud Function.
- ⚠️ Temp passwords are stored **plain text** in `roster`. Consider hashing and
  only revealing at generation/download time.
- No member-facing privacy notice yet (relevant — likely minors in a cadet unit).

## Working constraints (important)
- Deploy branch is **`main`**; pushes there trigger the Pages build/deploy.
- Do NOT put the model identifier or these notes' "Claude-Session" lines into
  anything beyond commit metadata as already configured.
- Before starting work, skim [CHANGELOG.md](CHANGELOG.md) for the latest
  entries so you know what the last session already touched.
