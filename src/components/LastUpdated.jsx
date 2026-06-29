// Small "last updated <time>" line. Shows when operational content was last
// saved (by RHQ), so members can trust how fresh what they're seeing is.
export function formatUpdated(ts) {
  return ts ? new Date(ts).toLocaleString() : '—'
}

export default function LastUpdated({ ts, label = 'Last updated', style }) {
  return (
    <span className="mono dim" style={{ fontSize: 10, ...style }}>
      {label}: {formatUpdated(ts)}
    </span>
  )
}
