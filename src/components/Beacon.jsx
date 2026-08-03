// Glowing map marker. This is the marker that has always sat on Marrangaroo
// and Singleton (an expanding ping ring behind a glowing dot) — lifted out of
// PixelMap's inline JSX into one component so place labels, occupier
// indicators and the recaptured-stronghold state all share it.
//
// Props:
//   color     dot + glow colour. Falsy = the plain neutral marker.
//   pulse     draw the expanding ping ring behind the dot (strongholds).
//   label     the place name.
//   tag       optional occupier text shown beside the name ('Alpha', 'SCU'…).
//   tagColor  colour for that tag (defaults to `color`).
//   variant   'plain' (default) | 'boxed' — boxed frames the tag in its own
//             colour, used to make the recaptured-stronghold "SCU" state
//             visually distinct from an ordinary occupier tag.
export default function Beacon({
  color,
  pulse = false,
  label,
  tag,
  tagColor,
  variant = 'plain',
}) {
  const dot = color || '#dfe6f2'
  const tagCol = tagColor || dot

  return (
    <>
      {pulse ? (
        <span style={{ position: 'relative', width: 16, height: 16, flex: '0 0 auto' }}>
          {/* .ping-ring inherits currentColor so one ring style serves every faction */}
          <span className="ping-ring" style={{ color: dot, background: dot }} />
          <span style={{
            position: 'absolute', inset: 3, borderRadius: '50%', background: dot,
            boxShadow: `0 0 10px ${dot}, 0 0 18px ${dot}`,
          }} />
        </span>
      ) : (
        <span style={{
          width: color ? 9 : 7, height: color ? 9 : 7, borderRadius: '50%', background: dot,
          boxShadow: `0 0 6px ${dot}${color ? `, 0 0 12px ${dot}` : ''}`,
          display: 'inline-block', flex: '0 0 auto',
        }} />
      )}

      <span style={{
        color: '#d3dced', fontWeight: 600, font: "600 11px 'JetBrains Mono',monospace",
        textShadow: '0 1px 3px #000',
      }}>{label}</span>

      {tag && (
        <span style={{
          font: "700 10px 'JetBrains Mono',monospace",
          letterSpacing: 1,
          color: variant === 'boxed' ? '#fff' : tagCol,
          borderRadius: 3,
          padding: '1px 5px',
          // Both variants get a dark chip so the tag stays legible over the
          // hatch fill; the recaptured state is set apart by its glowing
          // border and white text.
          background: 'rgba(6,10,18,0.78)',
          ...(variant === 'boxed'
            ? { border: `1px solid ${tagCol}`, boxShadow: `0 0 8px ${tagCol}66` }
            : { border: '1px solid transparent' }),
        }}>{tag.toUpperCase()}</span>
      )}
    </>
  )
}
