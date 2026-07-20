import { useData } from '../context/DataContext'
import { PageTitle } from './Profile'
import VideoEmbed from '../components/VideoEmbed'

// Briefings tab: a video and a (currently empty) content area for later.
export default function Briefings() {
  const { state } = useData()
  const b = state.briefings || {}
  return (
    <div className="container" style={{ padding: '24px 20px', maxWidth: 900 }}>
      <PageTitle title="Briefings" sub="UNIT BRIEFINGS" />
      {b.video
        ? <div className="panel panel-pad" style={{ marginBottom: 18 }}><VideoEmbed url={b.video} /></div>
        : <div className="panel panel-pad mono dim" style={{ fontSize: 13, marginBottom: 18 }}>No briefing video yet.</div>}
      {b.content && (
        <div className="panel panel-pad" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{b.content}</div>
      )}
    </div>
  )
}
