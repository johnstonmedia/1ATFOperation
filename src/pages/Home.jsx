import { useState } from 'react'
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
  const [tab, setTab] = useState('1ATF')
  const [selected, setSelected] = useState(null)

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

      {/* Tabs */}
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <button className={tab === '1ATF' ? 'primary' : 'ghost'} onClick={() => setTab('1ATF')}>1ATF</button>
        <button className={tab === 'Meridian' ? '' : 'ghost'}
          style={tab === 'Meridian' ? { borderColor: 'var(--hostile)', color: 'var(--hostile)' } : {}}
          onClick={() => setTab('Meridian')}>Meridian</button>
      </div>

      <div className="row wrap" style={{ gap: 20, alignItems: 'flex-start' }}>
        <div className="grow" style={{ minWidth: 320 }}>
          <PixelMap territory={state.territory} height={520} />
          {selected && (
            <div className="panel panel-pad" style={{ marginTop: 12 }}>
              <strong className="head">{selected}</strong>
            </div>
          )}
        </div>

        <div style={{ width: 420, maxWidth: '100%' }}>
          {tab === '1ATF' ? <OneATFBrief n={n} /> : <MeridianBrief m={n.meridian} />}
        </div>
      </div>
    </div>
  )
}

function RoleBox({ badges, title, children }) {
  return (
    <div className="panel panel-pad">
      <div className="row center" style={{ gap: 8, marginBottom: 8 }}>
        <div className="row" style={{ gap: 4 }}>{badges}</div>
        <div className="head" style={{ fontSize: 14 }}>{title}</div>
      </div>
      {children}
    </div>
  )
}

function OneATFBrief({ n }) {
  const comp = (name) => COMPANIES.find((c) => c.name === name)
  const role = (name) => n.oneatf.companies[name]
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="panel panel-pad">
        <h2 className="accent" style={{ marginTop: 0, fontSize: 18 }}>{n.oneatf.title}</h2>
        <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2 }}>MISSION</div>
        <p style={{ marginTop: 6, lineHeight: 1.5 }}>{n.oneatf.mission}</p>
      </div>

      <RoleBox title="Recruit Companies" badges={RECRUITS.map((nm) => badge(comp(nm)))}>
        <div className="col" style={{ gap: 8 }}>
          {RECRUITS.map((nm) => (
            <div key={nm} className="mono" style={{ fontSize: 12 }}>
              <span className="accent">{nm}:</span> <span className="dim">{role(nm)}</span>
            </div>
          ))}
        </div>
      </RoleBox>

      <RoleBox title="Echo Company" badges={[badge(comp('Echo'))]}>
        <div className="mono dim" style={{ fontSize: 12 }}>{role('Echo')}</div>
      </RoleBox>
      <RoleBox title="Support Company" badges={[badge(comp('Support'))]}>
        <div className="mono dim" style={{ fontSize: 12 }}>{role('Support')}</div>
      </RoleBox>
    </div>
  )
}

function MeridianBrief({ m }) {
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="panel panel-pad" style={{ borderColor: 'var(--hostile)' }}>
        <h2 className="hostile" style={{ marginTop: 0, fontSize: 18 }}>{m.title}</h2>
        <span className="tag hostile blink" style={{ display: 'inline-block' }}>THREAT: {m.threatLevel}</span>
      </div>
      <div className="panel panel-pad">
        <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2 }}>{m.motiveHeading || 'MOTIVE'}</div>
        <p style={{ marginTop: 6, lineHeight: 1.5, marginBottom: 0 }}>{m.motive}</p>
      </div>
      <div className="panel panel-pad" style={{ borderColor: 'var(--hostile)' }}>
        <div className="mono hostile" style={{ fontSize: 10, letterSpacing: 2 }}>{m.whyHeading || 'WHY WE STOP THEM'}</div>
        <p style={{ marginTop: 6, lineHeight: 1.5, marginBottom: 0 }}>{m.whyStop}</p>
      </div>
    </div>
  )
}
