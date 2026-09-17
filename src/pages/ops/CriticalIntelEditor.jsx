import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useAudit } from '../../hooks/useAudit'
import { useConfirm } from '../../context/ConfirmContext'
import { OpsHeader, useSaved } from './OperationsCentre'
import { Field } from './NarrativeEditor'
import VideoDropZone from '../../components/VideoDropZone'
import SchedulePicker from '../../components/SchedulePicker'
import { DEFAULT_CRITICAL_INTEL } from '../../firebase/seed'
import { hasContent, isCritical, isPublished, statusOf } from '../../lib/criticalIntel'

// CRITICAL INTEL — the only thing RHQ can publish that interrupts a visitor.
// Its own section rather than a second panel inside Briefings, because a
// section here edits exactly one slice (Map: Territory is the one documented
// exception) and this is a different slice with a different publishing model.
//
// ⚠️ SAVE AND PUBLISH ARE DIFFERENT ACTIONS, and that is the point.
//
//   SAVE           writes the words and the video, leaving publishedAt alone.
//                  A typo fixed after the fact does NOT re-alert the hundred
//                  cadets who already watched it.
//   PUBLISH ALERT  stamps publishedAt with now and asks when the alert should
//                  END. That new stamp is what makes every device — including
//                  ones that dismissed the previous alert — get interrupted
//                  again. Pressing it a second time is therefore a deliberate
//                  re-alert, not a no-op.
//   STAND DOWN     ends the window immediately. The item stays on the
//                  Briefings tab; it just stops interrupting.
//
// See lib/criticalIntel.js for the three states these produce.
export default function CriticalIntelEditor() {
  const { state, updateSlice } = useData()
  const audit = useAudit()
  const confirm = useConfirm()
  const [saved, flash] = useSaved()
  const stored = state.criticalIntel || DEFAULT_CRITICAL_INTEL
  const [form, setForm] = useState(() => ({
    video: stored.video || '',
    videoPath: stored.videoPath || '',
    title: stored.title ?? DEFAULT_CRITICAL_INTEL.title,
    body: stored.body || '',
  }))
  const [picking, setPicking] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  // The stored publishing state always comes from the slice, never from the
  // form — the form holds the CONTENT, the slice holds whether and until when
  // it is shouting.
  const write = (extra) => updateSlice('criticalIntel', {
    ...stored, ...form, ...extra,
  })

  const save = () => {
    write({})
    audit('Updated critical intel')
    flash()
  }

  const publish = (alertUntil) => {
    setPicking(false)
    const publishedAt = Date.now()
    write({ publishedAt, alertUntil })
    audit(`Published critical intel alert until ${new Date(alertUntil).toLocaleString()}`)
    flash()
  }

  const standDown = async () => {
    const ok = await confirm({
      title: 'End the alert now',
      message: 'Stop interrupting visitors with this message? It stays on the Briefings tab — it just stops popping up.',
      confirmLabel: 'End alert',
    })
    if (!ok) return
    write({ alertUntil: Date.now() })
    audit('Stood down critical intel alert')
    flash()
  }

  const remove = async () => {
    const ok = await confirm({
      title: 'Remove critical intel',
      message: 'Delete the video, the message and the alert entirely? It disappears from the Briefings tab too.',
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    updateSlice('criticalIntel', structuredClone(DEFAULT_CRITICAL_INTEL))
    setForm({ video: '', videoPath: '', title: DEFAULT_CRITICAL_INTEL.title, body: '' })
    audit('Removed critical intel')
    flash()
  }

  // Status describes what is STORED, so an unsaved edit in the form can never
  // make the panel claim something is live that isn't.
  const status = statusOf(stored)
  const live = isCritical(stored)
  const published = isPublished(stored)
  const ready = hasContent(form)

  return (
    <div>
      <OpsHeader title="Critical Intel" sub="EDIT // PRIORITY TRANSMISSION" updatedAt={state.contentMeta?.criticalIntel?.updatedAt}>
        {live && <button className="ghost" onClick={standDown} title="Stop the pop-up; keep it on the Briefings tab">End alert now</button>}
        {(published || hasContent(stored)) && <button className="ghost danger" onClick={remove}>Remove</button>}
        <button className="ghost" onClick={save} disabled={!ready} title="Save the wording without alerting anyone again">
          {saved ? 'Saved ✓' : 'Save'}
        </button>
        <button className="primary" onClick={() => setPicking(true)} disabled={!ready}>
          {published ? 'Re-publish alert' : 'Publish alert'}
        </button>
      </OpsHeader>

      <div className="panel panel-pad col" style={{ maxWidth: 720, marginBottom: 18, gap: 10, borderColor: live ? 'var(--hostile)' : undefined }}>
        <div className={`mono ${status.tone}`} style={{ fontSize: 12, lineHeight: 1.6 }}>{status.text}</div>
        <div className="mono dim" style={{ fontSize: 11, lineHeight: 1.7 }}>
          While the alert is running, this takes over the screen for anyone opening the portal —
          once per device, dismissed with one button. After the window closes it stays on the
          <strong> Briefings</strong> tab alongside the ordinary briefing video, so nobody who missed
          it is stuck.
          <br />
          <strong>Save</strong> changes the wording without alerting anyone again.
          <strong> Re-publish</strong> deliberately does alert everyone again, including cadets who
          already dismissed it.
        </div>
      </div>

      <div className="panel panel-pad col" style={{ maxWidth: 720, marginBottom: 18 }}>
        <VideoDropZone
          value={form.video}
          path={form.videoPath}
          onChange={(video, meta) => setForm((f) => ({ ...f, video, videoPath: meta?.path || '' }))}
          folder="critical-intel"
          label="Critical intel video"
        />
      </div>

      <div className="panel panel-pad col" style={{ maxWidth: 720 }}>
        <Field label="Headline">
          <input value={form.title} onChange={set('title')} placeholder="CRITICAL INTEL" />
        </Field>
        <Field label="Message (optional — leave a blank line between paragraphs)">
          <textarea rows={5} value={form.body} onChange={set('body')} />
        </Field>
        {!ready && (
          <div className="mono dim" style={{ fontSize: 11 }}>
            Add a video or a message before publishing — a headline on its own has nothing to say.
          </div>
        )}
      </div>

      {picking && (
        <SchedulePicker
          title="END THE ALERT"
          verb="end"
          onCancel={() => setPicking(false)}
          onConfirm={publish}
        />
      )}
    </div>
  )
}
