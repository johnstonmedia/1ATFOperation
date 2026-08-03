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
  see `useUnseen` below) + pixel territory map + **SMEAC operation brief**
  (`smeacOf()` in seed.js merges older stored narratives) + company roles +
  Meridian brief. Public nav is responsive: pinned left rail ≥768px,
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
  linked docs/images.
- `/briefings` **Briefings** — a video embed + free text, admin-edited.
- `/privacy` **Privacy Notice** — small static member-facing privacy policy
  ([src/pages/Privacy.jsx](src/pages/Privacy.jsx)), linked from the footer in
  [Layout.jsx](src/components/Layout.jsx). Deliberately repo-versioned, not an
  RHQ-editable slice.
- `/Classified` (and `/classified`) — the original standalone landing page
  cadets are sent to; "Continue" starts temp-password registration.
- `/operations-centre/*` — **RHQ-only** admin console (see below). URL-only,
  not linked from nav.
- `/company-command` — **Company Commander-only** "COY Centre"
  ([src/pages/CommanderPanel.jsx](src/pages/CommanderPanel.jsx)). URL-only;
  reached via the role-aware **COY CENTRE** button shown once a commander signs
  in. See "Company Commander & intel approval" below.

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
  and legacy **General** (`ROLES`/`COMMANDER_ROLE` in `src/firebase/seed.js`).
  Companies (phonetic letters): A Alpha, B Bravo, C Charlie, D Delta, E Echo,
  S Support. Meridian is the threat force (red on the map; code keeps
  `hostile` as an identifier — user-visible copy says "threat").

## Data model
- Firestore single-value docs under `content/{slice}`: `narrative`, `territory`,
  `classified`, `branding`, `companyPages`, `video`, `intel`, `intelIntro`,
  `briefings`, `campaign` (public read, RHQ write) — see `SINGLE_SLICES` in
  [src/lib/store.js](src/lib/store.js). `campaign` is the territory replay
  history: `{ start: { cells, ts }, timeline: [{ ts, diff }] }` with
  run-length diffs, managed by [src/lib/campaign.js](src/lib/campaign.js)
  (see "Campaign replay" below).
- Collections: `roster`, `tasks`, `activity`, `support`, `resetRequests`, `audit`
  — see `COLLECTION_SLICES` in the same file. Plus `intelSubmissions` (the
  Company Commander approval queue), managed directly via
  [src/lib/submissions.js](src/lib/submissions.js), not through `store.js`.
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
- **Place beacons / occupancy**: `territory.places` entries are the map's
  named "zones". [Beacon.jsx](src/components/Beacon.jsx) (the ping-ring
  marker, extracted out of PixelMap) renders each one, coloured by the
  **majority owner of the surrounding cells** (`occupierAt`/`beaconStateFor`
  in territory.js) so occupancy is legible statically, not just during the
  conquest animation. A place flagged `hostile` (the editor's "Meridian
  stronghold" tick) that sits on 1ATF-held ground flips to the assure-blue
  **SCU** recaptured state (`ASSURE_BLUE` — one constant restyles them all).
  All derived at render time, so it tracks replays frame-by-frame with no
  reload.
- **Campaign replay** (v2.2): RHQ presses **Select Start State** in the
  Map: Territory editor's "Campaign replay" panel, then explicitly presses
  **Record Progress Frame** to append each diff move to the `campaign` slice
  (**"Save map" does NOT record a frame** — that was the pre-2026-07-30
  behaviour); **Re-record Start State** overwrites the baseline and clears
  every frame
  ([src/lib/campaign.js](src/lib/campaign.js) — run-length diffs, oldest
  moves auto-fold into the start state near Firestore's doc-size cap). The
  Home map then renders through
  [CampaignReplayMap](src/components/CampaignReplayMap.jsx): an auto-playing
  conquest animation (per-owner BFS wave on a cheap flat-tint overlay; the
  expensive hatch layer commits once per move), company-name flashes at each
  captured cluster, play/pause/replay/skip controls, resting on the live
  state. No campaign → plain static PixelMap, exactly as before. The hatch
  renderer lives in [src/lib/terrainRender.js](src/lib/terrainRender.js),
  shared with **Export Campaign Replay**
  ([src/lib/replayExport.js](src/lib/replayExport.js)): offscreen re-render
  recorded in real time via MediaRecorder to MP4 (WebM on browsers that
  can't mux MP4). `campaign` is invalidated on grid-resolution change, like
  `territory`. No firestore.rules impact (it's a `content/*` slice).
- Changing grid resolution means updating `TERR_COLS`/`TERR_ROWS` **and** the
  seed's `territory.cells` string together (length must equal `cols * rows`).
- Always reference `MAP_IMAGE` via `import.meta.env.BASE_URL` (as
  `territory.js` already does) — a hard-coded `/map/...` path breaks once
  deployed under the GitHub Pages `/<repo>/` subpath.

## Operations Centre (`/operations-centre`, RHQ-only)
Side-rail sections (see `SECTIONS` in [OperationsCentre.jsx](src/pages/ops/OperationsCentre.jsx)):
Map: Narrative, Map: Territory, Intercepted Intelligence, **Approvals (COY
intel)**, Briefings, Welcome Page (Classified), Branding & Assets, Users, Help,
Audit Log. Every section edits exactly one data slice (or the
roster/support/`intelSubmissions` collections) via `updateSlice`/`replaceRoster`,
and most log an audit entry via `useAudit()`. **Approvals** is the RHQ side of
the Company Commander workflow (see "Company Commander & intel approval" above).

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
1. Authentication → enable **Email/Password**. Add the custom domain under
   **Settings → Authorized domains** or sign-ins fail there.
2. Firestore → create DB → publish [firestore.rules](firestore.rules).
   ⚠️ **STILL PENDING (user action):** the rules in the repo are current and
   emulator-verified, but must be **re-published in the Firebase Console** to
   take effect live. Two changes are waiting on that republish: the
   `intelSubmissions` block (COY-intel approval workflow) and the roster
   read lockdown (RHQ + own-record only). Until then, live Firebase still
   runs the older rules.
3. Storage is **not used** (logo and map image are repo files under `public/`).

**Rules coverage** — every collection/doc the app touches has a block:
`content/*` (all `SINGLE_SLICES`, incl. `campaign` — adding a slice needs no
rules change), `roster`, `tasks`, `activity`, `users`, `support`,
`resetRequests`, `audit`, `authIndex`, `intelSubmissions`; everything else
default-denies. Verified against the real rules engine via the `firebase-tools`
Firestore emulator + `@firebase/rules-unit-testing` (19 checks: roster
own-record vs others, tasks/activity RHQ-only, campaign public-read/RHQ-write,
COY submission scoping).

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
