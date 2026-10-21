/** FE-04: LRU cache for rendered doc HTML (key = session + file + content hash). */

const MAX = 24
const map = new Map()

function cacheKey({ sessionId, name, content, lineNumbers, workFolder }) {
  return [
    sessionId || '',
    name || '',
    workFolder || '',
    lineNumbers ? '1' : '0',
    String(content || '').length,
    String(content || '').slice(0, 64),
    String(content || '').slice(-64),
  ].join('|')
}

export function getCachedDocHtml(keyParts) {
  const key = cacheKey(keyParts)
  if (!map.has(key)) return null
  const html = map.get(key)
  map.delete(key)
  map.set(key, html)
  return html
}

export function setCachedDocHtml(keyParts, html) {
  const key = cacheKey(keyParts)
  if (map.has(key)) map.delete(key)
  map.set(key, html)
  while (map.size > MAX) {
    const first = map.keys().next().value
    map.delete(first)
  }
}

export function clearDocRenderCache() {
  map.clear()
}
