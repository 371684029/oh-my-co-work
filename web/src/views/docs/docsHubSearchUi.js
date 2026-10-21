/** Search hit snippet highlighting for DocsHub (FE-01). */

export function highlightSearchSnippet(snippet, query) {
  if (!snippet || !query) return snippet || ''
  const escaped = snippet.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const q = query.trim()
  if (!q) return escaped
  const words = q.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${words.join('|')})`, 'gi')
  return escaped.replace(re, '<mark>$1</mark>')
}
