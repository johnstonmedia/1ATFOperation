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
  { letter: 'S', name: 'Support', accent: '#5b6f8c' },
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

export const ROLES = ['General', 'RHQ']

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

// Intel fragments cadets decrypt (per company). Public read; RHQ/COY write.
// { id, company, title, prompt, answer, reveal, resources, docUrl, ts }
export const DEFAULT_INTEL = []

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
  oneatf: {
    title: '1ATF // FRIENDLY FORCES',
    mission:
      'Regain and hold sovereign territory from the Meridian incursion. ' +
      '1ATF coordinates six companies across the continent to fix, isolate ' +
      'and reduce Meridian-held zones until the line holds nothing hostile.',
    companies: {
      Alpha: 'Spearhead element. Holds the Northern Approach and leads forward assaults.',
      Bravo: 'Reconnaissance and screening across the Cape Sector.',
      Charlie: 'Holds the Western Reach; counter-infiltration and coastal denial.',
      Delta: 'Heavy element securing the Eastern Seaboard population centres.',
      Echo: 'Holds the Southern Line; rapid response and reinforcement.',
      Support: 'Logistics, signals and sustainment from the Logistics Hub.',
    },
  },
  meridian: {
    title: 'MERIDIAN // HOSTILE',
    threatLevel: 'SEVERE',
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
export const DEFAULT_COMPANY_PAGES = COMPANIES.reduce((acc, c) => {
  acc[c.letter] = {
    name: c.name,
    role: DEFAULT_NARRATIVE.oneatf.companies[c.name] || '',
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
  { id: 'a2', company: 'Meridian', text: 'Hostile probe repelled at Red Centre.', ts: Date.now() - 43200000 },
]
