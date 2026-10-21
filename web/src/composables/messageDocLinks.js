/**
 * Split chat text into plain segments and doc path links (5.2.0 DOC-15).
 */

const DOC_PATH_RE =
  /(?:journals\/sessions\/[A-Za-z0-9_-]+\/(?:ANNOUNCEMENT\.md|README\.md|nodes\/step-\d{2}-[A-Za-z0-9_-]+\.md|furnace\/archive-[^\s`]+\.md)|nodes\/step-\d{2}-[A-Za-z0-9_-]+\.md|ANNOUNCEMENT\.md)/g

/**
 * @returns {Array<{ type: 'text' | 'doc', value: string, file?: string }>}
 */
export function splitMessageDocLinks(text) {
  const src = String(text || '')
  if (!src) return []
  const out = []
  let last = 0
  for (const m of src.matchAll(DOC_PATH_RE)) {
    const idx = m.index ?? 0
    if (idx > last) out.push({ type: 'text', value: src.slice(last, idx) })
    const raw = m[0]
    let file = raw
    const j = raw.indexOf('/sessions/')
    if (j >= 0) {
      const tail = raw.slice(j + '/sessions/'.length)
      const slash = tail.indexOf('/')
      if (slash >= 0) file = tail.slice(slash + 1)
    }
    out.push({ type: 'doc', value: raw, file })
    last = idx + raw.length
  }
  if (last < src.length) out.push({ type: 'text', value: src.slice(last) })
  return out.length ? out : [{ type: 'text', value: src }]
}

export function journalPathToDocFile(journalPath) {
  const p = String(journalPath || '').replace(/\\/g, '/')
  const m = p.match(/journals\/sessions\/[A-Za-z0-9_-]+\/(.+)$/)
  if (m) return m[1]
  if (/^(nodes\/|furnace\/|ANNOUNCEMENT\.md|README\.md)/.test(p)) return p
  return null
}
