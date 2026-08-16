// Default operational content + canonical reference data.
//
// This is the single source of truth for the site's initial state. In LOCAL
// MODE it is loaded straight into localStorage; with Firebase enabled it is
// used to seed empty collections on first run from the Operations Centre.

export const COMPANIES = [
  { letter: 'A', name: 'Alpha', accent: '#2e7dd1' },
  { letter: 'B', name: 'Bravo', accent: '#1faa8b' },
  { letter: 'C', name: 'Charlie', accent: '#c9a227' },
  { letter: 'D', name: 'Delta', accent: '#8e54c4' },
  { letter: 'E', name: 'Echo', accent: '#d1632e' },
  { letter: 'S', name: 'Support', accent: '#c9528a' },
  { letter: 'R', name: 'RHQ', accent: '#f39c12' },
]

// Phonetic-letter -> company name (used when interpreting the roster).
export const PHONETIC = {
  A: 'Alpha',
  B: 'Bravo',
  C: 'Charlie',
  D: 'Delta',
  E: 'Echo',
  S: 'Support',
  R: 'RHQ',
}

// Account roles. 'Company Commander' is the default for a new account: it is
// bound to a single company and may submit intel for that company (subject to
// RHQ approval). 'RHQ' is full control. 'General' is retained for legacy rows.
//
// The two staff roles reach ONLY the Staff Centre — never the Ops Centre, never
// the COY Centre:
//   'Staff'     — read-only. The same overview a shared-password visitor gets,
//                 but signed in, so it is attributable.
//   'RHQ Staff' — read-only PLUS the Company Commander approval queue: they can
//                 approve, edit-then-approve or dismiss submissions from any
//                 company, exactly as RHQ does in Ops Centre → Approvals.
// Both are created only by the bootstrap administrator (ADMIN_ID in
// AuthContext) — see STAFF_CREATOR_ID / UsersAdmin.
export const ROLES = ['Company Commander', 'RHQ', 'RHQ Staff', 'Staff', 'General']
export const COMMANDER_ROLE = 'Company Commander'
export const STAFF_ROLE = 'Staff'
export const RHQ_STAFF_ROLE = 'RHQ Staff'
// Roles that only the bootstrap administrator may hand out.
export const RESTRICTED_ROLES = [RHQ_STAFF_ROLE, STAFF_ROLE]
// True for any account whose home is the Staff Centre.
export const isStaffRole = (role) => role === STAFF_ROLE || role === RHQ_STAFF_ROLE

// Shared Staff Centre password, now editable by the bootstrap administrator in
// Ops Centre → Users rather than hard-coded in the page.
//
// ⚠️ This is a LATCH, NOT A SECRET, and moving it into Firestore does not
// change that: `content/*` is world-readable (the public site has to work
// signed-out), so the password is as readable as it was when it shipped in the
// JS bundle. It is acceptable for exactly the same reason as before — the
// Staff Centre only ever displays content that is already public, grants no
// write access, and shows no personal data. Anyone who needs real authority
// (approving COY submissions) needs a real 'RHQ Staff' account instead.
export const DEFAULT_STAFF_ACCESS = { password: 'SCUNARRATIVE' }

// Unit ranks, each with a long and short (abbreviated) form. The roster stores
// the short code; helpers below resolve either form for display.
export const RANKS = [
  { long: 'Recruit', short: 'Rec' },
  { long: 'Cadet', short: 'Cdt' },
  { long: 'Lance Corporal', short: 'LCpl' },
  { long: 'Corporal', short: 'Cpl' },
  { long: 'Sergeant', short: 'Sgt' },
  { long: 'Warrant Officer Class 2', short: 'WO2' },
  { long: 'Warrant Officer Class 1', short: 'WO1' },
  { long: 'Cadet Under Officer', short: 'CUO' },
  { long: 'Staff', short: 'Staff' },
]

const findRank = (v) => {
  const s = String(v || '').trim().toLowerCase()
  if (!s) return null
  return RANKS.find((r) => r.short.toLowerCase() === s || r.long.toLowerCase() === s) || null
}
// Short/long form of a stored rank value (falls back to the raw value if it's
// not a known rank, so nothing is ever lost).
export const rankShort = (v) => findRank(v)?.short || String(v || '').trim()
export const rankLong = (v) => findRank(v)?.long || String(v || '').trim()
// Canonical value to store (short code when recognised, else the trimmed input).
export const normalizeRank = (v) => findRank(v)?.short || String(v || '').trim()

// Last word of a full name, used to address members as "Rank Surname".
export const surnameOf = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : ''
}

// Map zones. Each zone is a rough polygon over Australia with an occupant.
// Occupants: company name, 'Meridian' (hostile, rendered red), or 'Contested'.
export const DEFAULT_ZONES = [
  {
    id: 'z-north',
    name: 'Northern Approach',
    occupant: 'Alpha',
    coords: [
      [-11.0, 130.5], [-11.0, 138.0], [-17.5, 138.0], [-17.5, 130.5],
    ],
  },
  {
    id: 'z-cape',
    name: 'Cape Sector',
    occupant: 'Bravo',
    coords: [
      [-10.5, 141.0], [-10.5, 146.0], [-17.0, 146.0], [-17.0, 141.0],
    ],
  },
  {
    id: 'z-west',
    name: 'Western Reach',
    occupant: 'Charlie',
    coords: [
      [-20.0, 113.0], [-20.0, 122.0], [-28.0, 122.0], [-28.0, 113.0],
    ],
  },
  {
    id: 'z-interior',
    name: 'Red Centre',
    occupant: 'Meridian',
    coords: [
      [-21.0, 128.0], [-21.0, 137.0], [-27.0, 137.0], [-27.0, 128.0],
    ],
  },
  {
    id: 'z-east',
    name: 'Eastern Seaboard',
    occupant: 'Delta',
    coords: [
      [-28.0, 151.5], [-28.0, 153.6], [-37.5, 150.0], [-34.0, 148.0],
    ],
  },
  {
    id: 'z-south',
    name: 'Southern Line',
    occupant: 'Echo',
    coords: [
      [-34.0, 135.0], [-34.0, 141.0], [-38.5, 141.0], [-38.5, 135.0],
    ],
  },
  {
    id: 'z-meridian-south',
    name: 'Meridian Salient',
    occupant: 'Meridian',
    coords: [
      [-27.0, 140.0], [-27.0, 147.0], [-32.0, 147.0], [-32.0, 140.0],
    ],
  },
  {
    id: 'z-support',
    name: 'Logistics Hub',
    occupant: 'Support',
    coords: [
      [-31.0, 115.5], [-31.0, 119.0], [-34.0, 119.0], [-34.0, 115.5],
    ],
  },
]

// Movement lines between zones. type: 'planned' (dotted, intended path) or
// 'current' (solid, movement under way).
export const DEFAULT_ARROWS = []

// HQ / point markers RHQ can drop on the map. { id, name, lat, lng, occupant }.
export const DEFAULT_MARKERS = []

// Intel fragments cadets decrypt. company: a letter, or 'ALL' for unit-wide RHQ
// intelligence. { id, company, title, prompt, answer, reveal, resources, docUrl }
export const DEFAULT_INTEL = []

// Editable intro shown atop the Intercepted Intelligence tab.
export const DEFAULT_INTEL_INTRO = {
  show: true,
  title: 'Intercepted Intelligence',
  text: 'Meridian transmissions are being intercepted across the network. Decrypt the fragments below to uncover their intent and your next tasking.',
}

// Briefings tab: a video plus the numbered briefing sections (title/body per
// section, editable from Ops Centre → Briefings). `highlight` is an optional
// bold callout rendered above a section's body — used for the mission
// statement, but any section can carry one.
export const DEFAULT_BRIEFINGS = {
  video: '',
  sections: [
    {
      heading: '01 — Situation',
      body:
        'Over the past eighteen months, an expansionist power known as THE MERIDIAN has systematically taken over territory across the world. The Meridian does not use conventional military force, instead operating through economic influence and strategic asset acquisition.\n\n' +
        'At the time of this briefing, The Meridian controls the majority of Australia. In New South Wales, they have concentrated their power in Singleton and Marrangaroo Training Areas, controlling land and supply chains. From these hubs, their control spreads out into the surrounding regions, leaving independent resistance from local units disorganised and ineffective.\n\n' +
        'The North Sydney area is among the last territory in the state still free of Meridian control: not a single Meridian operative was sighted during the Term 2 period. However, intelligence suggests that The Meridian has identified North Sydney as its next objective, with preliminary movements detected by Recon Platoon at the end of last week.',
    },
    {
      heading: '02 — The Unit',
      body:
        'In response, the six Companies of the SCU have formed the 1st Allied Task Force (1ATF). Together, they represent the last organised resistance capable of reclaiming what has been lost to The Meridian.',
    },
    {
      heading: '03 — The Mission',
      highlight:
        '1ATF will conduct sustained operations against The Meridian across New South Wales, including reconnaissance, navigation, and infiltration, in order to reclaim territory. The mission ends when no ground within the area of operations remains under Meridian control.',
      body:
        'Routine operations and training will be conducted over the coming Mondays, building the skills necessary to neutralise the situation. In doing so, the loosely held territory of regional NSW will be gradually reclaimed. Meridian encounters will be rare, but Companies must remain ready to respond should North Sydney or other secured areas be contested.\n\n' +
        "The campaign builds towards 1ATF's deployment to Singleton Military Training Area for BIVOUAC. There, the Meridian presence will be at its strongest, dug in to defend the supply lines that feed their entire operation. But if their hub at Singleton can be dismantled, Meridian influence across the state will begin to collapse, and the path to Marrangaroo, their stronghold, will be open. Plans for AFX are conditional on 1ATF successfully liberating this region.",
    },
    {
      heading: '04 — The Progress Map',
      body:
        "The Unit Progress Map is a live operational display maintained by RHQ. It shows the territory regained by all six Companies and the remaining Meridian-held ground, updating after each Monday session and each major camp phase. Every operation you complete or training you receive improves 1ATF's footing.\n\n" +
        'The map also carries intercepted Meridian material: encoded intelligence fragments recovered during operations. Decoding them is left to you, but those who do will be uniquely aware of what is ahead.',
    },
    {
      heading: '05 — Your Directive',
      body:
        'Standby for further tasking through your chain of command. And remember: Six Companies, one objective. One Unit. One outcome. Stay focused.\n\n' +
        'Our response begins now.',
    },
  ],
  closingQuote: 'One unit, one culture — everyone belongs, everyone contributes, and together we succeed.',
}

// Pixel-grid territory over the NSW map. cells is a cols*rows string of colour
// codes (see lib/territory.js). Default territory sits on the three camp areas.
// 216x112 = one cell per exact 3x3 block of the 648x336 source image.
const T_COLS = 216
const T_ROWS = 112
function buildTerritoryCells() {
  const g = new Array(T_COLS * T_ROWS).fill('.')
  const blob = (cx, cy, w, h, code) => {
    for (let y = cy; y < cy + h; y++) for (let x = cx; x < cx + w; x++) {
      if (x >= 0 && x < T_COLS && y >= 0 && y < T_ROWS) g[y * T_COLS + x] = code
    }
  }
  blob(125, 59, 14, 8, 'M') // North Sydney
  blob(35, 46, 14, 8, 'M')  // Marrangaroo
  blob(108, 8, 14, 8, 'M')  // Singleton
  return g.join('')
}
export const DEFAULT_TERRITORY = {
  cols: T_COLS,
  rows: T_ROWS,
  showRHQ: false,
  cells: buildTerritoryCells(),
  places: [
    { id: 'pl1', name: 'North Sydney', x: 132, y: 63 },
    { id: 'pl2', name: 'Marrangaroo', x: 42, y: 50 },
    { id: 'pl3', name: 'Singleton', x: 115, y: 13 },
  ],
}

// Reference location dots for the NSW operating area (Lithgow/Blue Mountains
// across Sydney to the Hunter). Positions are approximate over the map image.
export const CAPITALS = [
  { name: 'Sydney', lat: -33.87, lng: 151.21 },
  { name: 'Singleton', lat: -32.57, lng: 151.17 },
  { name: 'Lithgow', lat: -33.48, lng: 150.15 },
  { name: 'Marrangaroo', lat: -33.42, lng: 150.10 },
  { name: 'Katoomba', lat: -33.71, lng: 150.31 },
  { name: 'Penrith', lat: -33.75, lng: 150.69 },
  { name: 'Newcastle', lat: -32.93, lng: 151.78 },
  { name: 'Wollongong', lat: -34.42, lng: 150.90 },
]

export const DEFAULT_NARRATIVE = {
  unitName: '1st Australian Task Force',
  shortName: '1ATF',
  quote: '1ATF will not stop till the Meridian holds nothing.',
  // Main operation brief, in SMEAC orders format (rendered on the home page;
  // see smeacOf() for how older stored narratives without this key merge).
  smeac: {
    situation:
      'The Meridian, an expansionist threat, controls the majority of Australia, ' +
      'operating from hubs at Singleton and Marrangaroo. The North Sydney area ' +
      'remains free of Meridian control — intelligence indicates it is their next objective.',
    mission:
      'Regain and hold sovereign territory from the Meridian incursion. ' +
      '1ATF coordinates six companies across the continent to fix, isolate ' +
      'and reduce Meridian-held zones until the line holds no threat.',
    execution:
      'Companies A–D hold assigned ground, screen approaches and feed contact ' +
      'reports to RHQ. Echo holds the Southern Line as the rapid-response and ' +
      'reinforcement element. Territory is regained zone by zone and consolidated ' +
      'before the advance continues.',
    admin:
      'Support Company coordinates logistics, signals and sustainment from the ' +
      'Logistics Hub. Equipment and welfare issues are reported through the chain of command.',
    command:
      'RHQ commands the operation; Company Commanders lead their companies and report ' +
      'to RHQ. Orders and intelligence are distributed through this portal — monitor ' +
      'Briefings and Intercepted Intelligence for updates.',
  },
  oneatf: {
    title: '1ATF // FRIENDLY FORCES',
    mission:
      'Regain and hold sovereign territory from the Meridian incursion. ' +
      '1ATF coordinates six companies across the continent to fix, isolate ' +
      'and reduce Meridian-held zones until the line holds no threat.',
    // Shared role text for the four recruit companies (A/B/C/D) — they don't
    // have individual specialisations, so one line covers all of them. Echo
    // and Support keep their own distinct roles below.
    recruitRole: 'Frontline recruit element. Holds assigned ground, screens approaches, and feeds contact reports to RHQ.',
    companies: {
      Echo: 'Holds the Southern Line; rapid response and reinforcement.',
      Support: 'Logistics, signals and sustainment from the Logistics Hub.',
    },
  },
  // Short log of what each company actually DID to move the line, shown above
  // the company-roles box on the home page. The roles box says what a company
  // is FOR; this says what it has done — which is the bit that explains why
  // the map looks like it does this week. RHQ can hide the whole box with
  // `show: false` (e.g. between updates, so it never sits there stale).
  movements: {
    show: true,
    title: 'RECENT MOVEMENTS',
    intro: 'Company actions behind the latest changes to the operational map.',
    entries: [
      { id: 'mv-a', companies: ['A'], text: 'Pushed the northern screen forward and held the gained ground through the week.' },
      { id: 'mv-b', companies: ['B'], text: 'Cleared the approach to Singleton, forcing the Meridian line back off the ridge.' },
      { id: 'mv-c', companies: ['C'], text: 'Consolidated the coastal corridor; no ground lost during the period.' },
      { id: 'mv-e', companies: ['E'], text: 'Reinforced the Southern Line after Bravo’s advance opened a gap.' },
      { id: 'mv-s', companies: ['S'], text: 'Moved the forward supply point up behind the new front, sustaining the advance.' },
    ],
  },
  meridian: {
    title: 'MERIDIAN // THREAT',
    threatLevel: 'SEVERE',
    motiveHeading: 'MOTIVE',
    objectiveHeading: 'OBJECTIVE',
    whyHeading: 'WHY WE STOP THEM',
    motive:
      'The Meridian seeks to draw a hard line across the continent and claim ' +
      'everything beyond it. They exploit contested interior ground, spreading ' +
      'from the Red Centre outward.',
    objective:
      'Establish the Meridian — a fixed border the cadets must never let hold. ' +
      'They aim to fracture 1ATF coordination and seize the interior corridors.',
    whyStop:
      'Every zone the Meridian holds is sovereign ground denied to the people ' +
      'who live on it. If the Meridian line holds, the continent is split. ' +
      '1ATF exists to ensure it holds nothing.',
  },
}

// Merge a stored narrative's SMEAC brief with the defaults. Narratives saved
// before the SMEAC format existed have no `smeac` key — their edited mission
// line (oneatf.mission) is carried into the Mission paragraph so live copy
// isn't lost, and the other sections fall back to the seed text until RHQ
// edits them.
export function smeacOf(narrative) {
  return {
    ...DEFAULT_NARRATIVE.smeac,
    mission: narrative?.oneatf?.mission || DEFAULT_NARRATIVE.smeac.mission,
    ...(narrative?.smeac || {}),
  }
}

// Same idea for the movements box: a narrative saved before this key existed
// has no `movements`, so fall back to the seed rather than rendering an empty
// panel. `entries` is defaulted separately because a narrative CAN legitimately
// have an empty list (RHQ deleted every row) and that must not silently
// resurrect the filler text — only a missing key does.
//
// Entries used to carry a single `company` letter; a movement can now be
// credited to any set of companies (up to all six), stored as `companies`.
// Every entry is normalised to `companies` here so callers never have to
// branch on which shape a given entry was saved in.
export function movementsOf(narrative) {
  const m = narrative?.movements
  const merged = {
    ...DEFAULT_NARRATIVE.movements,
    ...(m || {}),
    entries: Array.isArray(m?.entries) ? m.entries : DEFAULT_NARRATIVE.movements.entries,
  }
  return {
    ...merged,
    entries: merged.entries.map((e) => ({
      ...e,
      companies: Array.isArray(e.companies) && e.companies.length ? e.companies : (e.company ? [e.company] : []),
    })),
  }
}

export const DEFAULT_CLASSIFIED = {
  heading: 'TOP-SECRET',
  unit: '1st Australian Task Force',
  brief:
    'This portal tracks 1ATF’s progress on its mission to regain territory ' +
    'from the Meridian. Access is restricted to unit members and authorised ' +
    'personnel.',
  motto: 'One Unit, One Mission.',
}

// Optional home-page video. `draft` is what RHQ is editing; `live` is what the
// public sees (null = nothing published, so the section is hidden entirely);
// `publishAt` is when `live` becomes visible (immediate deploy = now, scheduled
// = a future time, evaluated on load since there is no server cron).
export const DEFAULT_VIDEO = {
  draft: { url: '', title: '', caption: '' },
  live: null,
  publishAt: null,
}

export const DEFAULT_BRANDING = {
  // Prefers your real PNG if present in public/; Logo falls back to the SVG.
  logoUrl: import.meta.env.BASE_URL + 'scu-logo.png',
  primary: '#3a4794',
  hostile: '#c0392b',
  accent: '#36e0c0',
}

// Per-company page content shown in the hamburger menu company tab and
// editable from the Operations Centre.
const RECRUIT_LETTERS = ['A', 'B', 'C', 'D']
export const DEFAULT_COMPANY_PAGES = COMPANIES.reduce((acc, c) => {
  const role = RECRUIT_LETTERS.includes(c.letter)
    ? DEFAULT_NARRATIVE.oneatf.recruitRole
    : DEFAULT_NARRATIVE.oneatf.companies[c.name] || ''
  acc[c.letter] = {
    name: c.name,
    role,
    duties: [
      'Maintain readiness within assigned zone.',
      'Report movements to RHQ on schedule.',
    ],
    tasks: [],
  }
  return acc
}, {})

// A couple of demo roster rows so the Users admin + signup matching can be
// exercised before the real spreadsheet is imported.
export const DEMO_ROSTER = [
  // Bootstrap administrator — RHQ. Logs in directly with this ID (no temp pw).
  { _id: 'rhq-admin', idNumber: '190990', name: 'Unit Administrator', company: 'S', role: 'RHQ', email: '', rank: '' },
  { _id: 'demo-1', idNumber: '123456', name: 'CDT J. Reyes', company: 'A', role: 'General', email: '', rank: '', tempPassword: 'DEMOPASS' },
]

export const DEFAULT_ACTIVITY = [
  { id: 'a1', company: 'Alpha', text: 'Secured Northern Approach grid 130E.', ts: Date.now() - 86400000 },
  { id: 'a2', company: 'Meridian', text: 'Meridian probe repelled at Red Centre.', ts: Date.now() - 43200000 },
]
