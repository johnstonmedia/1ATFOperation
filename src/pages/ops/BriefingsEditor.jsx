import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useAudit } from '../../hooks/useAudit'
import { useConfirm } from '../../context/ConfirmContext'
import { OpsHeader, useSaved } from './OperationsCentre'
import { Field } from './NarrativeEditor'
import VideoEmbed from '../../components/VideoEmbed'
import { DEFAULT_BRIEFINGS } from '../../firebase/seed'

// Editor for the recruit-facing Briefings tab: a video link, the numbered
// briefing sections (title + optional highlighted callout + body), and a
// closing quote.
export default function BriefingsEditor() {
  const { state, updateSlice } = useData()
  const audit = useAudit()
  const confirm = useConfirm()
  const [saved, flash] = useSaved()
  const [b, setB] = useState(() => {
    const stored = state.briefings || {}
    return {
      video: stored.video || '',
      sections: stored.sections?.length ? stored.sections : DEFAULT_BRIEFINGS.sections,
      closingQuote: stored.closingQuote ?? DEFAULT_BRIEFINGS.closingQuote,
    }
  })

  const set = (k) => (e) => setB({ ...b, [k]: e.target.value })
  const setSection = (i, k) => (e) => {
    const sections = b.sections.map((s, idx) => (idx === i ? { ...s, [k]: e.target.value } : s))
    setB({ ...b, sections })
  }

  const save = () => { updateSlice('briefings', b); audit('Updated briefings'); flash() }

  // Load the repo's current default briefing text into the editor. Needed
  // because a stored Firestore doc always overrides the seed, so updating the
  // narrative in the repo otherwise never reaches the live site. Loads into
  // the form only — nothing is published until Save is pressed.
  const loadDefaults = async () => {
    const ok = await confirm({
      title: 'Load default briefing text',
      message: 'Replace the sections and closing quote in this editor with the unit narrative shipped in the app? Your video link is kept, and nothing is published until you press Save.',
      confirmLabel: 'Load text',
    })
    if (!ok) return
    setB((cur) => ({
      video: cur.video,
      sections: structuredClone(DEFAULT_BRIEFINGS.sections),
      closingQuote: DEFAULT_BRIEFINGS.closingQuote,
    }))
  }

  return (
    <div>
      <OpsHeader title="Briefings" sub="EDIT // BRIEFINGS TAB" updatedAt={state.contentMeta?.briefings?.updatedAt}>
        <button className="ghost" onClick={loadDefaults} title="Replace the text below with the unit narrative shipped in the app (review, then Save)">
          Load default text
        </button>
        <button className="primary" onClick={save}>{saved ? 'Saved ✓' : 'Save'}</button>
      </OpsHeader>

      <div className="panel panel-pad col" style={{ maxWidth: 720, marginBottom: 18 }}>
        <Field label="Video link (YouTube, Vimeo, or a direct .mp4)"><input value={b.video} onChange={set('video')} placeholder="https://…" /></Field>
        {b.video.trim() && <VideoEmbed url={b.video} />}
      </div>

      {b.sections.map((s, i) => (
        <div className="panel panel-pad col" style={{ maxWidth: 720, marginBottom: 18 }} key={i}>
          <Field label="Section heading"><input value={s.heading} onChange={setSection(i, 'heading')} /></Field>
          {'highlight' in s && (
            <Field label="Highlighted callout (bold, shown above the body text)">
              <textarea rows={3} value={s.highlight || ''} onChange={setSection(i, 'highlight')} />
            </Field>
          )}
          <Field label="Body text (leave a blank line between paragraphs)">
            <textarea rows={6} value={s.body || ''} onChange={setSection(i, 'body')} />
          </Field>
        </div>
      ))}

      <div className="panel panel-pad col" style={{ maxWidth: 720 }}>
        <Field label="Closing quote"><input value={b.closingQuote} onChange={set('closingQuote')} /></Field>
      </div>
    </div>
  )
}
