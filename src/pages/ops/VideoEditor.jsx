import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useAudit } from '../../hooks/useAudit'
import { OpsHeader, useSaved } from './OperationsCentre'
import { Field } from './NarrativeEditor'
import SchedulePicker from '../../components/SchedulePicker'
import VideoEmbed, { resolveVideo } from '../../components/VideoEmbed'

// Home-page video, shown below the map. Edits live in `draft`; publishing copies
// the draft to `live` with a `publishAt` time. Nothing appears on the public
// site until something is deployed (live = null → the section is hidden).
export default function VideoEditor() {
  const { state, updateSlice } = useData()
  const audit = useAudit()
  const [saved, flash] = useSaved()
  const video = state.video || { draft: { url: '', title: '', caption: '' }, live: null, publishAt: null }
  const [draft, setDraft] = useState(video.draft || { url: '', title: '', caption: '' })
  const [scheduling, setScheduling] = useState(false)
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value })

  const saveDraft = () => { updateSlice('video', { ...video, draft }); audit('Saved home video draft'); flash('Draft saved') }
  const deployNow = () => { updateSlice('video', { draft, live: draft, publishAt: Date.now() }); audit('Deployed home video'); flash('Video is live on the site') }
  const scheduleDeploy = (ts) => {
    setScheduling(false)
    updateSlice('video', { draft, live: draft, publishAt: ts })
    audit('Scheduled home video', new Date(ts).toLocaleString())
    flash('Deploy scheduled')
  }
  const unpublish = () => { updateSlice('video', { ...video, draft, live: null, publishAt: null }); audit('Removed home video from site'); flash('Removed from site') }

  const status = () => {
    if (!video.live || !video.publishAt) return 'Not on the site'
    if (Date.now() >= video.publishAt) return `Live since ${new Date(video.publishAt).toLocaleString()}`
    return `Scheduled for ${new Date(video.publishAt).toLocaleString()}`
  }
  const preview = resolveVideo(draft.url)

  return (
    <div>
      <OpsHeader title="Home Video" sub="EDIT // BELOW THE MAP" updatedAt={state.contentMeta?.video?.updatedAt}>
        {video.live && <button className="danger ghost" onClick={unpublish}>Remove from site</button>}
      </OpsHeader>

      <div className="panel panel-pad col" style={{ marginBottom: 16, maxWidth: 640 }}>
        <Field label="Video URL (YouTube, Vimeo, or a direct .mp4 / .webm link)">
          <input value={draft.url} onChange={set('url')} placeholder="https://www.youtube.com/watch?v=…" />
        </Field>
        <Field label="Title (optional)"><input value={draft.title} onChange={set('title')} /></Field>
        <Field label="Caption (optional)"><textarea rows={2} value={draft.caption} onChange={set('caption')} /></Field>
        <div className="mono dim" style={{ fontSize: 11 }}>Status: <span className="accent">{status()}</span></div>
      </div>

      {draft.url && (
        <div className="panel panel-pad" style={{ marginBottom: 16, maxWidth: 640 }}>
          <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2, marginBottom: 8 }}>DRAFT PREVIEW</div>
          {preview ? <VideoEmbed url={draft.url} /> : <div className="hostile mono" style={{ fontSize: 12 }}>Couldn’t recognise this URL as a video.</div>}
        </div>
      )}

      <div className="row wrap" style={{ gap: 10 }}>
        <button onClick={saveDraft}>Save</button>
        <button className="primary" onClick={deployNow}>Save &amp; Deploy</button>
        <button onClick={() => setScheduling(true)}>Save &amp; Schedule deploy</button>
      </div>
      <div className="mono dim" style={{ fontSize: 10, marginTop: 8 }}>
        Save keeps a draft only (not on the site). Deploy publishes it below the map for everyone immediately. Schedule publishes it at a chosen time.
      </div>

      {scheduling && <SchedulePicker title="SCHEDULE DEPLOY" verb="deploy" onCancel={() => setScheduling(false)} onConfirm={scheduleDeploy} />}
    </div>
  )
}
