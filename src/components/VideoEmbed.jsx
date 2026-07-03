// Renders a video URL: YouTube / Vimeo become responsive iframes, direct video
// files (.mp4/.webm/.ogg) use a <video> player, anything else falls back to a
// plain link. Returns null for an empty/invalid URL so callers can hide the box.
export function resolveVideo(url) {
  if (!url || typeof url !== 'string') return null
  let u
  try { u = new URL(url.trim()) } catch { return null }
  const host = u.hostname.replace(/^www\./, '')
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const v = u.searchParams.get('v')
    if (v) return { type: 'iframe', src: `https://www.youtube.com/embed/${v}` }
  }
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1)
    if (id) return { type: 'iframe', src: `https://www.youtube.com/embed/${id}` }
  }
  if (host === 'vimeo.com') {
    const id = u.pathname.split('/').filter(Boolean)[0]
    if (id) return { type: 'iframe', src: `https://player.vimeo.com/video/${id}` }
  }
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u.pathname)) return { type: 'video', src: u.href }
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
