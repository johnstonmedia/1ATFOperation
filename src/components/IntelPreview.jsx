import { FragmentView } from '../pages/Intel'

// "Preview as a recruit" for the intel editors (RHQ's Intercepted Intelligence
// and the COY Centre).
//
// Renders the ACTUAL cadet-facing component against the unsaved draft rather
// than a mock — a separate approximation would drift from the real page the
// first time either side changed, and the thing most worth checking before
// publishing (how many answer boxes the solution produces, and whether the
// prompt/resources/hint read sensibly together) is exactly what a mock would
// get subtly wrong.
//
// FragmentView's `preview` flag keeps this inert: solving it here records no
// progress and fires no telemetry, so an author testing their own puzzle can't
// move the counters RHQ reads.
export default function IntelPreview({ fragment, onBack, backLabel = '← Back to editor' }) {
  return (
    <div>
      <div className="panel panel-pad row between center wrap" style={{
        gap: 10, marginBottom: 4, borderColor: 'var(--warn)', background: 'rgba(255,207,74,0.07)',
      }}>
        <div className="mono" style={{ fontSize: 12, color: 'var(--warn)' }}>
          PREVIEW — this is exactly what a recruit sees. Nothing here is saved, and solving it
          records no progress.
        </div>
        <button className="ghost" onClick={onBack}>{backLabel}</button>
      </div>
      <FragmentView fragment={fragment} preview onBack={onBack} backLabel={backLabel} />
    </div>
  )
}
