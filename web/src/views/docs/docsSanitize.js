/**
 * SEC-01: output-side HTML sanitization for the docs render pipeline (defense-in-depth).
 *
 * Why: doc content is BOTH user-authored (ANNOUNCEMENT.md, README.md) AND agent-authored
 * (nodes/step-*.md ledgers, furnace/archive-*.md). Agent output can embed arbitrary copied
 * text / terminal output. markdown-it already runs with `html:false` (raw HTML in markdown is
 * escaped) and `isAllowedLinkHref` blocks javascript:/data:/vbscript: hrefs — those stay the
 * first line of defense. DOMPurify at the v-html boundary is the second line.
 *
 * DOMPurify is browser-oriented (needs window/DOMParser). Per the repo DI convention this module
 * exposes `createDocsSanitizer(purify)` (injectable, testable in plain node) and a default
 * `sanitizeDocsHtml` bound to DOMPurify that degrades to identity when the sanitizer is
 * unavailable (node test env), so pure helpers that call it stay testable.
 */

import DOMPurify from 'dompurify'

/**
 * Allowlist for the custom attributes/classes/tags the pipeline emits
 * (markdownRenderer.js + docsCodeFence.js). Without these DOMPurify would strip code-fence
 * toolbar controls and doc cross-link affordances.
 */
export const DOCS_SANITIZE_CONFIG = {
  // tags the pipeline emits beyond DOMPurify defaults (`<mark>` for search highlights)
  ADD_TAGS: ['mark'],
  // keep data-* (data-docs-path/link, data-lang, data-lang-raw, data-plain-b64) and aria-*
  ALLOW_DATA_ATTR: true,
  ALLOW_ARIA_ATTR: true,
  // explicit attrs the pipeline sets via attrSet / template strings
  ADD_ATTR: [
    'data-docs-path',
    'data-docs-link',
    'data-lang',
    'data-lang-raw',
    'data-plain-b64',
    'loading',
    'target',
    'rel',
  ],
  // never allow these even if present in source
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
}

/**
 * Create a sanitizer from a DOMPurify-like instance (DI for node tests).
 *
 * @param {{ sanitize?: (html: string, config?: object) => string }} purify DOMPurify-like instance
 * @returns {(html: string) => string} sanitizer that returns safe HTML
 */
export function createDocsSanitizer(purify) {
  return function sanitizeDocsHtml(html) {
    if (html == null || html === '') return ''
    if (typeof purify?.sanitize !== 'function') return String(html) // degrade to identity
    return String(purify.sanitize(String(html), DOCS_SANITIZE_CONFIG))
  }
}

/** Default browser sanitizer bound to DOMPurify (identity in node — see createDocsSanitizer). */
export const sanitizeDocsHtml = createDocsSanitizer(DOMPurify)
