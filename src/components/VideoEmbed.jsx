// Renders whatever RHQ pasted into the Briefings video field:
//
//   - a watch/share link          youtube.com/watch?v=… , youtu.be/… , vimeo.com/…
//   - an EMBED URL                youtube.com/embed/… , player.vimeo.com/video/…
//   - a full EMBED CODE           <iframe src="…" …></iframe>  (Share → Embed)
//   - a Google Drive file link    drive.google.com/file/d/…/view
//   - a direct video file         .mp4/.webm/.ogg/.mov, or a Storage upload
//
// Everything resolves to one of { iframe, video, link }. Returns null for an
// empty or unusable value so callers can hide the box entirely.
//
// The raw pasted string is what gets STORED — including an iframe snippet — and
// it is re-resolved at render time. That keeps one signal we would otherwise
// lose: an embed code is RHQ explicitly saying "this thing is meant to be
// framed", which is what lets an unrecognised provider still embed instead of
// degrading to a link. We never inject the pasted HTML; only its src is read.

const IFRAME_SRC = /<iframe\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/i

// Pull the src out of a pasted <iframe …> embed code. Returns null when the
// string is not an embed snippet, so callers can tell the two cases apart.
export function embedSrcFrom(raw) {
  if (!raw || typeof raw !== 'string' || !/<iframe\b/i.test(raw)) return null
  const m = raw.match(IFRAME_SRC)
  if (!m) return null
  // Embed codes are HTML, so their query separators arrive escaped; and some
  // providers still hand out protocol-relative srcs.
  let src = m[1].trim().replace(/&amp;/g, '&')
  if (src.startsWith('//')) src = `https:${src}`
  return src || null
}

const iframe = (src) => ({ type: 'iframe', src })

export function resolveVideo(input) {
  if (!input || typeof input !== 'string') return null
  const embedded = embedSrcFrom(input)
  let u
  try { u = new URL((embedded || input).trim()) } catch { return null }

  // Only ever hand http(s) (or our own blob: previews) to an <iframe>/<video>.
  // A javascript: or data: src inside a pasted embed code would otherwise run
  // in this page's origin — the one genuinely dangerous thing a paste can carry.
  if (!['http:', 'https:', 'blob:'].includes(u.protocol)) return null

  const host = u.hostname.replace(/^www\./, '')
  const seg = u.pathname.split('/').filter(Boolean)

  // YouTube, in every shape it hands out.
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const v = u.searchParams.get('v')
    if (v) return iframe(`https://www.youtube.com/embed/${v}`)
    // Already an embed URL (Share → Embed, or the src of a pasted iframe):
    // keep it as-is, so its parameters (start time, no-cookie host…) survive.
    if (seg[0] === 'embed' && seg[1]) return iframe(u.href)
    if ((seg[0] === 'shorts' || seg[0] === 'live') && seg[1]) return iframe(`https://www.youtube.com/embed/${seg[1]}`)
  }
  if (host === 'youtu.be' && seg[0]) return iframe(`https://www.youtube.com/embed/${seg[0]}`)

  if (host === 'player.vimeo.com') return iframe(u.href)
  if (host === 'vimeo.com' && /^\d+$/.test(seg[0] || '')) {
    // vimeo.com/<id> or, for an unlisted video, vimeo.com/<id>/<hash> — the
    // hash has to travel as ?h= or the embed is refused.
    return iframe(`https://player.vimeo.com/video/${seg[0]}${seg[1] ? `?h=${seg[1]}` : ''}`)
  }

  // Google Drive share links. The /view page cannot be framed; /preview is the
  // embeddable form of the same file.
  if (host === 'drive.google.com' && seg[0] === 'file' && seg[1] === 'd' && seg[2]) {
    return iframe(`https://drive.google.com/file/d/${seg[2]}/preview`)
  }

  // Videos uploaded through the Ops Centre drop zone. The filename (and so the
  // extension) is inside the escaped object path, and a file may carry no
  // extension at all, so match the host rather than the path.
  if (host === 'firebasestorage.googleapis.com' || host === 'storage.googleapis.com') {
    return { type: 'video', src: u.href }
  }
  // blob: URLs from a LOCAL MODE upload preview — new URL() keeps the whole
  // object id in `pathname`, with no extension to test.
  if (u.protocol === 'blob:') return { type: 'video', src: u.href }
  if (/\.(mp4|webm|ogg|ogv|mov|m4v)(\?.*)?$/i.test(u.pathname)) return { type: 'video', src: u.href }

  // Unrecognised provider, but RHQ pasted an embed code — that IS the
  // instruction to frame it. Covers SharePoint, Stream, Canva, Facebook and
  // anything else the unit is handed, without keeping a list of hosts current.
  if (embedded) return iframe(u.href)

  return { type: 'link', src: u.href }
}

export default function VideoEmbed({ url }) {
  const v = resolveVideo(url)
  if (!v) return null
  if (v.type === 'link') {
    return <a href={v.src} target="_blank" rel="noreferrer" className="accent mono" style={{ fontSize: 13 }}>Open video ↗</a>
  }
  return (
    <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      {v.type === 'iframe' ? (
        <iframe
          src={v.src}
          title="Video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        />
      ) : (
        <video src={v.src} controls style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
      )}
    </div>
  )
}
