/** DocsHub in-document search pager (FE-01). */

export function formatInDocSearchPager(markIndex, total) {
  const n = Math.max(0, Number(total) || 0)
  if (!n) return ''
  const i = Math.max(0, Number(markIndex) || 0)
  return `${i + 1} / ${n}`
}

export function stepInDocSearchIndex(markIndex, delta, total) {
  const n = Math.max(0, Number(total) || 0)
  if (!n) return markIndex
  const i = Number(markIndex) || 0
  return (i + delta + n) % n
}
