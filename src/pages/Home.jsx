import PixelMap from '../components/PixelMap'
import { useData } from '../context/DataContext'
import { COMPANIES } from '../firebase/seed'

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

      <PixelMap territory={state.territory} />

      <div style={{ marginTop: 20 }}>
        <OneATFBrief n={n} />
      </div>
      <div style={{ marginTop: 16 }}>
        <MeridianBrief m={n.meridian} />
      </div>
    </div>
  )
}

function OneATFBrief({ n }) {
  const comp = (name) => COMPANIES.find((c) => c.name === name)
  return (
    <div className="row wrap" style={{ gap: 16, alignItems: 'stretch' }}>
      <div className="panel panel-pad grow" style={{ minWidth: 280 }}>
        <h2 className="accent" style={{ marginTop: 0, fontSize: 18 }}>{n.oneatf.title}</h2>
        <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2 }}>MISSION</div>
        <p style={{ marginTop: 6, lineHeight: 1.5, marginBottom: 0 }}>{n.oneatf.mission}</p>
      </div>

      <div className="panel panel-pad col grow" style={{ minWidth: 280, gap: 18 }}>
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
