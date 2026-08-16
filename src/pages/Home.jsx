import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import CampaignReplayMap from '../components/CampaignReplayMap'
import { useData } from '../context/DataContext'
import { useCompany } from '../context/CompanyContext'
import { useUnseen, useUnseenIntel, hasIntelBaseline, markIntelSeen } from '../hooks/useUnseen'
import { decryptProgress } from '../lib/intelProgress'
import { COMPANIES, PHONETIC, smeacOf, movementsOf } from '../firebase/seed'

const RECRUITS = ['Alpha', 'Bravo', 'Charlie', 'Delta']
const badge = (c) => (
  <span key={c.letter} title={c.name} style={{
    minWidth: 28, height: 28, borderRadius: 4, background: c.accent, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron', fontWeight: 700, fontSize: 12, color: '#04121b',
  }}>{c.letter}</span>
)

// A movement can be credited to more than one company (up to all six
// non-RHQ companies). Laid out as a small grid rather than one wide row so
// it stays compact next to the text instead of pushing the row wide — column
// count per size chosen for the tightest packing at each count: 1x1, 2x1,
// 3x1, 2x2, 3+2, 3x2.
const CLUSTER_COLS = { 1: 1, 2: 2, 3: 3, 4: 2, 5: 3, 6: 3 }
function BadgeCluster({ companies }) {
  if (companies.length === 1) return badge(companies[0])
  const cols = CLUSTER_COLS[companies.length] || 3
  const size = 22
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${size}px)`, gap: 4, flex: '0 0 auto' }}>
      {companies.map((c) => (
        <span key={c.letter} title={c.name} style={{
          width: size, height: size, borderRadius: 4, background: c.accent, display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron', fontWeight: 700, fontSize: 10, color: '#04121b',
        }}>{c.letter}</span>
      ))}
    </div>
  )
}

export default function Home() {
  const { state } = useData()
  const { company } = useCompany()
  const n = state.narrative
  // Intel alerts are scoped to what this visitor can actually see (unit-wide
  // + their own company), so another company's edits never light their alert.
  const newIntel = useUnseenIntel(company)
  const newBriefing = useUnseen('briefings')
  // Device-local decrypt progress over the same set of fragments the alert
  // above is scoped to, so the two can never disagree about what's outstanding.
  const progress = decryptProgress(state.intel, company)
  const outstanding = progress.total - progress.done

  // First visit (or straight after switching company): record the current
  // intel as the baseline so the alert only ever fires on a real change.
  useEffect(() => {
    if (!hasIntelBaseline(company)) markIntelSeen(state.intel, company)
  }, [company, state.intel])

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
      {newIntel && (
        <Link to="/intel" className="alert-banner">
          ⚠ NEW INTERCEPTED INTELLIGENCE{company ? ` — ${(PHONETIC[company] || company).toUpperCase()} / UNIT` : ''}
          {outstanding > 0 ? ` — ${outstanding} STILL ENCRYPTED` : ''} — TAP TO DECRYPT
        </Link>
      )}
      {/* Nothing NEW, but puzzles left unsolved on this device: a quieter,
          non-alarming nudge in accent rather than threat-red. The red banner
          means "RHQ posted something"; this one only means "you haven't
          finished", so it must not look like the same event. */}
      {!newIntel && outstanding > 0 && (
        <Link to="/intel" className="alert-banner quiet">
          ◆ {outstanding} MERIDIAN TRANSMISSION{outstanding === 1 ? '' : 'S'} STILL ENCRYPTED
          {progress.done > 0 ? ` — ${progress.done} / ${progress.total} DECRYPTED` : ''} — TAP TO DECRYPT
        </Link>
      )}
      {newBriefing !== 0 && (
        <Link to="/briefings" className="alert-banner">⚠ NEW BRIEFING / TASKING POSTED — TAP TO VIEW</Link>
      )}

      {/* Animated campaign-history replay; plain static map when no campaign
          start state has been recorded yet. */}
      <CampaignReplayMap territory={state.territory} frames={state.campaignFrames} defaultStartId={state.campaignDefaultStart} />

      <div className="row wrap" style={{ marginTop: 20, gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 420px' }}>
          <SmeacBrief n={n} />
        </div>
        <div className="col" style={{ flex: '1 1 420px', gap: 16 }}>
          <MovementsBox mv={movementsOf(n)} />
          <CompanyRoles n={n} />
          <MeridianBox m={n.meridian} />
        </div>
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
    ['C', 'COMMAND AND SIGNALS', s.command],
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

// What each company DID to move the line, above the roles box — the roles box
// says what a company is for, this says what it has done, which is what
// explains the state of the map. RHQ toggles the whole box off from the ops
// centre (`show`), and an empty entry list hides it too rather than leaving a
// titled panel with nothing under it.
function MovementsBox({ mv }) {
  const entries = (mv.entries || []).filter((e) => String(e.text || '').trim())
  if (!mv.show || !entries.length) return null
  const comp = (letter) => COMPANIES.find((c) => c.letter === letter)
  return (
    <div className="panel panel-pad col" style={{ gap: 12 }}>
      <div className="row between center wrap" style={{ gap: 10 }}>
        <h2 className="accent" style={{ margin: 0, fontSize: 16 }}>{mv.title || 'RECENT MOVEMENTS'}</h2>
        <span className="tag">MAP CHANGES</span>
      </div>
      {mv.intro && <div className="mono dim" style={{ fontSize: 11, lineHeight: 1.6 }}>{mv.intro}</div>}
      <div className="col" style={{ gap: 12 }}>
        {entries.map((e) => {
          const comps = (e.companies || []).map(comp).filter(Boolean)
          return (
            <div key={e.id} className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
              {/* Unknown/blank company codes still render a row — the text is
                  the point, and a stale letter shouldn't drop the entry. */}
              {comps.length ? <BadgeCluster companies={comps} /> : <span style={{ width: 28, flex: '0 0 auto' }} />}
              <div style={{ fontSize: 13, lineHeight: 1.55 }}>{e.text}</div>
            </div>
          )
        })}
      </div>
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

// One Meridian panel with exactly TWO headings (was two panels and three
// headings, which read as more of the page than the threat warrants).
//
// No RHQ copy was dropped in the merge: `whyStop` keeps its own paragraph
// under MOTIVE rather than its own heading, since "why we stop them" is the
// consequence of the motive, not a separate topic. Its heading field
// (`whyHeading`) is intentionally no longer rendered — the ops editor says so.
//
// No `.divider` rules between the sections: the panel's own border plus the
// spacing and the red section headings already separate them, and the extra
// lines just added visual noise to a box that got merged to be quieter.
function MeridianBox({ m }) {
  return (
    <div className="panel panel-pad col" style={{ gap: 16, borderColor: 'var(--hostile)' }}>
      <h2 className="hostile" style={{ margin: 0, fontSize: 18 }}>{m.title}</h2>
      <div>
        <div className="mono hostile" style={{ fontSize: 10, letterSpacing: 2 }}>{m.objectiveHeading || 'OBJECTIVE'}</div>
        <p style={{ marginTop: 6, lineHeight: 1.5, marginBottom: 0 }}>{m.objective}</p>
      </div>
      <div>
        <div className="mono hostile" style={{ fontSize: 10, letterSpacing: 2 }}>{m.motiveHeading || 'MOTIVE'}</div>
        <p style={{ marginTop: 6, lineHeight: 1.5, marginBottom: 0 }}>{m.motive}</p>
        {String(m.whyStop || '').trim() && (
          <p style={{ marginTop: 10, lineHeight: 1.5, marginBottom: 0 }}>{m.whyStop}</p>
        )}
      </div>
    </div>
  )
}
