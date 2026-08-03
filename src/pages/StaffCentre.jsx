import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'
import { COMPANIES, PHONETIC } from '../firebase/seed'
import { campaignValid } from '../lib/campaign'
import { listSubmissions } from '../lib/submissions'

// Staff Centre — a read-only, simplified overview of everything RHQ and the
// Company Commanders are doing, for unit staff who don't need (or shouldn't
// have) an editing account. URL-only at /staff-centre, gated by one shared
// password.
//
// ⚠️ SECURITY MODEL, deliberately modest: the password below ships in the
// client bundle, so it is a "keep the casual visitor out" latch, NOT a real
// secret — anyone determined can read it out of the JS. That is acceptable
// *because this page only ever displays content that is already public*
// (everything under content/* is world-readable by design so the public site
// works signed-out). It grants no write access and reveals no personal data:
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

function StaffDashboard({ onLock }) {
  const { state } = useData()
  const { isRHQ, isCommander, user } = useAuth()
  const [subs, setSubs] = useState(null) // null = loading, [] = none, false = not permitted

  // The approval queue lives in `intelSubmissions`, which the security rules
  // restrict to RHQ / the owning commander — a password-only staff visitor is
  // not signed in to Firebase at all, so this read legitimately fails against
  // live Firebase. Try anyway (it works in LOCAL MODE, and when an RHQ or
  // commander session already exists in this browser) and show an honest
  // notice instead of an empty list when it isn't permitted.
  useEffect(() => {
    let live = true
    listSubmissions(isCommander && user?.company ? { company: user.company } : {})
      .then((rows) => { if (live) setSubs(rows) })
      .catch(() => { if (live) setSubs(false) })
    return () => { live = false }
  }, [isCommander, user?.company])

  const meta = state.contentMeta || {}
  const intel = state.intel || []
  const when = (t) => (t ? new Date(t).toLocaleString() : '—')
  const campaign = state.campaign
  const hasCampaign = campaignValid(campaign, state.territory.cols, state.territory.rows)
  const video = state.video || {}
  const pendingVideo = video.live && video.publishAt && video.publishAt > Date.now()

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

      {/* ---- Approvals (COY → RHQ) ---- */}
      <Section title="Approvals — company intel awaiting RHQ" tone="hostile">
        {subs === null && <Muted>Checking…</Muted>}
        {subs === false && (
          <Muted>
            The approval queue can’t be read from this page — those drafts are
            restricted to RHQ and the submitting commander, and the Staff Centre
            isn’t a signed-in account. Sign in as RHQ in this browser (Ops Centre
            → Approvals) to see it here.
          </Muted>
        )}
        {Array.isArray(subs) && subs.length === 0 && <Muted>Nothing awaiting approval.</Muted>}
        {Array.isArray(subs) && subs.length > 0 && (
          <div className="col" style={{ gap: 6 }}>
            <div className="mono hostile" style={{ fontSize: 12 }}>
              {subs.length} REQUEST{subs.length === 1 ? '' : 'S'} PENDING
            </div>
            {subs.map((s) => (
              <Row key={s.id}
                left={`${PHONETIC[s.company] || s.company} COY`}
                mid={s.op === 'remove' ? 'Requests REMOVAL' : 'Submitted a change'}
                right={`${s.fragment?.title || 'untitled'} · ${when(s.ts)}`}
              />
            ))}
          </div>
        )}
      </Section>

      {/* ---- Scheduled distribution ---- */}
      <Section title="Scheduled distribution">
        {pendingVideo ? (
          <Row left="VIDEO" mid={video.live?.title || 'Untitled'} right={`Goes live ${when(video.publishAt)}`} />
        ) : video.live ? (
          <Row left="VIDEO" mid={video.live.title || 'Untitled'} right="Live now" />
        ) : (
          <Muted>Nothing scheduled or published.</Muted>
        )}
      </Section>

      {/* ---- Intel by company ---- */}
      <Section title="Intercepted intelligence">
        <Row left="UNIT-WIDE" mid={`${intel.filter((f) => f.company === 'ALL').length} fragment(s)`} right={`updated ${when(meta.intel?.updatedAt)}`} />
        {COMPANIES.filter((c) => c.letter !== 'R').map((c) => (
          <Row key={c.letter}
            left={`${c.letter}-COY`}
            mid={`${intel.filter((f) => f.company === c.letter).length} fragment(s)`}
            right={c.name}
          />
        ))}
      </Section>

      {/* ---- Operational map / campaign ---- */}
      <Section title="Operational map">
        <Row left="TERRITORY" mid={`${state.territory.places?.length || 0} named place(s)`} right={`updated ${when(meta.territory?.updatedAt)}`} />
        {hasCampaign ? (
          <>
            <Row left="REPLAY" mid={`${campaign.timeline.length} progress frame(s)`} right={`start ${when(campaign.start.ts)}`} />
            {campaign.timeline.map((e, i) => (
              <Row key={i} left={String(i + 1).padStart(2, '0')} mid={e.label || '(unlabelled)'} right={when(e.ts)} />
            ))}
          </>
        ) : (
          <Muted>No campaign replay recorded — the map shows the current state only.</Muted>
        )}
      </Section>

      {/* ---- Content freshness ---- */}
      <Section title="Content last updated">
        {[
          ['Map narrative (SMEAC)', 'narrative'],
          ['Briefings', 'briefings'],
          ['Intel intro', 'intelIntro'],
          ['Welcome / Classified page', 'classified'],
          ['Branding', 'branding'],
        ].map(([label, slice]) => (
          <Row key={slice} left={label} mid="" right={when(meta[slice]?.updatedAt)} />
        ))}
      </Section>

      <div className="mono dim" style={{ fontSize: 10, marginTop: 18, lineHeight: 1.6 }}>
        Read-only. Nothing on this page can be edited here — RHQ edits in the Ops
        Centre, commanders in the COY Centre.
        {(isRHQ || isCommander) && ' You are also signed in, so restricted items above are visible.'}
      </div>
    </div>
  )
}

function Section({ title, tone, children }) {
  return (
    <div className="panel panel-pad col" style={{ gap: 8, marginBottom: 14, borderColor: tone === 'hostile' ? 'var(--hostile)' : undefined }}>
      <div className={`mono ${tone === 'hostile' ? 'hostile' : 'accent'}`} style={{ fontSize: 10, letterSpacing: 2 }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  )
}

const Muted = ({ children }) => <div className="mono dim" style={{ fontSize: 11, lineHeight: 1.6 }}>{children}</div>

function Row({ left, mid, right }) {
  return (
    <div className="row between center wrap" style={{ gap: 8, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
      <span className="mono accent" style={{ fontSize: 11, flex: '0 0 auto', minWidth: 90 }}>{left}</span>
      <span style={{ fontSize: 12, flex: '1 1 140px' }}>{mid}</span>
      <span className="mono dim" style={{ fontSize: 10, flex: '0 0 auto' }}>{right}</span>
    </div>
  )
}
