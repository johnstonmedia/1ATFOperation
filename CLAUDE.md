# 1ATF Cadet Portal — project context & handoff

Cadet-campaign website. Read this fully before coding. **This file is the source
of truth; it supersedes any older description of an "all-Australia map / member
login" version — that has been replaced.**

## Stack & deploy
- Vite + React + React Router, Firebase (Auth + Firestore). **Leaflet was removed.**
- Hosted on GitHub Pages via `.github/workflows/deploy.yml` (builds `dist/`,
  deploys on push to `main`; Pages Source = GitHub Actions).
- Firebase project `atf-operations`; web config is public by design in
  `src/firebase/config.js`. LOCAL MODE (localStorage) only if keys are absent.

## Git / deploy rules
- Develop on branch `claude/atf-privacy-hardening-me8r8b`; deploy by pushing to
  `main`. Direct push works. Keep `main` and the feature branch in sync.
- ⚠️ **DEPLOY GOTCHA:** the workflow uses concurrency `cancel-in-progress: true`.
  Rapid successive pushes **cancel each other's deploys**, so the live site
  silently stays on an old build. Push ONE commit and let the run finish. Verify
  the deploy.yml run conclusion = `success` (not `cancelled`).

## Current architecture (post-pivot v2)
- **No member login.** Cadets pick a company via a dropdown → `src/context/
  CompanyContext.jsx` (localStorage). No accounts / no member PII.
- **RHQ** logs in via Firebase Auth (bootstrap admin = ID `190990`) to reach the
  URL-only `/operations-centre`. See `src/context/AuthContext.jsx`.
- Three recruit tabs: **Command Map** (`/`), **Intercepted Intelligence**
  (`/intel`), **Briefings** (`/briefings`). Routes in `src/App.jsx`; nav in
  `src/components/Sidebar.jsx` + `TopBar.jsx` (company select at top of the nav).

## The map — pixel-grid territory system (the core rebuild)
- `src/components/PixelMap.jsx`: renders a fixed terrain image
  (`public/map/nsw-terrain.jpeg`) with `image-rendering: pixelated`, plus a
  `<canvas>` overlay. **Zoom in only** (min = fit). Pointer painting when the
  `edit` prop is set. Place-name dots.
- `src/lib/territory.js`: colour states + helpers. Grid **128×80**. Codes:
  `'.'`=empty, `A B C D E S`=companies, `M`=Meridian, `R`=RHQ (shown only when
  `territory.showRHQ`), lowercase = lighter "loosely-held" variant. Exports
  `colorOf`, `PAINT`, `RHQ_PAINT`, `MAP_IMAGE`, `MAP_ASPECT`.
- Data model = one cheap content slice `territory` =
  `{ cols, rows, showRHQ, cells (a cols*rows string), places:[{id,name,x,y}] }`.
  Render: 0.4-alpha tint fill + solid company-colour edge wherever a cell borders
  a different code.
- Editor: `src/pages/ops/MapEditor.jsx` ("Map: Territory") — palette (solid +
  light per colour + erase), brush size, RHQ show/hide toggle, place-name editor.
- Default territory seeded on **Marrangaroo, Singleton, North Sydney**
  (`DEFAULT_TERRITORY` in `src/firebase/seed.js`); positions are approximate on
  the image — repaint/drag to taste. A true pixel-art PNG can replace
  `public/map/nsw-terrain.jpeg` (same filename) anytime.

## Data model (Firestore `content/{slice}`: public read, RHQ write — NO rules change needed for new slices)
- Active content slices: `narrative`, `territory`, `classified` (the recruit
  "Welcome Page"), `branding`, `intel`, `intelIntro`, `briefings`.
- Legacy/unused-but-present: `companyPages`, `video`.
- Collections: `roster`/`tasks`/`activity` (legacy), `support`, `resetRequests`,
  `audit`, `users/{uid}`, `authIndex/{id}`.
- Data layer: `src/lib/store.js` (`SINGLE_SLICES`, `loadFirebase`/
  `saveFirebaseSlice`). Defaults in `src/firebase/seed.js`.

## Intel & Briefings
- Intel = "Intercepted Intelligence". `src/pages/Intel.jsx` shows **RHQ**
  (fragments with `company==='ALL'`) + **Company** (`company===selected`)
  sections + an editable intro (`intelIntro` slice `{show,title,text}`). Cipher
  decrypt = per-word boxes + "Enter intel".
- Editor `src/pages/ops/IntelEditor.jsx`: audience dropdown includes "Entire
  unit" (`'ALL'`); intro editor with show/hide checkbox.
- Briefings: `src/pages/Briefings.jsx` (video + content). Editor
  `src/pages/ops/BriefingsEditor.jsx`. Slice `briefings` = `{video, content}`.

## Ops centre (`src/pages/ops/OperationsCentre.jsx`, RHQ-only)
Sections: Map: Narrative (NarrativeEditor), Map: Territory (MapEditor),
Intercepted Intelligence (IntelEditor), Briefings (BriefingsEditor), Welcome Page
(ClassifiedEditor), Branding, Users (legacy roster/temp-passwords), Help, Audit.

## OUTSTANDING / user actions still pending
1. **Publish `firestore.rules`** (Console → Firestore → Rules → paste → Publish).
   Recurring blocker — needed for audit log, RHQ `users/{uid}` + `authIndex`
   writes, and legacy help/reset flows. Public content slices work without it.
2. Enable **Email/Password** sign-in in Firebase Auth (for the 190990 RHQ login).
3. **EmailJS** delivery was never verified (the dev sandbox blocks
   api.emailjs.com). Mostly legacy now.
4. Recruit Welcome Page (`src/pages/Classified.jsx`) keeps a vestigial
   "Continue → temp password" flow — harmless; left per brief.
5. Legacy files remain but are unlinked: `Profile.jsx` (**KEEP** — exports
   `PageTitle` used by Intel/Briefings), `Activity.jsx`, `Tasks.jsx`,
   `SchedulePicker.jsx`.

## Build / preview
- `npm run build` must pass. Local preview: `npm run dev` (port 5173) or GitHub
  Codespaces. **github.dev cannot run it** (editor only, no terminal).

## Working constraints
- Do NOT put the model identifier or these notes into anything beyond commit
  metadata as already configured. Do not open PRs unless asked.
