// Converts an uploaded document's text into quiz/form questions.
//
// Recognised conventions (forgiving — RHQ can edit the result before
// distributing):
//
//   How does 1ATF resupply forward zones?      <- a line ending in "?" is a prompt
//   A) By air                                   <- options: A)/B)/-/* or "a."
//   *B) Through the Logistics Hub               <- "*" marks the correct option
//   C) They do not
//
//   Q: Describe Bravo's recon role.             <- "Q:" => short-answer question
//
// Plain paragraphs with no question markers are ignored.

export function parseTextToQuestions(text) {
  const lines = text.split(/\r?\n/)
  const questions = []
  let current = null

  const pushCurrent = () => {
    if (current) {
      // demote MC with no options to short answer
      if (current.type === 'mc' && current.options.length === 0) {
        questions.push({ type: 'short', prompt: current.prompt })
      } else {
        questions.push(current)
      }
      current = null
    }
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    // Explicit short-answer
    const qShort = line.match(/^Q[:.)]\s*(.+)$/i)
    if (qShort) {
      pushCurrent()
      questions.push({ type: 'short', prompt: qShort[1].trim() })
      continue
    }

    // Option line: optional leading "*", then A) / B. / - / •
    const opt = line.match(/^(\*?)\s*(?:[A-Ha-h][).]|[-*•])\s*(.+)$/)
    if (opt && current && current.type === 'mc') {
      const isCorrect = opt[1] === '*'
      current.options.push(opt[2].trim())
      if (isCorrect) current.answer = current.options.length - 1
      continue
    }

    // Prompt line (ends with ?)
    if (line.endsWith('?')) {
      pushCurrent()
      current = { type: 'mc', prompt: line, options: [], answer: null }
      continue
    }

    // A standalone heading/paragraph closes any open MC block.
    pushCurrent()
  }
  pushCurrent()
  return questions
}

// Extract the document's readable text AND parsed questions in one pass, so the
// original briefing/instructions can be kept alongside the interactive items.
export async function interpretDocument(file) {
  const text = await extractText(file)
  return { content: text.trim(), questions: parseTextToQuestions(text) }
}

// Best-effort text extraction from an uploaded file.
export async function extractText(file) {
  const name = (file.name || '').toLowerCase()
  if (name.endsWith('.pdf')) {
    // Lightweight PDF text scrape: pull readable strings from the raw bytes.
    const buf = new Uint8Array(await file.arrayBuffer())
    const ascii = new TextDecoder('latin1').decode(buf)
    const chunks = [...ascii.matchAll(/\(([^()\\]{2,})\)/g)].map((m) => m[1])
    return chunks.join('\n')
  }
  // txt / md / csv / anything text-like
  return file.text()
}
