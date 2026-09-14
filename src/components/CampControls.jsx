import { campDays, overallProgress, LAST_DAY } from '../lib/campPlan'

// How far through camp the map is showing, and how much of the plan that is.
//
// ONE MAP, THE UNIT'S. A zone shared by three companies reads 33% when one of
// them has been through it, and 100% — 1ATF's — once all three have. A
// per-company view of the same camp existed briefly and was removed: six cuts
// of one dataset is six things to keep straight, and showing a cadet only
// their own company's ground worked against the thing the map is for.
//
// DAY 0 is the blank board — camp hasn't started. Day N means everything up to
// the end of that day has happened. Because the whole plan is known in advance
// this needs no recording during camp: move the day on and the map is right.
export default function CampControls({ mapId, day, onDay, dayFromReplay = false }) {
  const days = campDays(mapId)
  if (!days.length) return null
  const last = LAST_DAY(mapId)
  const overall = overallProgress(mapId, day)

  return (
    <div className="panel panel-pad col" style={{ gap: 10, marginTop: 10 }}>
      <div className="row between center wrap" style={{ gap: 10 }}>
        <div className="row center wrap" style={{ gap: 8 }}>
          <span className="tag">CAMP PROGRESS</span>
        </div>
        <span className="mono" style={{ fontSize: 12, letterSpacing: 1 }}>
          <span style={{ color: 'var(--accent)' }}>{overall.pct}%</span>
          <span className="dim"> — {overall.done} of {overall.total} activities</span>
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
