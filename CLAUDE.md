# 1ATF Operational Portal — project context & handoff

Futuristic, intelligence-agency–styled portal for the **Shore Cadet Unit / 1st
Australian Task Force (1ATF)**. Tracks the operation to regain territory from the
hostile **Meridian** across an interactive map of Australia.

This file is the running context for any Claude/Claude Code session. Read it
first.

## Stack & deployment
- **Vite + React + React Router**, **react-leaflet** (Leaflet) map, **Firebase**
  (Auth + Firestore) backend, **xlsx** for spreadsheet import, **EmailJS** for
  admin notifications.
- Hosted on **GitHub Pages** via `.github/workflows/deploy.yml` (builds with
  `VITE_BASE=/<repo>/`, deploys `dist/`). Pages Source must be **GitHub Actions**.
- SPA deep links handled by `public/404.html` + a restore snippet in `index.html`.
- Runs in **LOCAL MODE** (localStorage) if Firebase keys are absent; otherwise
  live. Firebase web config is embedded in `src/firebase/config.js` (keys are
  public by design; security is via Firestore rules).

## Auth model (`src/context/AuthContext.jsx`)
- Members log in with their **ID number** (not email). Firebase Auth uses a
  synthesised email `id-<id>[.v<version>]@1atf.unit`.
- **First-time / post-reset:** "Log in with temporary password" — ID + issued
  temp password + a new password they choose. `register()` validates the temp
  password against the roster.
- **Returning:** ID + password via `signIn()`.
- **Password reset:** RHQ bumps a per-ID **credential epoch** (`authIndex`, see
  `lib/store.js getAuthVersion/setAuthVersion`); the versioned email makes the
  member re-register with a fresh temp password. (No Firebase Admin SDK needed.)
- **Bootstrap admin: ID `190990`** is RHQ and can always sign in, even before any
  roster exists; it is also written into the roster so it shows in Users.
- Roles: **RHQ** and **General** (chosen in Users admin, not from the sheet).
- Companies (phonetic letters): A Alpha, B Bravo, C Charlie, D Delta, E Echo,
  S Support. Meridian is the hostile force (red on the map).

## Data model
- Firestore single-value docs under `content/{slice}`: `narrative`, `zones`,
  `arrows`, `classified`, `branding`, `companyPages` (public read, RHQ write).
- Collections: `roster`, `tasks`, `activity` (signed-in read, RHQ write);
  `support`, `resetRequests` (anyone create, RHQ read); `users/{uid}` profiles;
  `authIndex/{id}` (public read, RHQ write — just `pwVersion`).
- Data layer in `src/lib/store.js` (mode-agnostic). `DataContext` provides
  `updateSlice`, `replaceRoster`, `append`, `reportError`, `reload`.

## Features
- Public: Australia-locked map (zones by occupant; movement **arrows** dotted =
  planned / solid = current), 1ATF & Meridian briefs. Company role text gated
  behind login.
- Hamburger: Profile, Your Activity, Your Tasks, own Company page. **A member
  only ever sees their own company's tasks** (no broadcast).
- `/Classified` URL-only landing page (Continue → temp-password registration).
- `/operations-centre` RHQ-only console: Narrative, Operational Map (drag to
  move zones, drag corners; Rectangle vs Custom; arrows editor), Classified,
  Branding (logo via `public/scu-logo.png`, no Storage), Digital Activities
  (doc→quiz, company-targeted), Company Pages, **Users** (spreadsheet import =
  merge that leaves existing IDs untouched; issues temp passwords; download
  temp-password sheet; search), **Help** (Support / Reset Password / Account
  Issues).
- **Error reporting** (`src/lib/errors.js`): technical faults auto-file a Help
  request with an internal code (ATF-NET/AUTH/CFG/DATA/INP/UNK-*) + device/page
  detail and email RHQ; user-input errors are shown but not reported. Offline
  reports are queued and resent.
- **Email** via EmailJS (`src/lib/notify.js`) to the unit admin.

## Spreadsheet import
Captures only **name, ID number, company, email** (fuzzy `COLUMN_HINTS` in
`src/pages/ops/UsersAdmin.jsx`). Company accepts a letter or phonetic name.
Import MERGES: existing IDs are kept unchanged, only new IDs added.

## Firebase setup checklist (console)
1. Authentication → enable **Email/Password**.
2. Firestore → create DB → publish `firestore.rules`.
3. Storage is **not used** (logo is a repo file).

## Known privacy gaps / TODO (discussed, not yet done)
- ⚠️ `roster` and `users` are readable by **any signed-in member** (rules use
  `isSignedIn()`), so a technical user could read all names/IDs/emails and the
  **plain-text temp passwords**. Tighten to RHQ-only — but registration reads the
  roster to verify the temp password, so this needs a rework (e.g. a minimal
  public claim-check or a Cloud Function).
- ⚠️ Temp passwords are stored **plain text** in `roster`. Consider hashing and
  only revealing at generation/download time.
- No member-facing privacy notice yet (relevant — likely minors in a cadet unit).

## Working constraints (important)
- The repo dev branch is `claude/vigilant-cerf-i22f9f`.
- Earlier web sessions had a **read-only** GitHub token, so changes were moved
  via `git bundle`. If this session has write access, commit/push directly.
- Do NOT put the model identifier or these notes' "Claude-Session" lines into
  anything beyond commit metadata as already configured.
