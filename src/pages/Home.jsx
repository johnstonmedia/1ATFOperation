import { Link } from 'react-router-dom'
import CampaignReplayMap from '../components/CampaignReplayMap'
import { useData } from '../context/DataContext'
import { useUnseen } from '../hooks/useUnseen'
import { COMPANIES, smeacOf } from '../firebase/seed'

const RECRUITS = ['Alpha', 'Bravo', 'Charlie', 'Delta']
const badge = (c) => (
  <span key={c.letter} title={c.name} style={{
    minWidth: 28, height: 28, borderRadius: 4, background: c.accent, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron', fontWeight: 700, fontSize: 12, color: '#04121b',
  }}>{c.letter}</span>
)

export default function Home() {
  const { state } = useData()
  const n = state.narrative
  const newIntel = useUnseen('intel')
  const newBriefing = useUnseen('briefings')

  return (
    <div className="container" style={{ padding: '24px 20px 60px' }}>
      {/* Hero */}
      <div className="panel panel-pad" style={{ marginBottom: 20 }}>
        <div className="tag live blink">● LIVE OPERATIONAL PICTURE</div>
        <h1 style={{ margin: '10px 0 4px', fontSize: 30, color: '#fff' }}>
          {n.shortName} <span className="dim" style={{ fontSize: 18 }}>{n.unitName}</span>
        </h1>
        <div className="mono accent" style={{ fontSize: 13 }}>“{n.quote}”</div>
      </div>

      {/* Unread-content alerts: shown until this device opens the page, then
          cleared (see useUnseen/markSeen). */}
      {newIntel !== 0 && (
        <Link to="/intel" className="alert-banner">⚠ NEW INTERCEPTED INTELLIGENCE — TAP TO DECRYPT</Link>
      )}
      {newBriefing !== 0 && (
        <Link to="/briefings" className="alert-banner">⚠ NEW BRIEFING / TASKING POSTED — TAP TO VIEW</Link>
      )}

      {/* Animated campaign-history replay; plain static map when no campaign
          start state has been recorded yet. */}
      <CampaignReplayMap territory={state.territory} campaign={state.campaign} />

      <div style={{ marginTop: 20 }}>
        <SmeacBrief n={n} />
      </div>
      <div style={{ marginTop: 16 }}>
        <CompanyRoles n={n} />
      </div>
      <div style={{ marginTop: 16 }}>
        <MeridianBrief m={n.meridian} />
      </div>
    </div>
  )
}

// The main operation brief in SMEAC orders format. Sections left blank by
// RHQ are simply skipped.
function SmeacBrief({ n }) {
  const s = smeacOf(n)
  const sections = [
    ['S', 'SITUATION', s.situation],
    ['M', 'MISSION', s.mission],
    ['E', 'EXECUTION', s.execution],
    ['A', 'ADMIN & LOGISTICS', s.admin],
    ['C', 'COMMAND / CONTROL / COMMS', s.command],
  ].filter(([, , text]) => String(text || '').trim())

  return (
    <div className="panel panel-pad">
      <div className="row between center wrap" style={{ gap: 10 }}>
        <h2 className="accent" style={{ margin: 0, fontSize: 18 }}>{n.oneatf.title}</h2>
        <span className="tag">OPERATION BRIEF // SMEAC</span>
      </div>
      {sections.map(([letter, heading, text]) => (
        <div key={letter} style={{ marginTop: 14 }}>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span style={{
              width: 22, height: 22, borderRadius: 4, background: 'var(--accent)', color: '#04121b',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Orbitron', fontWeight: 700, fontSize: 12, flex: '0 0 auto',
            }}>{letter}</span>
            <span className="mono accent" style={{ fontSize: 10, letterSpacing: 2 }}>{heading}</span>
          </div>
          <p style={{ margin: '6px 0 0 30px', lineHeight: 1.55 }}>{text}</p>
        </div>
      ))}
    </div>
  )
}

function CompanyRoles({ n }) {
  const comp = (name) => COMPANIES.find((c) => c.name === name)
  return (
    <div className="panel panel-pad col" style={{ gap: 18 }}>
      <div className="row" style={{ gap: 14, alignItems: 'center' }}>
        <div className="row" style={{ gap: 8 }}>{RECRUITS.map((nm) => badge(comp(nm)))}</div>
        <div className="mono dim" style={{ fontSize: 12, lineHeight: 1.6 }}>{n.oneatf.recruitRole}</div>
      </div>
      <div className="row" style={{ gap: 14, alignItems: 'center' }}>
        {badge(comp('Echo'))}
        <div className="mono dim" style={{ fontSize: 12, lineHeight: 1.6 }}>{n.oneatf.companies.Echo}</div>
      </div>
      <div className="row" style={{ gap: 14, alignItems: 'center' }}>
        {badge(comp('Support'))}
        <div className="mono dim" style={{ fontSize: 12, lineHeight: 1.6 }}>{n.oneatf.companies.Support}</div>
      </div>
    </div>
  )
}

function MeridianBrief({ m }) {
  return (
    <div className="row wrap" style={{ gap: 16, alignItems: 'stretch' }}>
      <div className="panel panel-pad col grow" style={{ minWidth: 280, gap: 12, borderColor: 'var(--hostile)' }}>
        <div className="row between center wrap" style={{ gap: 10 }}>
          <h2 className="hostile" style={{ margin: 0, fontSize: 18 }}>{m.title}</h2>
          <span className="tag hostile blink" style={{ display: 'inline-block' }}>THREAT: {m.threatLevel}</span>
        </div>
        <div className="divider" style={{ margin: 0 }} />
        <div>
          <div className="mono hostile" style={{ fontSize: 10, letterSpacing: 2 }}>{m.objectiveHeading || 'OBJECTIVE'}</div>
          <p style={{ marginTop: 6, lineHeight: 1.5, marginBottom: 0 }}>{m.objective}</p>
        </div>
      </div>

      <div className="panel panel-pad col grow" style={{ minWidth: 280, gap: 12, borderColor: 'var(--hostile)' }}>
        <div>
          <div className="mono hostile" style={{ fontSize: 10, letterSpacing: 2 }}>{m.motiveHeading || 'MOTIVE'}</div>
          <p style={{ marginTop: 6, lineHeight: 1.5, marginBottom: 0 }}>{m.motive}</p>
        </div>
        <div className="divider" style={{ margin: 0 }} />
        <div>
          <div className="mono hostile" style={{ fontSize: 10, letterSpacing: 2 }}>{m.whyHeading || 'WHY WE STOP THEM'}</div>
          <p style={{ marginTop: 6, lineHeight: 1.5, marginBottom: 0 }}>{m.whyStop}</p>
        </div>
      </div>
    </div>
  )
}
