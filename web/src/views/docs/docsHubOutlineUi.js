/** DocsHub in-document outline scroll + active heading (FE-01). */

export function listDocHeadingElements(root) {
  if (!root) return []
  return [...root.querySelectorAll('h1[id], h2[id], h3[id]')]
}

export function scrollDocHeading(root, slug) {
  if (!root || !slug) return false
  const el = root.querySelector(`#${CSS.escape(slug)}`)
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return true
}

/**
 * @param {HTMLElement} root
 * @param {(slug: string) => void} onActiveSlug
 */
export function createDocOutlineObserver(root, onActiveSlug) {
  const headings = listDocHeadingElements(root)
  if (!headings.length) return null

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
      if (visible[0]?.target?.id) onActiveSlug(visible[0].target.id)
    },
    { root, rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] },
  )

  for (const h of headings) observer.observe(h)
  return observer
}

export function initialOutlineSlug(headings) {
  return headings[0]?.id || ''
}
