import { useData } from '../context/DataContext'
import { PageTitle } from './Profile'
import VideoEmbed from '../components/VideoEmbed'
import { DEFAULT_BRIEFINGS } from '../firebase/seed'

// Briefings tab: a video plus the numbered briefing sections (editable from
// Ops Centre → Briefings). Falls back to the default section text so a
// stored briefings doc saved before sections existed still shows content
// instead of an empty page.
export default function Briefings() {
  const { state } = useData()
  const b = state.briefings || {}
  const sections = b.sections?.length ? b.sections : DEFAULT_BRIEFINGS.sections
  const closingQuote = b.closingQuote ?? DEFAULT_BRIEFINGS.closingQuote

  return (
    <div className="container" style={{ padding: '24px 20px 60px', maxWidth: 900 }}>
      <PageTitle title="Briefings" sub="UNIT BRIEFINGS" />

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
