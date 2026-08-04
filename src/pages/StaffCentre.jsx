import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'
import VideoEmbed from '../components/VideoEmbed'
import DocEmbed from '../components/DocEmbed'
import PixelMap from '../components/PixelMap'
import MapLegend from '../components/MapLegend'
import { COMPANIES, PHONETIC, smeacOf, movementsOf } from '../firebase/seed'
import { framesValid, sortFrames } from '../lib/campaign'
import { listSubmissions } from '../lib/submissions'

// Staff Centre — a read-only overview of everything RHQ and the Company
// Commanders are doing, for unit staff who don't need (or shouldn't have) an
// editing account. URL-only at /staff-centre, gated by one shared password.
//
// Structure: an overview of clickable section cards, each opening a detail
// view with the actual content (the intel fragments themselves, the briefing
// text, the video playing, the live map, the activity feed…). Nothing here is
// editable — RHQ edits in the Ops Centre, commanders in the COY Centre.
//
// ⚠️ SECURITY MODEL, deliberately modest: the password below ships in the
// client bundle, so it is a "keep the casual visitor out" latch, NOT a real
// secret — anyone determined can read it out of the JS. That is acceptable
// *because this page only ever displays content that is already public*
// (everything under content/* is world-readable by design so the public site
// works signed-out). It grants no write access and shows no personal data:
// the roster, help inbox and audit log are never touched here.
const STAFF_PASSWORD = 'SCUNARRATIVE'
const LS_KEY = '1atf-staff-ok'

export default function StaffCentre() {
  const [ok, setOk] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === '1' } catch { return false }
  })
  if (!ok) return <StaffGate onPass={() => setOk(true)} />
  return <StaffDashboard onLock={() => { try { localStorage.removeItem(LS_KEY) } catch { /* ignore */ } setOk(false) }} />
}

function StaffGate({ onPass }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (pw.trim().toUpperCase() !== STAFF_PASSWORD) {
      setErr('Incorrect password.')
      return
    }
    try { localStorage.setItem(LS_KEY, '1') } catch { /* ignore */ }
    onPass()
  }

  return (
    <div className="col center" style={{ minHeight: '100vh', gap: 14, padding: 24, textAlign: 'center' }}>
      <Logo size={70} />
      <div className="head accent" style={{ letterSpacing: 3 }}>STAFF CENTRE</div>
      <div className="mono dim" style={{ fontSize: 12, maxWidth: 380 }}>
        Unit staff overview. Enter the staff password to continue.
      </div>
      <form onSubmit={submit} className="col" style={{ gap: 10, width: '100%', maxWidth: 300 }}>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => { setPw(e.target.value); setErr('') }}
          placeholder="Staff password"
          aria-label="Staff password"
        />
        {err && <div className="mono" style={{ fontSize: 11, color: 'var(--hostile)' }}>{err}</div>}
        <button className="primary" type="submit">Enter</button>
      </form>
      <Link to="/" className="mono dim" style={{ fontSize: 11 }}>← Return to portal</Link>
    </div>
  )
}

/* ------------------------------- dashboard ------------------------------- */

const when = (t) => (t ? new Date(t).toLocaleString() : '—')
const whenShort = (t) => (t ? new Date(t).toLocaleDateString() : '—')

function StaffDashboard({ onLock }) {
  const { state } = useData()
  const { isRHQ, isCommander, user } = useAuth()
  const [view, setView] = useState(null) // null = overview, else section id
  const [subs, setSubs] = useState(null) // null loading | [] none | false denied

  // The approval queue lives in `intelSubmissions`, which the security rules
  // restrict to RHQ / the owning commander — a password-only staff visitor is
  // not signed in to Firebase at all, so this read legitimately fails against
  // live Firebase. Try anyway (works in LOCAL MODE, and when an RHQ or
  // commander session already exists in this browser) and show an honest
  // notice rather than a misleading empty list.
  useEffect(() => {
    let live = true
    listSubmissions(isCommander && user?.company ? { company: user.company } : {})
      .then((rows) => { if (live) setSubs(rows) })
      .catch(() => { if (live) setSubs(false) })
    return () => { live = false }
  }, [isCommander, user?.company])

  const meta = state.contentMeta || {}
  const intel = state.intel || []
  const activity = state.activity || []
  const video = state.video || {}
  const briefings = state.briefings || {}
  const campaignFrames = state.campaignFrames
  const hasCampaign = framesValid(campaignFrames, state.territory.cols, state.territory.rows)
  const scheduled = video.live && video.publishAt && video.publishAt > Date.now()

  const SECTIONS = [
    {
      id: 'approvals',
      title: 'Approvals',
      sub: 'Company intel awaiting RHQ',
      tone: 'hostile',
      stat: subs === false ? 'restricted' : subs === null ? '…' : `${subs.length} pending`,
      alert: Array.isArray(subs) && subs.length > 0,
    },
    {
      id: 'intel',
      title: 'Intercepted Intelligence',
      sub: 'Every fragment, by company',
      stat: `${intel.length} fragment${intel.length === 1 ? '' : 's'}`,
    },
    {
      id: 'video',
      title: 'Video & Distribution',
      sub: scheduled ? 'Scheduled' : video.live ? 'Published' : 'Nothing published',
      stat: scheduled ? `goes live ${whenShort(video.publishAt)}` : video.live ? 'live now' : '—',
      alert: !!scheduled,
    },
    {
      id: 'briefings',
      title: 'Briefings',
      sub: 'Full briefing text',
      stat: `${(briefings.sections || []).length} section${(briefings.sections || []).length === 1 ? '' : 's'}`,
    },
    {
      id: 'map',
      title: 'Operational Map',
      sub: 'Territory & campaign replay',
      stat: hasCampaign ? `${campaignFrames.length} frame${campaignFrames.length === 1 ? '' : 's'}` : 'no replay',
    },
    {
      id: 'activity',
      title: 'Activity Feed',
      sub: 'Recent unit activity',
      stat: activity.length ? `${activity.length} entr${activity.length === 1 ? 'y' : 'ies'}` : 'none visible',
    },
    {
      id: 'narrative',
      title: 'Operation Brief',
      sub: 'SMEAC + Meridian threat',
      stat: `updated ${whenShort(meta.narrative?.updatedAt)}`,
    },
    {
      id: 'freshness',
      title: 'Content Status',
      sub: 'When each section last changed',
      stat: `${Object.keys(meta).length} tracked`,
    },
  ]

  const current = SECTIONS.find((s) => s.id === view)

  return (
    <div className="container" style={{ padding: '24px 20px 60px', maxWidth: 1000 }}>
      <div className="row between center wrap" style={{ gap: 10, marginBottom: 18 }}>
        <div className="row center" style={{ gap: 12 }}>
          <Logo size={42} />
          <div>
            <div className="head accent" style={{ fontSize: 16 }}>STAFF CENTRE</div>
            <div className="mono dim" style={{ fontSize: 10 }}>READ-ONLY UNIT OVERVIEW</div>
          </div>
        </div>
        <div className="row center wrap" style={{ gap: 8 }}>
          <Link to="/" className="mono dim" style={{ fontSize: 11 }}>← Portal</Link>
          <button className="ghost" onClick={onLock} style={{ fontSize: 11 }}>Lock</button>
        </div>
      </div>

      {view && (
        <button className="ghost" onClick={() => setView(null)} style={{ marginBottom: 12, fontSize: 11 }}>
          ← All sections
        </button>
      )}

      {!view && (
        <>
          <div className="staff-grid">
            {SECTIONS.map((s) => (
              <button key={s.id} className="staff-card" onClick={() => setView(s.id)}
                style={s.alert ? { borderColor: 'var(--hostile)' } : undefined}>
                <span className={`mono ${s.alert ? 'hostile' : 'accent'}`} style={{ fontSize: 10, letterSpacing: 2 }}>
                  {s.title.toUpperCase()}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text)' }}>{s.sub}</span>
                <span className="mono dim" style={{ fontSize: 11 }}>{s.stat} →</span>
              </button>
            ))}
          </div>
          <div className="mono dim" style={{ fontSize: 10, marginTop: 16, lineHeight: 1.6 }}>
            Select a section for full detail. Read-only — RHQ edits in the Ops Centre,
            commanders in the COY Centre.
            {(isRHQ || isCommander) && ' You are also signed in, so restricted items are visible.'}
          </div>
        </>
      )}

      {current && (
        <div className="col" style={{ gap: 12 }}>
          <div>
            <div className={`head ${current.tone === 'hostile' ? 'hostile' : 'accent'}`} style={{ fontSize: 18 }}>
              {current.title}
            </div>
            <div className="mono dim" style={{ fontSize: 11 }}>{current.sub}</div>
          </div>
          {view === 'approvals' && <ApprovalsDetail subs={subs} />}
          {view === 'intel' && <IntelDetail intel={intel} updatedAt={meta.intel?.updatedAt} intro={state.intelIntro} />}
          {view === 'video' && <VideoDetail video={video} briefings={briefings} />}
          {view === 'briefings' && <BriefingsDetail briefings={briefings} updatedAt={meta.briefings?.updatedAt} />}
          {view === 'map' && <MapDetail territory={state.territory} campaignFrames={campaignFrames} hasCampaign={hasCampaign} updatedAt={meta.territory?.updatedAt} />}
          {view === 'activity' && <ActivityDetail activity={activity} />}
          {view === 'narrative' && <NarrativeDetail narrative={state.narrative} classified={state.classified} />}
          {view === 'freshness' && <FreshnessDetail meta={meta} />}
        </div>
      )}
    </div>
  )
}

/* -------------------------------- details -------------------------------- */

const Panel = ({ children, tone }) => (
  <div className="panel panel-pad col" style={{ gap: 10, borderColor: tone === 'hostile' ? 'var(--hostile)' : undefined }}>{children}</div>
)
const Muted = ({ children }) => <div className="mono dim" style={{ fontSize: 11, lineHeight: 1.7 }}>{children}</div>
const Field = ({ label, children }) => (
  <div className="col" style={{ gap: 3 }}>
    <div className="mono dim" style={{ fontSize: 9, letterSpacing: 2 }}>{label}</div>
    <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{children}</div>
  </div>
)

function ApprovalsDetail({ subs }) {
  if (subs === null) return <Panel><Muted>Checking…</Muted></Panel>
  if (subs === false) {
    return (
      <Panel tone="hostile">
        <Muted>
          The approval queue can’t be read from this page. Those drafts are
          restricted to RHQ and the submitting commander, and the Staff Centre
          isn’t a signed-in account — so the request is refused by the security
          rules, by design. To see pending approvals here, sign in as RHQ in
          this browser (Ops Centre → Approvals) and return.
        </Muted>
      </Panel>
    )
  }
  if (!subs.length) return <Panel><Muted>Nothing awaiting approval — the queue is clear.</Muted></Panel>
  return (
    <>
      <div className="mono hostile" style={{ fontSize: 12 }}>
        {subs.length} REQUEST{subs.length === 1 ? '' : 'S'} PENDING
      </div>
      {subs.map((s) => {
        const f = s.fragment || {}
        return (
          <Panel key={s.id} tone="hostile">
            <div className="row between center wrap" style={{ gap: 8 }}>
              <span className="mono accent" style={{ fontSize: 12 }}>
                {PHONETIC[s.company] || s.company} COY
              </span>
              <span className="mono hostile" style={{ fontSize: 11 }}>
                {s.op === 'remove' ? 'REQUESTS REMOVAL' : 'SUBMITTED A CHANGE'}
              </span>
              <span className="mono dim" style={{ fontSize: 10 }}>{when(s.ts)}</span>
            </div>
            <div className="divider" style={{ margin: 0 }} />
            <Field label="TITLE">{f.title || '—'}</Field>
            {f.prompt && <Field label="CODED MESSAGE">{f.prompt}</Field>}
            {f.answer && <Field label="SOLUTION">{f.answer}</Field>}
            {f.reveal && <Field label="ON DECRYPT">{f.reveal}</Field>}
            {s.by && <Field label="SUBMITTED BY">{s.by}</Field>}
          </Panel>
        )
      })}
    </>
  )
}

function IntelDetail({ intel, updatedAt, intro }) {
  const groups = [
    { key: 'ALL', label: 'UNIT-WIDE (RHQ)' },
    ...COMPANIES.filter((c) => c.letter !== 'R').map((c) => ({ key: c.letter, label: `${c.letter}-COY · ${c.name}` })),
  ]
  return (
    <>
      <Muted>Last updated {when(updatedAt)}. This is exactly what cadets see, with the answers.</Muted>
      {intro?.show && (intro.title || intro.text) && (
        <Panel>
          <div className="mono accent" style={{ fontSize: 10, letterSpacing: 2 }}>INTRO SHOWN ON THE INTEL TAB</div>
          {intro.title && <div className="head" style={{ fontSize: 14 }}>{intro.title}</div>}
          {intro.text && <div style={{ fontSize: 13, lineHeight: 1.6 }}>{intro.text}</div>}
        </Panel>
      )}
      {groups.map((g) => {
        const rows = intel.filter((f) => f.company === g.key)
        return (
          <Panel key={g.key}>
            <div className="row between center wrap" style={{ gap: 8 }}>
              <span className="mono accent" style={{ fontSize: 11, letterSpacing: 2 }}>{g.label}</span>
              <span className="mono dim" style={{ fontSize: 10 }}>{rows.length} fragment{rows.length === 1 ? '' : 's'}</span>
            </div>
            {!rows.length && <Muted>No intel issued to this company yet.</Muted>}
            {rows.map((f) => (
              <div key={f.id} className="col" style={{ gap: 6, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                <div className="head" style={{ fontSize: 14 }}>{f.title || 'Untitled fragment'}</div>
                {f.prompt && <Field label="CODED MESSAGE">{f.prompt}</Field>}
                {f.answer && <Field label="SOLUTION">{f.answer}</Field>}
                {f.reveal && <Field label="REVEALED ON DECRYPT">{f.reveal}</Field>}
                {!!(f.resources || []).length && (
                  <Field label="ATTACHMENTS">
                    {f.resources.map((r) => r.title || r.url).join(' · ')}
                  </Field>
                )}
                {f.docUrl && <DocEmbed url={f.docUrl} />}
              </div>
            ))}
          </Panel>
        )
      })}
    </>
  )
}

function VideoDetail({ video, briefings }) {
  const scheduled = video.live && video.publishAt && video.publishAt > Date.now()
  return (
    <>
      <Panel tone={scheduled ? 'hostile' : undefined}>
        <div className="mono accent" style={{ fontSize: 10, letterSpacing: 2 }}>DISTRIBUTION STATUS</div>
        {!video.live && <Muted>Nothing published or scheduled.</Muted>}
        {video.live && (
          <>
            <Field label="TITLE">{video.live.title || 'Untitled'}</Field>
            {video.live.caption && <Field label="CAPTION">{video.live.caption}</Field>}
            <Field label="STATUS">
              {scheduled ? `Scheduled — goes live ${when(video.publishAt)}` : 'Live now on the Briefings tab'}
            </Field>
            {video.live.url && <VideoEmbed url={video.live.url} />}
          </>
        )}
      </Panel>
      {video.draft?.url && (
        <Panel>
          <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2 }}>RHQ DRAFT (NOT PUBLISHED)</div>
          <Field label="TITLE">{video.draft.title || 'Untitled'}</Field>
          <VideoEmbed url={video.draft.url} />
        </Panel>
      )}
      {briefings.video && (
        <Panel>
          <div className="mono accent" style={{ fontSize: 10, letterSpacing: 2 }}>VIDEO ON THE BRIEFINGS TAB</div>
          <VideoEmbed url={briefings.video} />
        </Panel>
      )}
    </>
  )
}

function BriefingsDetail({ briefings, updatedAt }) {
  const sections = briefings.sections || []
  return (
    <>
      <Muted>Last updated {when(updatedAt)}.</Muted>
      {briefings.video && <Panel><VideoEmbed url={briefings.video} /></Panel>}
      {!sections.length && <Panel><Muted>No briefing sections published.</Muted></Panel>}
      {sections.map((s, i) => (
        <Panel key={i}>
          <div className="mono accent" style={{ fontSize: 11, letterSpacing: 3 }}>{s.heading}</div>
          {s.highlight && (
            <div className="head" style={{ fontSize: 14, color: '#fff' }}>{s.highlight}</div>
          )}
          <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{s.body}</div>
        </Panel>
      ))}
      {briefings.closingQuote && (
        <Panel><div className="mono accent" style={{ fontSize: 13 }}>“{briefings.closingQuote}”</div></Panel>
      )}
    </>
  )
}

function MapDetail({ territory, campaignFrames, hasCampaign, updatedAt }) {
  const sorted = hasCampaign ? sortFrames(campaignFrames) : []
  return (
    <>
      <Muted>Territory last updated {when(updatedAt)}. Live state shown — use +/- to zoom.</Muted>
      <PixelMap territory={territory} showCompanyLabels />
      <MapLegend showRHQ={territory.showRHQ} />
      <Panel>
        <div className="mono accent" style={{ fontSize: 10, letterSpacing: 2 }}>NAMED PLACES</div>
        {!(territory.places || []).length && <Muted>No place labels.</Muted>}
        {(territory.places || []).map((p) => (
          <div key={p.id} className="row between center wrap" style={{ gap: 8, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
            <span style={{ fontSize: 13 }}>{p.name}</span>
            <span className="mono dim" style={{ fontSize: 10 }}>
              {p.hostile ? 'Meridian stronghold' : 'Standard location'}
            </span>
          </div>
        ))}
      </Panel>
      <Panel>
        <div className="mono accent" style={{ fontSize: 10, letterSpacing: 2 }}>CAMPAIGN REPLAY TIMELINE</div>
        {!hasCampaign && <Muted>No campaign replay recorded — the map shows the current state only.</Muted>}
        {sorted.map((f, i) => (
          <div key={f.id} className="row between center wrap" style={{ gap: 8, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
            <span className="mono accent" style={{ fontSize: 11 }}>{i === 0 ? 'START' : String(i).padStart(2, '0')}</span>
            <span style={{ fontSize: 13, flex: '1 1 120px' }}>{f.label || (i === 0 ? 'Campaign baseline' : '(unlabelled move)')}</span>
            <span className="mono dim" style={{ fontSize: 10 }}>{when(f.ts)}</span>
          </div>
        ))}
      </Panel>
    </>
  )
}

function ActivityDetail({ activity }) {
  if (!activity.length) {
    return (
      <Panel>
        <Muted>
          No activity entries are visible here. The activity feed is stored
          RHQ-only under the security rules, so a password-only staff visitor
          can’t read it — sign in as RHQ in this browser to see it. (It may also
          simply be empty: nothing in the app writes to it automatically.)
        </Muted>
      </Panel>
    )
  }
  const rows = [...activity].sort((a, b) => (b.ts || 0) - (a.ts || 0))
  return (
    <Panel>
      {rows.map((a) => (
        <div key={a.id} className="row between center wrap" style={{ gap: 8, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
          <span className="mono accent" style={{ fontSize: 11, minWidth: 80 }}>{a.company || '—'}</span>
          <span style={{ fontSize: 13, flex: '1 1 160px' }}>{a.text}</span>
          <span className="mono dim" style={{ fontSize: 10 }}>{when(a.ts)}</span>
        </div>
      ))}
    </Panel>
  )
}

function NarrativeDetail({ narrative, classified }) {
  const s = smeacOf(narrative)
  const m = narrative.meridian || {}
  const movements = movementsOf(narrative)
  const rows = [
    ['S — SITUATION', s.situation],
    ['M — MISSION', s.mission],
    ['E — EXECUTION', s.execution],
    ['A — ADMIN & LOGISTICS', s.admin],
    ['C — COMMAND / CONTROL / COMMS', s.command],
  ].filter(([, v]) => String(v || '').trim())
  return (
    <>
      <Panel>
        <div className="mono accent" style={{ fontSize: 10, letterSpacing: 2 }}>{narrative.oneatf?.title || 'OPERATION BRIEF'}</div>
        {rows.map(([label, body]) => <Field key={label} label={label}>{body}</Field>)}
      </Panel>
      <Panel tone="hostile">
        <div className="mono hostile" style={{ fontSize: 10, letterSpacing: 2 }}>{m.title || 'MERIDIAN'}</div>
        <Field label="THREAT LEVEL">{m.threatLevel || '—'}</Field>
        {/* Mirrors the public box: two headings, with whyStop running on under
            MOTIVE rather than carrying a heading of its own. */}
        {m.objective && <Field label={m.objectiveHeading || 'OBJECTIVE'}>{m.objective}</Field>}
        {(m.motive || m.whyStop) && (
          <Field label={m.motiveHeading || 'MOTIVE'}>
            {[m.motive, m.whyStop].filter(Boolean).join('\n\n')}
          </Field>
        )}
      </Panel>
      {movements.show && movements.entries.length > 0 && (
        <Panel>
          <div className="mono accent" style={{ fontSize: 10, letterSpacing: 2 }}>
            {movements.title || 'RECENT MOVEMENTS'}
          </div>
          {movements.entries.filter((e) => String(e.text || '').trim()).map((e) => (
            <Field key={e.id} label={`${e.company}-COY`}>{e.text}</Field>
          ))}
        </Panel>
      )}
      <Panel>
        <div className="mono accent" style={{ fontSize: 10, letterSpacing: 2 }}>COMPANY ROLES</div>
        <Field label="RECRUIT COMPANIES (A–D)">{narrative.oneatf?.recruitRole || '—'}</Field>
        <Field label="E-COY">{narrative.oneatf?.companies?.Echo || '—'}</Field>
        <Field label="S-COY">{narrative.oneatf?.companies?.Support || '—'}</Field>
      </Panel>
      <Panel>
        <div className="mono accent" style={{ fontSize: 10, letterSpacing: 2 }}>WELCOME / CLASSIFIED PAGE</div>
        <Field label="HEADING">{classified?.heading || '—'}</Field>
        <Field label="BRIEF">{classified?.brief || '—'}</Field>
        <Field label="MOTTO">{classified?.motto || '—'}</Field>
      </Panel>
    </>
  )
}

function FreshnessDetail({ meta }) {
  const rows = [
    ['Operation brief (SMEAC / narrative)', 'narrative'],
    ['Map territory', 'territory'],
    ['Campaign replay', 'campaign'],
    ['Intercepted intelligence', 'intel'],
    ['Intel intro', 'intelIntro'],
    ['Briefings', 'briefings'],
    ['Video', 'video'],
    ['Welcome / Classified page', 'classified'],
    ['Branding', 'branding'],
    ['Company pages', 'companyPages'],
  ]
  return (
    <Panel>
      {rows.map(([label, slice]) => (
        <div key={slice} className="row between center wrap" style={{ gap: 8, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
          <span style={{ fontSize: 13, flex: '1 1 160px' }}>{label}</span>
          <span className="mono dim" style={{ fontSize: 10 }}>{when(meta[slice]?.updatedAt)}</span>
        </div>
      ))}
    </Panel>
  )
}
