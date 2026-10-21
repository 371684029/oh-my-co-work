/**
 * Bracketed paste (5.2.0 CP-06 / CP-07): wrap payload for TUI CLIs.
 */

export const BRACKET_START = '\x1b[200~'
export const BRACKET_END = '\x1b[201~'

export function wrapBracketedPaste(text) {
  const body = String(text ?? '')
  if (!body) return body
  if (body.includes(BRACKET_START) || body.includes(BRACKET_END)) return body
  return `${BRACKET_START}${body}${BRACKET_END}`
}

export function stripBracketedPaste(text) {
  let s = String(text ?? '')
  if (s.startsWith(BRACKET_START)) s = s.slice(BRACKET_START.length)
  if (s.endsWith(BRACKET_END)) s = s.slice(0, -BRACKET_END.length)
  return s
}

/**
 * Split bracketed paste for chunked send: first chunk gets start, last gets end.
 */
export function chunkBracketedPaste(text, { size = 4096 } = {}) {
  const body = stripBracketedPaste(text)
  if (!body) return []
  const chunks = []
  let i = 0
  const max = Math.max(2, Math.floor(Number(size) || 4096))
  while (i < body.length) {
    let end = Math.min(i + max, body.length)
    if (end < body.length) {
      const code = body.charCodeAt(end)
      if (code >= 0xdc00 && code <= 0xdfff && end - 1 > i) end -= 1
    }
    chunks.push(body.slice(i, end))
    i = end
  }
  if (!chunks.length) return []
  chunks[0] = `${BRACKET_START}${chunks[0]}`
  chunks[chunks.length - 1] = `${chunks[chunks.length - 1]}${BRACKET_END}`
  return chunks
}

/** GUI composer: bracket + delayed submit carriage return as separate write. */
export function buildFurnaceSubmitSequence(text, { useBracket = true } = {}) {
  const raw = String(text ?? '')
  const payload = useBracket && raw.includes('\n') ? wrapBracketedPaste(raw) : raw
  return { payload, submit: '\r' }
}
