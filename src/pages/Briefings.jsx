import { useEffect } from 'react'
import { useData } from '../context/DataContext'
import { markSeen } from '../hooks/useUnseen'
import { PageTitle } from './Profile'
import VideoEmbed from '../components/VideoEmbed'
import { DEFAULT_BRIEFINGS } from '../firebase/seed'
import { isPublished, markCriticalSeen } from '../lib/criticalIntel'

// Briefings tab: a video plus the numbered briefing sections (editable from
// Ops Centre → Briefings). Falls back to the default section text so a
// stored briefings doc saved before sections existed still shows content
// instead of an empty page.
export default function Briefings() {
  const { state } = useData()
  const b = state.briefings || {}
  const sections = b.sections?.length ? b.sections : DEFAULT_BRIEFINGS.sections
  const closingQuote = b.closingQuote ?? DEFAULT_BRIEFINGS.closingQuote

  // Opening this page counts as "reading" the briefing — clears the
  // home-page new-briefing banner on this device.
  const updatedAt = state.contentMeta?.briefings?.updatedAt
  useEffect(() => { markSeen('briefings', updatedAt) }, [updatedAt])

  // Critical intel lives here permanently once published — the popup is only
  // its first few hours (see lib/criticalIntel.js). OPENING THIS TAB COUNTS AS
  // HAVING SEEN IT: a cadet who came straight here has watched the thing, and
  // being interrupted by it on the next tab they open would be absurd. This is
  // also why CriticalIntelAlert never fires on this route.
  const ci = state.criticalIntel || {}
  const ciLive = isPublished(ci)
  const ciStamp = ci.publishedAt || 0
  useEffect(() => { if (ciLive) markCriticalSeen({ publishedAt: ciStamp }) }, [ciLive, ciStamp])

  return (
    <div className="container" style={{ padding: '24px 20px 60px', maxWidth: 900 }}>
      <PageTitle title="Briefings" sub="UNIT BRIEFINGS" />

      {ciLive && <CriticalIntel item={ci} />}

      {b.video
        ? <div className="panel panel-pad" style={{ marginBottom: 20 }}><VideoEmbed url={b.video} /></div>
        : <div className="panel panel-pad mono dim" style={{ fontSize: 13, marginBottom: 20 }}>No briefing video yet.</div>}

      <div className="col" style={{ gap: 16 }}>
        {sections.map((s, i) => <BriefingSection key={i} section={s} />)}
      </div>

      {closingQuote && (
        <div className="mono accent" style={{ fontSize: 13, textAlign: 'center', marginTop: 24, lineHeight: 1.6 }}>
          “{closingQuote}”
        </div>
      )}
    </div>
  )
}

// The critical-intel item in its permanent home: above the ordinary briefing
// video, in the threat red the popup uses, so it is plainly not just another
// briefing. It stays here after its alert window closes — that is the half of
// the feature the popup can't do.
function CriticalIntel({ item }) {
  return (
    <div className="panel panel-pad col" style={{ gap: 14, marginBottom: 20, border: '1px solid var(--hostile)' }}>
      <div className="mono hostile" style={{ fontSize: 11, letterSpacing: 3 }}>◤ PRIORITY TRANSMISSION</div>
      <h2 className="head hostile" style={{ margin: 0, fontSize: 18, letterSpacing: 2 }}>
        {item.title || 'CRITICAL INTEL'}
      </h2>
      {item.video?.trim() && <VideoEmbed url={item.video} />}
      {(item.body || '').split('\n\n').filter(Boolean).map((p, i) => (
        <p key={i} style={{ margin: 0, lineHeight: 1.6 }}>{p}</p>
      ))}
    </div>
  )
}

function BriefingSection({ section }) {
  const { heading, body, highlight } = section
  const paragraphs = (body || '').split('\n\n').filter(Boolean)
  return (
    <div className="panel panel-pad">
      <div className="mono accent" style={{ fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>{heading}</div>

      {highlight && (
        <div style={{
          border: '1px solid var(--accent)', borderRadius: 4, padding: '14px 16px',
          marginBottom: paragraphs.length ? 14 : 0, background: 'rgba(54, 224, 192, 0.06)',
        }}>
          <p style={{ margin: 0, fontWeight: 700, lineHeight: 1.6, color: '#fff' }}>{highlight}</p>
        </div>
      )}

      {paragraphs.map((p, i) => (
        <p key={i} style={{ marginTop: i === 0 ? 0 : 12, marginBottom: 0, lineHeight: 1.6 }}>{p}</p>
      ))}
    </div>
  )
}
