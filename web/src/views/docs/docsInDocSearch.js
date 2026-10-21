/** In-document search highlight & navigation (5.2.0 DOC-06). Browser-only DOM helpers. */

export function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildSearchHighlightRegex(query) {
  const words = String(query || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return null
  return new RegExp(`(${words.map(escapeRegExp).join('|')})`, 'gi')
}

export function lineNeedleFromContent(content, lineNum, fallbackQuery = '') {
  const lines = String(content || '').split('\n')
  const t = (lines[Math.max(0, lineNum - 1)] || '').trim()
  return t.slice(0, 48) || String(fallbackQuery || '').trim()
}

export function clearInDocSearchMarks(root) {
  if (!root) return
  for (const mark of [...root.querySelectorAll('mark.docs-search-hit')]) {
    const parent = mark.parentNode
    if (!parent) continue
    parent.replaceChild(document.createTextNode(mark.textContent || ''), mark)
    parent.normalize()
  }
}

function shouldSkipHighlightNode(node) {
  const el = node.parentElement
  if (!el) return true
  if (el.closest('.docs-code-block, script, style, mark.docs-search-hit')) return true
  return false
}

/**
 * Wrap query matches in `<mark class="docs-search-hit">`.
 * @returns {number} match count
 */
export function applyInDocSearchMarks(root, query) {
  if (!root) return 0
  clearInDocSearchMarks(root)
  const re = buildSearchHighlightRegex(query)
  if (!re) return 0

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes = []
  let n
  while ((n = walker.nextNode())) {
    if (shouldSkipHighlightNode(n) || !n.textContent?.trim()) continue
    textNodes.push(n)
  }

  let count = 0
  for (const node of textNodes) {
    const text = node.textContent || ''
    re.lastIndex = 0
    if (!re.test(text)) continue
    re.lastIndex = 0
    const frag = document.createDocumentFragment()
    let last = 0
    let m
    while ((m = re.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)))
      const mark = document.createElement('mark')
      mark.className = 'docs-search-hit'
      mark.textContent = m[0]
      frag.appendChild(mark)
      count += 1
      last = m.index + m[0].length
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)))
    node.parentNode?.replaceChild(frag, node)
  }
  return count
}

export function scrollToInDocSearchMark(root, { markIndex = 0, lineHint, content, query } = {}) {
  if (!root) return
  const marks = [...root.querySelectorAll('mark.docs-search-hit')]
  for (const m of marks) m.classList.remove('docs-search-hit-active')

  if (!marks.length) return

  let idx = Math.min(Math.max(0, markIndex), marks.length - 1)
  const needle = lineNeedleFromContent(content, lineHint, query)
  if (needle.length >= 4) {
    const found = marks.findIndex((m) => m.textContent?.includes(needle.slice(0, Math.min(needle.length, 24))))
    if (found >= 0) idx = found
  }

  const target = marks[idx]
  if (target) {
    target.classList.add('docs-search-hit-active')
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  return idx
}
