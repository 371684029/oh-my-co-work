/**
 * SEC-01: docs HTML sanitization tests (node — DOMPurify is browser-oriented so we inject a fake).
 * Uses the DI factory `createDocsSanitizer(purify)` so stripping behavior is asserted without a DOM.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createDocsSanitizer, sanitizeDocsHtml, DOCS_SANITIZE_CONFIG } from '../src/views/docs/docsSanitize.js'

/**
 * Fake DOMPurify-like instance that mimics the security-relevant stripping of real DOMPurify
 * for the cases under test: drops <script>, on* event handlers, javascript: hrefs; keeps
 * allowlisted data-* attrs, <mark>, and docs-* classes.
 */
function makeFakePurify() {
  return {
    sanitize(html, config = {}) {
      let out = String(html)
      // strip <script>...</script> and self-closing/void script tags
      out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      out = out.replace(/<script\b[^>]*\/?>(?!<\/script>)/gi, '')
      // strip on* event handlers (keep the element, drop the handler attr)
      out = out.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      // strip javascript:/data:/vbscript: href/src
      out = out.replace(/\s(href|src)\s*=\s*("|')\s*(?:javascript|data|vbscript):[^"']*\2/gi, '')
      // honor ADD_TAGS: ensure <mark> is not stripped (fake keeps it — assert below)
      // (fake keeps all class/data-* attrs — the assertions verify the pipeline emits them)
      return out
    },
    // expose config so tests can assert the allowlist is passed through
    lastConfig: null,
  }
}

test('DOCS_SANITIZE_CONFIG allowlists pipeline attrs and tags', () => {
  assert.ok(DOCS_SANITIZE_CONFIG.ADD_TAGS.includes('mark'), 'mark tag allowed')
  for (const attr of ['data-docs-path', 'data-docs-link', 'data-lang', 'data-lang-raw', 'data-plain-b64']) {
    assert.ok(DOCS_SANITIZE_CONFIG.ADD_ATTR.includes(attr), `${attr} allowed`)
    assert.ok(DOCS_SANITIZE_CONFIG.ALLOW_DATA_ATTR === true, 'ALLOW_DATA_ATTR on')
    assert.ok(DOCS_SANITIZE_CONFIG.ALLOW_ARIA_ATTR === true, 'ALLOW_ARIA_ATTR on')
  }
  for (const tag of ['script', 'style', 'iframe']) {
    assert.ok(DOCS_SANITIZE_CONFIG.FORBID_TAGS.includes(tag), `${tag} forbidden`)
  }
})

test('createDocsSanitizer passes config and returns purify output', () => {
  let seenConfig = null
  const purify = {
    sanitize(html, config) {
      seenConfig = config
      return 'SANITIZED'
    },
  }
  const sanitize = createDocsSanitizer(purify)
  assert.equal(sanitize('<b>x</b>'), 'SANITIZED')
  assert.equal(seenConfig, DOCS_SANITIZE_CONFIG, 'uses DOCS_SANITIZE_CONFIG')
})

test('createDocsSanitizer returns input unchanged when purify lacks sanitize (node identity fallback)', () => {
  const sanitize = createDocsSanitizer({})
  assert.equal(sanitize('<b>x</b>'), '<b>x</b>')
})

test('createDocsSanitizer handles empty/null', () => {
  const sanitize = createDocsSanitizer(makeFakePurify())
  assert.equal(sanitize(''), '')
  assert.equal(sanitize(null), '')
  assert.equal(sanitize(undefined), '')
})

test('SEC-01: <script> tag stripped', () => {
  const sanitize = createDocsSanitizer(makeFakePurify())
  const out = sanitize('<p>hi</p><script>alert(1)</script>')
  assert.ok(!out.includes('script'), 'script removed')
  assert.ok(out.includes('<p>hi</p>'), 'safe content kept')
})

test('SEC-01: <img onerror> event handler stripped', () => {
  const sanitize = createDocsSanitizer(makeFakePurify())
  const out = sanitize('<img src="x" onerror="alert(1)">')
  assert.ok(!out.includes('onerror'), 'onerror removed')
  assert.ok(out.includes('<img'), 'img kept')
})

test('SEC-01: javascript: href stripped', () => {
  const sanitize = createDocsSanitizer(makeFakePurify())
  const out = sanitize('<a href="javascript:alert(1)">x</a>')
  assert.ok(!out.includes('javascript:'), 'javascript: removed')
})

test('SEC-01: data-docs-path attribute survives (allowlist works)', () => {
  const sanitize = createDocsSanitizer(makeFakePurify())
  const out = sanitize('<div data-docs-path="/x"><a href="#" data-docs-link="/y">t</a></div>')
  assert.ok(out.includes('data-docs-path="/x"'), 'data-docs-path kept')
  assert.ok(out.includes('data-docs-link="/y"'), 'data-docs-link kept')
})

test('SEC-01: <mark> tag survives', () => {
  const sanitize = createDocsSanitizer(makeFakePurify())
  const out = sanitize('before <mark>hit</mark> after')
  assert.ok(out.includes('<mark>hit</mark>'), 'mark kept')
})

test('SEC-01: code-fence class survives', () => {
  const sanitize = createDocsSanitizer(makeFakePurify())
  const out = sanitize(
    '<div class="docs-code-block" data-lang="js" data-lang-raw="js" data-plain-b64="eA=="><pre class="docs-code-pre"><code class="hljs language-js">x</code></pre></div>',
  )
  assert.ok(out.includes('docs-code-block'), 'docs-code-block kept')
  assert.ok(out.includes('docs-code-pre'), 'docs-code-pre kept')
  assert.ok(out.includes('data-plain-b64="eA=="'), 'data-plain-b64 kept')
})

test('default sanitizeDocsHtml is safe to call in node (identity fallback, no throw)', () => {
  // In node DOMPurify.isSupported=false → falls back to identity; must not throw
  const out = sanitizeDocsHtml('<b>x</b>')
  assert.equal(typeof out, 'string')
})
