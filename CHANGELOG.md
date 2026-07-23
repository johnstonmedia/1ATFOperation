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
