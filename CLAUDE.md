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
- Firestore single-value docs under `content/{slice}`: `narrative`, `territory`,
  `classified`, `branding`, `companyPages`, `video`, `intel`, `intelIntro`,
  `briefings`, `campaignDefaultStart` (public read, RHQ write) — see
  `SINGLE_SLICES` in [src/lib/store.js](src/lib/store.js).
  `campaignDefaultStart` is just a frame id (or `null`) — see "Campaign
  replay" below.
- Collections: `roster`, `tasks`, `activity`, `support`, `resetRequests`,
  `audit`, `campaignFrames` — see `COLLECTION_SLICES` in the same file.
  `campaignFrames` is the territory replay history (see "Campaign replay"
  below): one document per frame, `{ order, cells, label, ts, updatedAt }` —
  each frame a full grid snapshot, not a diff, so RHQ can edit/reorder/
  duplicate/delete any single frame independently via
  [src/lib/campaign.js](src/lib/campaign.js)'s pure `sortFrames`/
  `framesValid`/`frameCells`/`frameCaptions`/`renumberFrames` helpers. Plus
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
  painting). Panning is still gesture-driven: one-finger/mouse drag pans in
  read-only mode once zoomed in; edit mode reserves one-finger/click for
  painting and uses two-finger touch or middle/right-mouse drag to pan
  instead, so painting and navigating never fight over the same gesture.
  Read-only by default; pass `edit`/`brush`/`brushSize`/`onPaint` to enable
  painting, `onMovePlace` to drag place-name labels, `oceanMask` to
  block/shade ocean cells while editing.
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
- **Campaign replay** (v2.3, 2026-08-04): every frame is its OWN Firestore
  document in the `campaignFrames` collection —
  `{ id, order, cells, label, ts, updatedAt }`, a full grid snapshot, not a
  diff against the previous frame (that was v2.2's design; see CHANGELOG for
  why it was replaced). In **Map: Territory**'s "Campaign replay" panel:
  **+ Add Frame from Live Map** snapshots the current painting onto the end
  of the timeline (the first frame added becomes the start; there's no
  separate "select start state" step anymore). Each frame row supports
  **Edit** (loads that frame's cells into the SAME paint canvas used for the
  live map — a banner above it makes clear you're editing a historical frame,
  not the live one; **Update Frame** saves back to just that frame, "Save
  map" still only ever publishes the live territory), an inline **label**
  field (commits on blur/Enter), **↑/↓** reorder, **Duplicate** (inserts a
  copy right after — the way to add a step mid-sequence), and **Delete**.
  `order` is kept contiguous 0..N-1 by `renumberFrames()`, reassigned on every
  structural change. Because frames don't chain, editing frame 0 no longer
  wipes anything after it — that was only ever a limitation of the old
  diff-chain. Each row also has **Set as Default Start**, which writes the
  frame's id to the single-value `campaignDefaultStart` slice (`null` =
  "earliest frame", the original behaviour) — this is where the PUBLIC
  replay's auto-play begins; frames before it are untouched, just skipped by
  the automatic playback, and stay reachable through the picker described
  below. [src/lib/campaign.js](src/lib/campaign.js) holds only pure helpers
  over a frames array (`sortFrames`, `framesValid`, `frameCells`,
  `frameCaptions`, `renumberFrames`) plus the animation math
  (`transitionPlan`/`transitionDuration`, unchanged).
  The Home map renders through
  [CampaignReplayMap](src/components/CampaignReplayMap.jsx): an auto-playing
  conquest animation (per-owner BFS wave on a cheap flat-tint overlay; the
  expensive hatch layer commits once per frame) starting from the default
  frame, company-name flashes at each captured cluster, resting on the live
  state. The transport (rewritten 2026-08-04) is a **▶ PLAY button plus a
  timeline rail with one bubble per frame** — hover names the frame, click cuts
  straight to it (an instant swap, never an animated replay of everything in
  between), and the rail fills as playback advances. **Playback does not
  pause**, and **PLAY resumes from the frame on screen** — click a bubble then
  PLAY and it continues from there; only pressing PLAY while already at the
  live state restarts from the default start frame. A bubble click mid-play
  snaps there and stops. This replaced the old play/pause + skip buttons, progress
  bar and "Jump to a frame…" dropdown — don't reintroduce them. Frames before
  the default start stay on the rail and stay clickable; they're just skipped
  by the automatic playback. No frames → plain static PixelMap, exactly as
  before.
  The hatch renderer lives in
  [src/lib/terrainRender.js](src/lib/terrainRender.js), shared with two
  exports in [src/lib/replayExport.js](src/lib/replayExport.js):
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
  `/live/`, `youtube-nocookie`), Vimeo (incl. the unlisted `/<id>/<hash>` form,
  which must become `?h=<hash>`), Google Drive `/file/d/<id>/view` → `/preview`
  (the `/view` page refuses to be framed), direct video files, and Storage
  uploads.
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
   2026-08-04 — see below), and `isRHQStaff()` (2026-08-05 — without it RHQ
   Staff accounts cannot approve anything live). Until then, live Firebase still runs the
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
`content/*` (all `SINGLE_SLICES` — adding a slice needs no rules change),
`campaignFrames`, `roster`, `tasks`, `activity`, `users`, `support`,
`resetRequests`, `audit`, `authIndex`, `intelSubmissions`, `intelStats`
(plus a narrower `content/intel` override for RHQ Staff);
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
