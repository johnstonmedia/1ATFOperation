import { useState, useEffect, useCallback, useRef } from 'react'
import { useData } from '../context/DataContext'
import { markIntelSeen } from '../hooks/useUnseen'
import { useCompany } from '../context/CompanyContext'
import { COMPANIES, PHONETIC } from '../firebase/seed'
import { decryptProgress, isSolved, markSolved } from '../lib/intelProgress'
import DocEmbed from '../components/DocEmbed'
import { PageTitle } from './Profile'

const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean)
const norm = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/gi, '')

// Answer-box sizing. MIN_BOX_CH is the resting width in characters — uniform
// across every box, so an empty row gives nothing away about word lengths.
// BOX_PAD covers the input's own side padding + border, which a `ch` width
// would otherwise eat into (see the note at the style block below).
const MIN_BOX_CH = 6
const BOX_PAD = 28

// Public, no-login: unit-wide RHQ intelligence + your company's intelligence.
export default function Intel() {
  const { state } = useData()
  const { company, setCompany } = useCompany()
  const [open, setOpen] = useState(null)
  // Solves live in localStorage, so React needs a nudge to re-read them when
  // one lands. The counter's value is never read — bumping it is purely a
  // re-render trigger for the meter and the list's decrypted ticks.
  const [, bumpSolves] = useState(0)
  const onSolved = useCallback(() => bumpSolves((n) => n + 1), [])
  const intro = state.intelIntro || {}
  const all = state.intel || []
  const rhqIntel = all.filter((f) => f.company === 'ALL')
  const coyIntel = all.filter((f) => f.company === company)
  const progress = decryptProgress(all, company)

  // Opening this page counts as "reading" the intel this company can see —
  // clears the home-page alert on this device for THIS company (another
  // company's fingerprint is tracked separately).
  useEffect(() => { markIntelSeen(all, company) }, [all, company])

  if (open) return <FragmentView fragment={open} company={company} onSolved={onSolved} onBack={() => setOpen(null)} />

  return (
    <div className="container" style={{ padding: '24px 20px' }}>
      <PageTitle title="Intercepted Intelligence" sub="DECRYPT MERIDIAN TRANSMISSIONS" />

      <IntelHeader intro={intro} progress={progress} />

      <Section title="RHQ Intelligence" sub="Unit-wide">
        <FragmentList list={rhqIntel} onOpen={setOpen} empty="No unit-wide intelligence yet." />
      </Section>

      <Section title="Company Intelligence" sub={company ? PHONETIC[company] : 'select your company'}>
        <div className="row center" style={{ gap: 10, marginBottom: 12 }}>
          <label className="mono dim" style={{ fontSize: 11 }}>Company</label>
          <select value={company} onChange={(e) => setCompany(e.target.value)} style={{ width: 'auto' }}>
            <option value="">— Select —</option>
            {COMPANIES.filter((c) => c.letter !== 'R').map((c) => <option key={c.letter} value={c.letter}>{c.name}</option>)}
          </select>
        </div>
        {!company
          ? <div className="panel panel-pad mono dim" style={{ fontSize: 13 }}>Choose your company to see its intelligence.</div>
          : <FragmentList list={coyIntel} onOpen={setOpen} empty={`No intelligence for ${PHONETIC[company] || company} yet.`} />}
      </Section>
    </div>
  )
}

// One header panel carrying BOTH the RHQ intro copy and this device's decrypt
// progress — they're the same thought ("here's the situation, here's how far
// you've got"), so they share a box rather than stacking two nearly-identical
// panels down the page.
//
// The count sits opposite the intro title on the header row, and the segment
// bar — one segment per puzzle, lit as it's cracked — runs along the bottom.
// Segments beat a bare "4 / 7" because the unlit ones read as a row of locks
// still to open rather than as a statistic.
//
// Either half can be absent: RHQ can hide the intro, and a tab with no puzzles
// yet shouldn't lead with "00 / 00". With neither there's nothing to draw.
function IntelHeader({ intro, progress }) {
  const { done, total, fragments } = progress
  const showIntro = !!(intro.show && (intro.title || intro.text))
  const showMeter = total > 0
  if (!showIntro && !showMeter) return null
  const complete = showMeter && done === total

  return (
    <div className="panel panel-pad col" style={{
      gap: 10, marginBottom: 16,
      borderColor: 'var(--accent)',
      boxShadow: complete ? '0 0 22px rgba(54,224,192,0.18)' : undefined,
    }}>
      <div className="row between center wrap" style={{ gap: 14 }}>
        {intro.title && showIntro && <div className="head accent" style={{ fontSize: 16 }}>{intro.title}</div>}
        {showMeter && (
          <div className="row center" style={{ gap: 10, marginLeft: 'auto' }}>
            <span style={{
              font: "700 26px Orbitron, 'JetBrains Mono', monospace",
              color: complete ? 'var(--accent)' : '#fff', lineHeight: 1,
            }}>
              {String(done).padStart(2, '0')}<span className="dim" style={{ fontSize: 18 }}> / {String(total).padStart(2, '0')}</span>
            </span>
            <span className="mono dim" style={{ fontSize: 10, letterSpacing: 2 }}>
              {complete ? 'ALL DECRYPTED' : 'DECRYPTED'}
            </span>
          </div>
        )}
      </div>

      {showIntro && intro.text && (
        <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.6, margin: 0 }}>{intro.text}</p>
      )}

      {showMeter && (
        <div className="row wrap" style={{ gap: 4 }}>
          {fragments.map((f) => (
            <span key={f.id} className={`decrypt-seg${f.solved ? ' is-done' : ''}`}
              title={f.solved ? `${f.title || 'Fragment'} — decrypted` : `${f.title || 'Fragment'} — encrypted`} />
          ))}
        </div>
      )}
    </div>
  )
}

function Section({ title, sub, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="row center" style={{ gap: 10, marginBottom: 10 }}>
        <span className="head" style={{ fontSize: 16 }}>{title}</span>
        {sub && <span className="mono dim" style={{ fontSize: 11 }}>· {sub}</span>}
      </div>
      {children}
    </div>
  )
}

function FragmentList({ list, onOpen, empty }) {
  if (!list.length) return <div className="panel panel-pad mono dim" style={{ fontSize: 13 }}>{empty}</div>
  return (
    <div className="col" style={{ gap: 12 }}>
      {list.map((f) => {
        const done = isSolved(f.id)
        return (
          <div key={f.id} className="panel panel-pad row between center wrap"
            style={{ gap: 12, borderColor: done ? 'var(--accent)' : undefined }}>
            <div>
              <div className="head" style={{ fontSize: 15 }}>{f.title || 'Encrypted fragment'}</div>
              <div className={`mono ${done ? 'accent' : 'dim'}`} style={{ fontSize: 11 }}>
                {done ? '✓ decrypted' : 'encrypted'}
              </div>
            </div>
            <button className={done ? 'ghost' : 'primary'} onClick={() => onOpen(f)}>
              {done ? 'Review' : 'Decrypt'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// The answer input: one box per word of the solution.
//
// Kept word-by-word rather than collapsed into a single text field because the
// split is what makes per-word marking possible — "the second word is wrong"
// is genuinely more useful than "that's not it", and it's the difference
// between a cadet adjusting and a cadet giving up. The cost is that a row of
// boxes is fiddlier than one field, so the fiddliness is what's fixed here:
//
//  - boxes GROW as you type. They used to be pinned to the answer word's
//    length, so anything longer scrolled inside a box you couldn't read.
//  - a space jumps to the next word, and backspace in an empty box jumps back,
//    so the whole phrase can be typed without touching the mouse.
//  - pasting (or typing) several words at once SPREADS them across the boxes
//    from wherever you are — decode the phrase elsewhere, paste it in one go.
//  - Enter submits.
//
// Autocorrect/autocapitalise are off throughout: a phone helpfully "fixing"
// a decoded word into a real one is indistinguishable from a wrong answer.
function AnswerBoxes({ words: ws, ans, setAns, checked, solved, onSubmit }) {
  const refs = useRef([])
  const focus = (i) => refs.current[Math.max(0, Math.min(ws.length - 1, i))]?.focus()

  // Write `text` across the boxes starting at `i`, one word per box, and land
  // the caret on the box the typist would expect next.
  const spread = (i, text, { trailingSpace = false } = {}) => {
    const parts = String(text).split(/\s+/).filter(Boolean)
    setAns((prev) => {
      const a = [...prev]
      if (!parts.length) a[i] = ''
      parts.forEach((p, k) => { if (i + k < ws.length) a[i + k] = p })
      return a
    })
    const last = i + Math.max(0, parts.length - 1)
    focus(trailingSpace || parts.length > 1 ? last + (trailingSpace ? 1 : 0) : i)
  }

  const onChange = (i, raw) => {
    if (solved) return
    if (/\s/.test(raw)) spread(i, raw, { trailingSpace: /\s$/.test(raw) })
    else setAns((prev) => { const a = [...prev]; a[i] = raw; return a })
  }

  const onKeyDown = (i, e) => {
    if (e.key === 'Enter') { e.preventDefault(); onSubmit() }
    else if (e.key === 'Backspace' && !(ans[i] || '') && i > 0) { e.preventDefault(); focus(i - 1) }
    else if (e.key === 'ArrowLeft' && e.target.selectionStart === 0 && i > 0) focus(i - 1)
    else if (e.key === 'ArrowRight' && e.target.selectionStart === (ans[i] || '').length) focus(i + 1)
  }

  return (
    <div className="row wrap" style={{ gap: 8 }}>
      {ws.map((w, i) => {
        const val = ans[i] || ''
        const ok = checked && norm(val) === norm(w)
        const bad = checked && !ok
        return (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el }}
            className="mono"
            value={val}
            readOnly={solved}
            onChange={(e) => onChange(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={(e) => {
              const text = e.clipboardData?.getData('text') || ''
              if (!/\s/.test(text)) return // single word: let the browser handle it
              e.preventDefault()
              spread(i, text)
            }}
            aria-label={`Decrypted word ${i + 1} of ${ws.length}`}
            // Keep browser autofill/password managers off these boxes.
            //
            // autoComplete="off" alone is NOT enough: Chrome ignores it on the
            // identity-document path and falls back to its own classifier,
            // which was reading a short, nameless, dot-placeholdered text box
            // in a row as a document number and offering "Save ID card". The
            // name/id/title below give that classifier an unambiguous
            // non-identity signal for what these fields actually are; the
            // data-* attributes are the opt-outs 1Password / LastPass /
            // Dashlane read.
            name={`decrypted-word-${i + 1}`}
            id={`decrypted-word-${i + 1}`}
            title={`Decrypted word ${i + 1}`}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            data-1p-ignore="true"
            data-lpignore="true"
            data-form-type="other"
            placeholder="•••"
            style={{
              // Width tracks what's TYPED, from a uniform compact resting
              // size — that's what makes the box visibly grow under the
              // cursor. Sizing it to the answer word's length instead (the
              // previous approach) meant a correctly-sized guess never
              // exceeded the box, so it never appeared to expand at all.
              //
              // The +BOX_PAD is not decorative: `* { box-sizing: border-box }`
              // is global, so a bare `Nch` width includes the input's 12px
              // side padding and border — roughly 3 characters' worth at this
              // font size, which was silently clipping the end of every entry.
              width: `calc(${Math.max(MIN_BOX_CH, val.length + 1)}ch + ${BOX_PAD}px)`,
              maxWidth: '100%',
              borderColor: ok ? 'var(--accent)' : bad ? 'var(--hostile)' : 'var(--line)',
            }}
          />
        )
      })}
    </div>
  )
}

// One fragment, open. Exported so the intel editors can render the EXACT
// cadet-facing view as a preview — a second "roughly what it'll look like"
// mock would drift from this one the first time either changed.
//
//   preview  no solve is recorded and no telemetry fires (RHQ testing their
//            own puzzle must not move the counters), and the back button is
//            relabelled by the caller.
export function FragmentView({ fragment: f, company, onBack, onSolved, preview = false, backLabel = '← All intelligence' }) {
  const ws = words(f.answer)
  // Already cracked on this device: show it solved and open, so coming back to
  // re-read the intel doesn't mean solving the puzzle again.
  const [wasSolved] = useState(() => (preview ? false : isSolved(f.id)))
  // …and fill the boxes back in with what they decoded, rather than leaving a
  // row of empty inputs above a "DECRYPTED ✓".
  const [ans, setAns] = useState(() => (wasSolved ? ws : []))
  const [checked, setChecked] = useState(false)
  const [hintOpen, setHintOpen] = useState(false)
  const allRight = ws.length > 0 && ws.every((w, i) => norm(ans[i]) === norm(w))
  const solved = wasSolved || (checked && allRight)
  const hint = String(f.hint || '').trim()

  // Record the solve exactly once, the moment it happens. markSolved is a
  // no-op for a fragment this device already has, so the anonymous count
  // behind it can't be re-fired by reopening.
  useEffect(() => {
    if (preview || !solved || wasSolved) return
    if (markSolved(f.id, { company })) onSolved?.()
  }, [preview, solved, wasSolved, f.id, company, onSolved])

  return (
    <div className="container" style={{ padding: '24px 20px', maxWidth: 1000 }}>
      <button className="ghost" onClick={onBack} style={{ marginBottom: 14 }}>{backLabel}</button>
      <div className="row wrap" style={{ gap: 18, alignItems: 'flex-start' }}>
        <div className="panel panel-pad grow" style={{ minWidth: 320 }}>
          <h1 style={{ marginTop: 0, fontSize: 22 }}>{f.title || 'Encrypted fragment'}</h1>
          {f.prompt && <div className="mono" style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, background: 'rgba(0,0,0,0.25)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 12, margin: '10px 0' }}>{f.prompt}</div>}
          {f.docUrl && <div style={{ margin: '12px 0' }}><DocEmbed url={f.docUrl} /></div>}

          {ws.length > 0 && (
            <>
              <div className="mono dim" style={{ fontSize: 11, letterSpacing: 2, margin: '14px 0 6px' }}>ENTER DECRYPTED INTEL</div>
              <AnswerBoxes words={ws} ans={ans} setAns={setAns} checked={checked} solved={solved} onSubmit={() => setChecked(true)} />
              <div className="mono dim" style={{ fontSize: 10, marginTop: 6 }}>
                Not case sensitive.
              </div>
              <div className="row center wrap" style={{ gap: 12, marginTop: 14 }}>
                {solved ? <span className="accent head">DECRYPTED ✓</span> : <button className="primary" onClick={() => setChecked(true)}>Enter intel</button>}
                {!solved && hint && (
                  <button className="ghost" onClick={() => setHintOpen(true)} disabled={hintOpen}
                    style={{ padding: '4px 10px', fontSize: 12 }}>
                    {hintOpen ? 'Hint shown' : '? Hint'}
                  </button>
                )}
                {checked && !allRight && <span className="hostile mono" style={{ fontSize: 12 }}>Some words are off — adjust and try again.</span>}
              </div>

              {/* Hint is opt-in behind a click: nobody who wants the puzzle
                  intact has it spoiled, and nobody who's stuck is stranded. */}
              {hintOpen && !solved && (
                <div className="panel panel-pad" style={{ marginTop: 12, borderColor: 'var(--warn)' }}>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: 2, marginBottom: 6, color: 'var(--warn)' }}>HINT</div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>{hint}</div>
                </div>
              )}
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
