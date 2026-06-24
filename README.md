# 1ATF // Operational Portal

A futuristic, intelligence-agency–styled portal for the **Shore Cadet Unit /
1st Australian Task Force (1ATF)**. Tracks the operation to regain territory
from the hostile **Meridian** across an interactive map of Australia.

Built with **React + Vite**, **Leaflet** (continent-locked map), and
**Firebase** (Auth + Firestore + Storage) for user management and content.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

The site runs immediately in **Local Preview Mode** (data persisted to your
browser's `localStorage`) so you can click through everything before wiring up
Firebase. A `console` warning confirms when local mode is active.

### Login & the admin account
Members sign in with their **ID number** and a password (no email required —
Firebase Auth uses a synthesised address under the hood). Register once via
**Access**, then sign in with the same ID number.

The seeded administrator is **ID `190990`** — registering with it gives you the
**RHQ** role and access to the Operations Centre, from where you can promote
other members to RHQ. Any other registration becomes a General cadet until RHQ
provisions their roster record.

---

## Enabling the live Firebase backend

1. Create a Firebase project, then enable **Authentication → Email/Password**,
   **Cloud Firestore**, and **Storage**.
2. Copy `.env.example` to `.env` and paste in your project's web SDK config.
3. Deploy the included `firestore.rules`.
4. Restart `npm run dev`. The app auto-detects the config and switches to live mode.

Data model (Firestore):

| Path | Contents |
|------|----------|
| `content/narrative` | Home page narrative, company roles, Meridian brief |
| `content/zones` | Map territories + occupants |
| `content/classified` | `/Classified` landing page |
| `content/branding` | Logo URL + theme colours |
| `content/companyPages` | Per-company hamburger pages |
| `roster/{id}` | RHQ-provisioned personnel (links new sign-ups) |
| `tasks/{id}` | Distributed digital activities |
| `users/{uid}` | Individual account profiles (rank/company/role) |

---

## Feature map

| Requirement | Where |
|-------------|-------|
| Australia-locked Leaflet map | `src/components/AustraliaMap.jsx` (`maxBounds`) |
| Home: logo, quote, 1ATF / Meridian tabs | `src/pages/Home.jsx` |
| Hamburger: Profile / Activity / Tasks / Company | `src/components/Sidebar.jsx` + `src/pages/*` |
| Public read, login to change | `RequireAuth` + Firestore rules |
| `/Classified` URL-only page | `src/pages/Classified.jsx` |
| `/operations-centre` RHQ console | `src/pages/ops/*` |
| Narrative / map / classified / branding editors | `src/pages/ops/*Editor.jsx` |
| Digital Activities (doc → quiz, draft/distribute/schedule) | `src/pages/ops/DigitalActivities.jsx` |
| Users: create/edit, spreadsheet import, search | `src/pages/ops/UsersAdmin.jsx` |
| Roster ↔ account linking by ID/email | `src/context/AuthContext.jsx` |

---

## Replacing the logo

Drop your real crest at **`public/scu-logo.png`** — the app prefers it
automatically and falls back to the bundled SVG (`public/scu-logo.svg`). You can
also upload a logo from **Operations Centre → Branding**.

## Spreadsheet import

**Operations Centre → Users → Import spreadsheet** accepts `.xlsx/.xls/.csv`.
Column matching is fuzzy (see `COLUMN_HINTS` in `UsersAdmin.jsx`) and the company
letter is read as a phonetic abbreviation (A = Alpha … S = Support). Once the
real ~800-row format is confirmed, adjust `COLUMN_HINTS` to match its headers.

> **Scheduled distribution** flips a task to "distributed" at its scheduled time.
> In production this should be driven by a Firebase Cloud Function / scheduled
> job; in local preview it distributes immediately if the time is already due.
