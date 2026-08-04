// Glowing map marker. This is the marker that has always sat on Marrangaroo
// and Singleton (an expanding ping ring behind a glowing dot) — lifted out of
// PixelMap's inline JSX into one component so place labels, occupier
// indicators and the recaptured-stronghold state all share it.
//
// Owns its own positioning (rather than being centred as a flex row by its
// caller): the dot is pinned exactly to (x, y) via its own transform, and the
// name/tag flow to the right from a separately-positioned span. Previously
// the whole row — dot, name, tag — was centred as one block, so the dot's
// apparent position on the map drifted depending on how long the name/tag
// text next to it was; two places at the same coordinates could show their
// dot in different spots. Pinning the dot independently keeps it exactly
// under the point it represents no matter what the label says.
//
// Props:
//   x, y, cols, rows   grid position (place.x/y and the territory grid size).
//   color        dot + glow colour. Falsy = the plain neutral marker.
//   pulse        draw the expanding ping ring behind the dot (strongholds).
//   label        the place name.
//   tag          optional occupier text shown beside the name ('Alpha', '1ATF'…).
//   tagColor     colour for that tag (defaults to `color`).
//   variant      'plain' (default) | 'boxed' — boxed frames the tag in its own
//                colour, used to make the recaptured-stronghold state
//                visually distinct from an ordinary occupier tag.
//   draggable    when true, the marker accepts pointer-down (for the map
//                editor's drag-to-move) and shows a move cursor.
//   onPointerDown  handler wired up only when draggable is true.
export default function Beacon({
  x,
  y,
  cols,
  rows,
  color,
  pulse = false,
  label,
  tag,
  tagColor,
  variant = 'plain',
  draggable = false,
  onPointerDown,
}) {
  const dot = color || '#dfe6f2'
  const tagCol = tagColor || dot

  return (
    <div
      onPointerDown={draggable ? onPointerDown : undefined}
      style={{
        position: 'absolute',
        left: `${(x / cols) * 100}%`,
        top: `${(y / rows) * 100}%`,
        pointerEvents: draggable ? 'auto' : 'none',
        cursor: draggable ? 'move' : 'default',
      }}
    >
      {/* The marker dot — pinned exactly to the point, independent of the
          label/tag width beside it. */}
      <span style={{ position: 'absolute', left: 0, top: 0, transform: 'translate(-50%,-50%)' }}>
        {pulse ? (
          <span style={{ position: 'relative', width: 16, height: 16, display: 'block' }}>
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
            display: 'block',
          }} />
        )}
      </span>

      {/* Name + occupier tag, flowing right from the pinned point — never
          moves the dot above. */}
      <span style={{
        position: 'absolute', left: 8, top: 0, transform: 'translateY(-50%)',
        display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
      }}>
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
      </span>
    </div>
  )
}
