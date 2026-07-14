import { useState } from 'react'
import AustraliaMap from '../components/AustraliaMap'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { COMPANIES, rankShort, surnameOf } from '../firebase/seed'
import { formatUpdated } from '../components/LastUpdated'
import VideoEmbed from '../components/VideoEmbed'

export default function Home() {
  const { state } = useData()
  const { user } = useAuth()
  const n = state.narrative
  const [tab, setTab] = useState('1ATF')
  const [selected, setSelected] = useState(null)

  // For the 1ATF tab show all zones; the Meridian tab highlights hostile holds.
  const zones = state.zones
  // Freshness of the operational picture = most recent of map / narrative saves.
  const meta = state.contentMeta || {}
  const lastUpdated = Math.max(meta.zones?.updatedAt || 0, meta.arrows?.updatedAt || 0, meta.narrative?.updatedAt || 0)

  return (
    <div className="container" style={{ padding: '24px 20px 60px' }}>
      {/* Hero */}
      <div className="panel panel-pad" style={{ marginBottom: 20 }}>
        <div className="row between wrap" style={{ gap: 16 }}>
          <div>
            {user && (
              <div className="mono accent" style={{ fontSize: 14, marginBottom: 8 }}>
                Welcome, {[rankShort(user.rank), surnameOf(user.name)].filter(Boolean).join(' ')}
              </div>
            )}
            <div className="tag live blink">● LIVE OPERATIONAL PICTURE</div>
            <h1 style={{ margin: '10px 0 4px', fontSize: 30, color: '#fff' }}>
              {n.shortName} <span className="dim" style={{ fontSize: 18 }}>{n.unitName}</span>
            </h1>
            <div className="mono accent" style={{ fontSize: 13 }}>“{n.quote}”</div>
          </div>
          <div className="mono dim col" style={{ fontSize: 11, textAlign: 'right', justifyContent: 'center' }}>
            <div>THEATRE: AUSTRALIA</div>
            <div>ZONES TRACKED: {zones.length}</div>
            <div className="hostile">MERIDIAN HOLDS: {zones.filter((z) => z.occupant === 'Meridian').length}</div>
            {lastUpdated > 0 && <div style={{ marginTop: 4 }}>UPDATED: {formatUpdated(lastUpdated)}</div>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <button className={tab === '1ATF' ? 'primary' : 'ghost'} onClick={() => setTab('1ATF')}>1ATF</button>
        <button
          className={tab === 'Meridian' ? '' : 'ghost'}
          style={tab === 'Meridian' ? { borderColor: 'var(--hostile)', color: 'var(--hostile)' } : {}}
          onClick={() => setTab('Meridian')}
        >
          Meridian
        </button>
      </div>

      <div className="row wrap" style={{ gap: 20, alignItems: 'flex-start' }}>
        {/* Map */}
        <div className="grow" style={{ minWidth: 320 }}>
          <AustraliaMap zones={zones} arrows={state.arrows} height={540} onZoneClick={setSelected} />
          <Legend />
          {selected && (
            <div className="panel panel-pad" style={{ marginTop: 12 }}>
              <div className="row between center">
                <strong className="head">{selected.name}</strong>
                <span className={selected.occupant === 'Meridian' ? 'tag hostile' : 'tag live'}>
                  {selected.occupant}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Briefing column */}
        <div style={{ width: 420, maxWidth: '100%' }}>
          {tab === '1ATF' ? <OneATFBrief n={n} authed={Boolean(user)} /> : <MeridianBrief n={n} />}
        </div>
      </div>

      <HomeVideo video={state.video} />
    </div>
  )
}

// Public video section, shown below the map only when RHQ has published one and
// its scheduled publish time has arrived. Nothing renders otherwise — no header.
function HomeVideo({ video }) {
  const live = video?.live
  const due = live && video.publishAt && Date.now() >= video.publishAt
  if (!due || !live.url) return null
  return (
    <div className="panel panel-pad" style={{ marginTop: 20 }}>
      {live.title && <h2 className="accent" style={{ marginTop: 0, fontSize: 20 }}>{live.title}</h2>}
      <VideoEmbed url={live.url} />
      {live.caption && <p className="mono dim" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>{live.caption}</p>}
    </div>
  )
}

function Legend() {
  const items = [
    ...COMPANIES.map((c) => ({ label: c.name, color: c.accent })),
    { label: 'Meridian', color: '#ff3b46' },
    { label: 'Contested', color: '#ffcf4a' },
  ]
  return (
    <div className="row wrap" style={{ gap: 10, marginTop: 10 }}>
      {items.map((i) => (
        <div key={i.label} className="row center mono" style={{ gap: 6, fontSize: 11 }}>
          <span style={{ width: 12, height: 12, background: i.color, borderRadius: 2, opacity: 0.85, display: 'inline-block' }} />
          <span className="dim">{i.label}</span>
        </div>
      ))}
    </div>
  )
}

function OneATFBrief({ n, authed }) {
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="panel panel-pad">
        <h2 className="accent" style={{ marginTop: 0, fontSize: 18 }}>{n.oneatf.title}</h2>
        <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2 }}>MISSION</div>
        <p style={{ marginTop: 6, lineHeight: 1.5 }}>{n.oneatf.mission}</p>
      </div>
      {!authed ? (
        <div className="panel panel-pad col center" style={{ gap: 8, padding: 28, textAlign: 'center' }}>
          <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2 }}>COMPANY ROLES</div>
          <div className="head hostile" style={{ fontSize: 14, letterSpacing: 2 }}>🔒 RESTRICTED</div>
          <div className="mono dim" style={{ fontSize: 11, maxWidth: 320 }}>
            Authenticate via ACCESS to view company roles and dispositions.
          </div>
        </div>
      ) : (
      <div className="panel panel-pad">
        <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2, marginBottom: 8 }}>COMPANY ROLES</div>
        <div className="col" style={{ gap: 10 }}>
          {COMPANIES.map((c) => (
            <div key={c.letter} className="row" style={{ gap: 10 }}>
              <span style={{ minWidth: 26, height: 26, borderRadius: 3, background: c.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Orbitron', fontWeight: 700, fontSize: 12, color: '#04121b' }}>
                {c.letter}
              </span>
              <div>
                <div className="head" style={{ fontSize: 13 }}>{c.name}</div>
                <div className="mono dim" style={{ fontSize: 11 }}>{n.oneatf.companies[c.name]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  )
}

function MeridianBrief({ n }) {
  const m = n.meridian
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="panel panel-pad" style={{ borderColor: 'var(--hostile)' }}>
        <div className="row between center">
          <h2 className="hostile" style={{ marginTop: 0, fontSize: 18 }}>{m.title}</h2>
          <span className="tag hostile blink">THREAT: {m.threatLevel}</span>
        </div>
        <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2, marginTop: 8 }}>MOTIVE</div>
        <p style={{ marginTop: 6, lineHeight: 1.5 }}>{m.motive}</p>
      </div>
      <div className="panel panel-pad">
        <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2 }}>OBJECTIVE</div>
        <p style={{ marginTop: 6, lineHeight: 1.5 }}>{m.objective}</p>
      </div>
      <div className="panel panel-pad" style={{ borderColor: 'var(--hostile)' }}>
        <div className="mono hostile" style={{ fontSize: 10, letterSpacing: 2 }}>WHY WE STOP THEM</div>
        <p style={{ marginTop: 6, lineHeight: 1.5 }}>{m.whyStop}</p>
      </div>
    </div>
  )
}
