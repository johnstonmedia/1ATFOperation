import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useAudit } from '../../hooks/useAudit'
import { OpsHeader, useSaved } from './OperationsCentre'
import { Field } from './NarrativeEditor'
import VideoEmbed from '../../components/VideoEmbed'

// Editor for the recruit-facing Briefings tab: a video link + a content area.
export default function BriefingsEditor() {
  const { state, updateSlice } = useData()
  const audit = useAudit()
  const [saved, flash] = useSaved()
  const [b, setB] = useState(state.briefings || { video: '', content: '' })
  const set = (k) => (e) => setB({ ...b, [k]: e.target.value })

  const save = () => { updateSlice('briefings', b); audit('Updated briefings'); flash() }

  return (
    <div>
      <OpsHeader title="Briefings" sub="EDIT // BRIEFINGS TAB" updatedAt={state.contentMeta?.briefings?.updatedAt}>
        <button className="primary" onClick={save}>{saved ? 'Saved ✓' : 'Save'}</button>
      </OpsHeader>
      <div className="panel panel-pad col" style={{ maxWidth: 720 }}>
        <Field label="Video link (YouTube, Vimeo, or a direct .mp4)"><input value={b.video} onChange={set('video')} placeholder="https://…" /></Field>
        {b.video.trim() && <VideoEmbed url={b.video} />}
        <Field label="Content (left blank for now — add material later)">
          <textarea rows={6} value={b.content} onChange={set('content')} placeholder="Briefing content to be added later…" />
        </Field>
      </div>
    </div>
  )
}
