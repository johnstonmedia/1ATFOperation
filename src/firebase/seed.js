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
]

// Phonetic-letter -> company name (used when interpreting the roster).
export const PHONETIC = {
  A: 'Alpha',
  B: 'Bravo',
  C: 'Charlie',
  D: 'Delta',
  E: 'Echo',
  S: 'Support',
}

export const ROLES = ['General', 'RHQ']

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
  // Unit administrator — RHQ by default. Logs in with this ID number.
  { _id: 'rhq-admin', idNumber: '190990', name: 'Unit Administrator', rank: 'RHQ', company: 'S', role: 'RHQ', email: '' },
  { _id: 'demo-1', idNumber: '0001', name: 'CDT J. Reyes', rank: 'Cadet', company: 'A', role: 'General', email: '' },
  { _id: 'demo-2', idNumber: '0002', name: 'LCDT M. Okafor', rank: 'Lead Cadet', company: 'B', role: 'General', email: '' },
]

export const DEFAULT_ACTIVITY = [
  { id: 'a1', company: 'Alpha', text: 'Secured Northern Approach grid 130E.', ts: Date.now() - 86400000 },
  { id: 'a2', company: 'Meridian', text: 'Hostile probe repelled at Red Centre.', ts: Date.now() - 43200000 },
]
