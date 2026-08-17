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
