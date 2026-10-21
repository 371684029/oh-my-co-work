/** Markdown heading outline for docs hub TOC (5.2.0 DOC-01). */

export function slugifyHeading(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function extractMarkdownOutline(markdown, { maxLevel = 3 } = {}) {
  const items = []
  for (const line of String(markdown || '').split('\n')) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (!m) continue
    const level = m[1].length
    if (level > maxLevel) continue
    const text = m[2].trim()
    if (!text) continue
    items.push({ level, text, slug: slugifyHeading(text) })
  }
  return items
}

/** Slugs match markdownRenderer heading ids (duplicate titles get -2, -3, …). */
export function outlineWithUniqueSlugs(markdown, opts) {
  const counts = new Map()
  return extractMarkdownOutline(markdown, opts).map((item) => {
    const n = (counts.get(item.slug) || 0) + 1
    counts.set(item.slug, n)
    const slug = n > 1 ? `${item.slug}-${n}` : item.slug
    return { ...item, slug }
  })
}
