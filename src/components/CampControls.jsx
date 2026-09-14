import { campDays, overallProgress, LAST_DAY } from '../lib/campPlan'
import { PHONETIC } from '../firebase/seed'

// The camp progress control: whose progress, and how far through camp.
//
// TWO VIEWS, one set of data (see lib/campPlan.js):
//   UNIT     every company's progress together. A zone shared by three
//            companies reads 33% when one of them has been through it.
//   COMPANY  only the visitor's own company, and only the zones they are
//            actually sent to. A zone is then simply done or not.
//
// The company comes from the boot gate the visitor already answered for intel
// scoping, so there is no second picker. Someone who skipped the gate only
// gets the unit view, and is told why rather than shown a dead button.
//
// DAY 0 is the blank board — camp hasn't started. Day N means everything up to
// the end of that day has happened. Because the whole plan is known in advance
// this needs no recording during camp: move the day on and the map is right.
export default function CampControls({ mapId, day, onDay, mode, onMode, company, dayFromReplay = false }) {
  const days = campDays(mapId)
  if (!days.length) return null
  const last = LAST_DAY(mapId)
  const co = mode === 'company' ? company : null
  const overall = overallProgress(mapId, day, co)
  const coName = company ? (PHONETIC[company] || company) : ''

  return (
    <div className="panel panel-pad col" style={{ gap: 10, marginTop: 10 }}>
      <div className="row between center wrap" style={{ gap: 10 }}>
        <div className="row center wrap" style={{ gap: 8 }}>
          <span className="tag">CAMP PROGRESS</span>
          <button className={mode === 'unit' ? 'primary' : 'ghost'} onClick={() => onMode('unit')}
            style={{ padding: '2px 12px', fontSize: 11 }}>UNIT</button>
          <button
            className={mode === 'company' ? 'primary' : 'ghost'}
            onClick={() => company && onMode('company')}
            disabled={!company}
            title={company ? `Only ${coName}'s own activities` : 'Choose your company in the nav to see this'}
            style={{ padding: '2px 12px', fontSize: 11, opacity: company ? 1 : 0.45 }}
          >
            {company ? `${coName.toUpperCase()} ONLY` : 'MY COMPANY'}
          </button>
        </div>
        <span className="mono" style={{ fontSize: 12, letterSpacing: 1 }}>
          <span style={{ color: 'var(--accent)' }}>{overall.pct}%</span>
          <span className="dim"> — {overall.done} of {overall.total} activities{mode === 'company' ? ` for ${coName}` : ''}</span>
        </span>
      </div>

      {/* When the replay's frames ARE the camp days, the timeline rail above
          is already the day control — a second set of buttons here would be a
          rival clock showing a different answer. Report the day instead. */}
      {dayFromReplay ? (
        <div className="row center wrap" style={{ gap: 8 }}>
          <span className="mono dim" style={{ fontSize: 11, letterSpacing: 1 }}>SHOWING</span>
          <span className="mono" style={{ fontSize: 12, color: 'var(--accent)', letterSpacing: 1 }}>
            {day === 0 ? 'CAMP START' : `DAY ${day}`}
          </span>
          <span className="mono dim" style={{ fontSize: 10 }}>
            {day === 0 ? 'camp has not started' : `${days.find((d) => d.n === day)?.date || ''} — use the replay timeline above to move through camp`}
          </span>
        </div>
      ) : (
      <div className="row center wrap" style={{ gap: 6 }}>
        <span className="mono dim" style={{ fontSize: 11, letterSpacing: 1 }}>THROUGH</span>
        <button className={day === 0 ? 'primary' : 'ghost'} onClick={() => onDay(0)}
          title="Before camp — the blank board"
          style={{ padding: '2px 10px', fontSize: 11 }}>START</button>
        {days.map((d) => (
          <button key={d.n} className={day === d.n ? 'primary' : 'ghost'} onClick={() => onDay(d.n)}
            title={d.date} style={{ padding: '2px 10px', fontSize: 11 }}>
            DAY {d.n}
          </button>
        ))}
        <span className="mono dim" style={{ fontSize: 10, marginLeft: 4 }}>
          {day === 0 ? 'Camp has not started' : `${days.find((d) => d.n === day)?.date || ''}${day === last ? ' — end of camp' : ''}`}
        </span>
      </div>
      )}
    </div>
  )
}
