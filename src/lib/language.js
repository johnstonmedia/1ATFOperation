// Config-driven language compliance check for public-facing copy.
//
// The site is public, so operational text should avoid words the cadet
// organisation asks us to keep off outward-facing material. This is a SOFT,
// advisory check: it never blocks a save or rewrites text automatically — it
// surfaces flagged words and a suggested alternative so the author can decide.
//
// To adjust the policy, edit BANNED_TERMS only — nothing else needs to change.
// Each entry:
//   match   : lower-case word/phrase to look for (matched on word boundaries)
//   suggest : the preferred replacement to show the author
//   level   : 'avoid'  — strongly discouraged (e.g. "enemy")
//             'review' — context-dependent; flag for a human to judge
export const BANNED_TERMS = [
  { match: 'enemy', suggest: 'opposing force / OPFOR', level: 'avoid' },
  { match: 'enemies', suggest: 'opposing forces / OPFOR', level: 'avoid' },
  { match: 'kill', suggest: 'neutralise / engage (simulated)', level: 'avoid' },
  { match: 'killed', suggest: 'neutralised (simulated)', level: 'avoid' },
  { match: 'kills', suggest: 'engagements (simulated)', level: 'avoid' },
  { match: 'casualty', suggest: 'notional casualty (simulated)', level: 'avoid' },
  { match: 'casualties', suggest: 'notional casualties (simulated)', level: 'avoid' },
  { match: 'dead', suggest: 'out of action (simulated)', level: 'avoid' },
  { match: 'death', suggest: 'out of action (simulated)', level: 'avoid' },
  { match: 'shoot', suggest: 'engage (simulated)', level: 'avoid' },
  { match: 'target', suggest: 'objective / point of interest', level: 'review' },
  { match: 'weapon', suggest: 'equipment / stores', level: 'review' },
  { match: 'ammo', suggest: 'stores', level: 'review' },
  { match: 'ammunition', suggest: 'stores', level: 'review' },
  { match: 'hostile', suggest: 'opposing force / OPFOR', level: 'review' },
  { match: 'attack', suggest: 'advance / activity', level: 'review' },
  { match: 'combat', suggest: 'field activity / exercise', level: 'review' },
]

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Scan one or more strings and return the flagged terms found (de-duplicated),
// each with its suggestion and level. Empty array = nothing to flag.
export function scanText(...parts) {
  const text = parts.filter(Boolean).join('\n').toLowerCase()
  if (!text.trim()) return []
  const hits = []
  const seen = new Set()
  for (const t of BANNED_TERMS) {
    const re = new RegExp(`\\b${escapeRe(t.match)}\\b`, 'i')
    if (re.test(text) && !seen.has(t.match)) {
      seen.add(t.match)
      hits.push(t)
    }
  }
  // 'avoid' first, then 'review'.
  return hits.sort((a, b) => (a.level === b.level ? 0 : a.level === 'avoid' ? -1 : 1))
}
