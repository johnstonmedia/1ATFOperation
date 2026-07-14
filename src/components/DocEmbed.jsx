// Resolves a document reference into something embeddable inline. Accepts:
//   - a repo-relative path (e.g. "docs/brief.pdf") served from the site's base
//     (put the file in public/docs/ and commit it),
//   - a direct file URL (e.g. a .pdf),
//   - a Google Drive / Google Docs share link (converted to an embed preview),
//   - an image URL.
export function resolveDoc(url) {
  if (!url || typeof url !== 'string') return null
  const raw = url.trim()
  if (!raw) return null

  // Repo-relative path -> served from the deployed base (public/ folder).
  if (!/^https?:\/\//i.test(raw)) {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '/')
    return { src: base + raw.replace(/^\//, ''), kind: /\.(png|jpe?g|gif|webp|svg)$/i.test(raw) ? 'image' : 'frame' }
  }

  try {
    const u = new URL(raw)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'drive.google.com') {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/)
      const id = m ? m[1] : u.searchParams.get('id')
      if (id) return { src: `https://drive.google.com/file/d/${id}/preview`, kind: 'frame' }
    }
    if (host === 'docs.google.com') {
      const m = u.pathname.match(/\/(document|presentation|spreadsheets)\/d\/([^/]+)/)
      if (m) return { src: `https://docs.google.com/${m[1]}/d/${m[2]}/preview`, kind: 'frame' }
    }
    if (/\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(u.pathname)) return { src: raw, kind: 'image' }
    return { src: raw, kind: 'frame' }
  } catch {
    return null
  }
}

export default function DocEmbed({ url, height = 560 }) {
  const d = resolveDoc(url)
  if (!d) return null
  if (d.kind === 'image') {
    return <img src={d.src} alt="Document" style={{ width: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--line)' }} />
  }
  return (
    <div style={{ position: 'relative', width: '100%', height, border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden', background: '#0a0f1a' }}>
      <iframe src={d.src} title="Activity document" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
    </div>
  )
}
