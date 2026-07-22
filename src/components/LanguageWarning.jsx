import { useMemo } from 'react'
import { scanText } from '../lib/language'

// Advisory banner shown in editors when public copy contains flagged words.
// Non-blocking: it only informs the author. Pass any number of text strings.
export default function LanguageWarning({ texts = [], style }) {
  const hits = useMemo(() => scanText(...texts), [texts])
  if (!hits.length) return null
  const avoid = hits.filter((h) => h.level === 'avoid')
  return (
    <div
      className="panel panel-pad col"
      style={{ gap: 6, borderColor: avoid.length ? 'var(--hostile)' : 'var(--warn, #ffcf4a)', ...style }}
    >
      <div className="mono" style={{ fontSize: 11, letterSpacing: 1, color: avoid.length ? 'var(--hostile)' : '#ffcf4a' }}>
        ⚠ LANGUAGE CHECK — this is public-facing copy
      </div>
      <div className="col" style={{ gap: 3 }}>
        {hits.map((h) => (
          <div key={h.match} className="mono dim" style={{ fontSize: 11 }}>
            <span style={{ color: h.level === 'avoid' ? 'var(--hostile)' : '#ffcf4a' }}>“{h.match}”</span>
            {h.level === 'review' ? ' (review) ' : ' '}
            → consider <span className="accent">{h.suggest}</span>
          </div>
        ))}
      </div>
      <div className="mono dim" style={{ fontSize: 10 }}>
        Advisory only — you can still save. Edit the wording if it should not appear publicly.
      </div>
    </div>
  )
}
