import { useState } from 'react'
import { useData } from '../context/DataContext'
import { useCompany } from '../context/CompanyContext'
import { COMPANIES, PHONETIC } from '../firebase/seed'
import DocEmbed from '../components/DocEmbed'
import { PageTitle } from './Profile'

const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean)
const norm = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/gi, '')

// Public, no-login page: a cadet picks their company and decrypts intel
// fragments RHQ/COY have set (info about upcoming camp activities).
export default function Intel() {
  const { state } = useData()
  const { company, setCompany } = useCompany()
  const [open, setOpen] = useState(null)
  const fragments = (state.intel || []).filter((f) => f.company === company)

  if (open) return <FragmentView fragment={open} onBack={() => setOpen(null)} />

  return (
    <div className="container" style={{ padding: '24px 20px' }}>
      <PageTitle title="Intel" sub="DECRYPT // UPCOMING CAMP ACTIVITIES" />
      <div className="panel panel-pad col" style={{ gap: 8, marginBottom: 16, maxWidth: 420 }}>
        <label>Your company</label>
        <select value={company} onChange={(e) => setCompany(e.target.value)}>
          <option value="">— Select your company —</option>
          {COMPANIES.map((c) => <option key={c.letter} value={c.letter}>{c.name}</option>)}
        </select>
      </div>

      {!company && <div className="panel panel-pad mono dim" style={{ fontSize: 13 }}>Choose your company above to see its intel.</div>}
      {company && fragments.length === 0 && (
        <div className="panel panel-pad mono dim" style={{ fontSize: 13 }}>No intel for {PHONETIC[company] || company} yet — check back before camp.</div>
      )}
      <div className="col" style={{ gap: 12 }}>
        {fragments.map((f) => (
          <div key={f.id} className="panel panel-pad row between center wrap" style={{ gap: 12 }}>
            <div>
              <div className="head" style={{ fontSize: 15 }}>{f.title || 'Encrypted fragment'}</div>
              <div className="mono dim" style={{ fontSize: 11 }}>{PHONETIC[f.company] || f.company} · encrypted</div>
            </div>
            <button className="primary" onClick={() => setOpen(f)}>Decrypt</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function FragmentView({ fragment: f, onBack }) {
  const [ans, setAns] = useState([])
  const [checked, setChecked] = useState(false)
  const ws = words(f.answer)
  const allRight = ws.length > 0 && ws.every((w, i) => norm(ans[i]) === norm(w))
  const solved = checked && allRight
  const setWord = (i, v) => { const a = [...ans]; a[i] = v; setAns(a) }

  return (
    <div className="container" style={{ padding: '24px 20px', maxWidth: 1000 }}>
      <button className="ghost" onClick={onBack} style={{ marginBottom: 14 }}>← All intel</button>
      <div className="row wrap" style={{ gap: 18, alignItems: 'flex-start' }}>
        <div className="panel panel-pad grow" style={{ minWidth: 320 }}>
          <h1 style={{ marginTop: 0, fontSize: 22 }}>{f.title || 'Encrypted fragment'}</h1>
          {f.prompt && (
            <div className="mono" style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, background: 'rgba(0,0,0,0.25)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 12, margin: '10px 0' }}>{f.prompt}</div>
          )}
          {f.docUrl && <div style={{ margin: '12px 0' }}><DocEmbed url={f.docUrl} /></div>}

          {ws.length > 0 && (
            <>
              <div className="mono dim" style={{ fontSize: 11, letterSpacing: 2, margin: '14px 0 6px' }}>ENTER DECRYPTED INTEL</div>
              <div className="row wrap" style={{ gap: 8 }}>
                {ws.map((w, i) => {
                  const val = ans[i] || ''
                  const ok = checked && norm(val) === norm(w)
                  const bad = checked && !ok
                  return (
                    <input key={i} value={val} onChange={(e) => !solved && setWord(i, e.target.value)} className="mono"
                      style={{ width: `${Math.max(w.length + 2, 5)}ch`, borderColor: ok ? 'var(--accent)' : bad ? 'var(--hostile)' : 'var(--line)' }}
                      placeholder={'•'.repeat(w.length)} />
                  )
                })}
              </div>
              <div className="row center" style={{ gap: 12, marginTop: 14 }}>
                {solved ? <span className="accent head">DECRYPTED ✓</span> : <button className="primary" onClick={() => setChecked(true)}>Enter intel</button>}
                {checked && !allRight && <span className="hostile mono" style={{ fontSize: 12 }}>Some words are off — adjust and try again.</span>}
              </div>
            </>
          )}

          {(solved || ws.length === 0) && f.reveal && (
            <div className="panel panel-pad" style={{ marginTop: 14, borderColor: 'var(--accent)' }}>
              <div className="mono accent" style={{ fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>INTEL</div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>{f.reveal}</div>
            </div>
          )}
        </div>

        {(f.resources || []).length > 0 && (
          <div className="panel panel-pad" style={{ width: 280, maxWidth: '100%' }}>
            <div className="mono dim" style={{ fontSize: 10, letterSpacing: 2, marginBottom: 10 }}>RESOURCES</div>
            <div className="col" style={{ gap: 12 }}>
              {f.resources.map((r) => (
                <div key={r.id}>
                  {r.type === 'image'
                    ? <><img src={r.url} alt={r.title} style={{ width: '100%', borderRadius: 4, border: '1px solid var(--line)' }} /><div className="mono dim" style={{ fontSize: 10, marginTop: 4 }}>{r.title}</div></>
                    : <a href={r.url} target="_blank" rel="noreferrer" className="accent mono" style={{ fontSize: 12 }}>🔗 {r.title}</a>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
