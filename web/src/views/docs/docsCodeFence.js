/** Fenced code blocks for docs hub (5.2.0 DOC-02). Node + browser safe. */
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import shell from 'highlight.js/lib/languages/shell'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

export const DOCS_CODE_LINES_KEY = 'acw.docsCodeLineNumbers'

const LANG_ALIASES = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  html: 'xml',
  vue: 'xml',
}

let hlReady = false

function ensureHljs() {
  if (hlReady) return hljs
  for (const [name, mod] of [
    ['javascript', javascript],
    ['typescript', typescript],
    ['python', python],
    ['bash', bash],
    ['json', json],
    ['markdown', markdown],
    ['sql', sql],
    ['xml', xml],
    ['css', css],
    ['yaml', yaml],
    ['shell', shell],
  ]) {
    hljs.registerLanguage(name, mod)
  }
  hlReady = true
  return hljs
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function resolveDocsCodeLang(info) {
  const raw = String(info || '')
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
  if (!raw) return ''
  return LANG_ALIASES[raw] || raw
}

export function plainCodeBase64(code) {
  const s = String(code ?? '')
  /* eslint-disable no-undef -- Node test runner provides Buffer */
  if (typeof Buffer !== 'undefined') return Buffer.from(s, 'utf8').toString('base64')
  /* eslint-enable no-undef */
  return btoa(unescape(encodeURIComponent(s)))
}

export function plainCodeFromBase64(b64) {
  /* eslint-disable no-undef */
  if (typeof Buffer !== 'undefined') return Buffer.from(String(b64), 'base64').toString('utf8')
  /* eslint-enable no-undef */
  return decodeURIComponent(escape(atob(String(b64))))
}

export function readDocsCodeLineNumbers() {
  try {
    return localStorage.getItem(DOCS_CODE_LINES_KEY) === '1'
  } catch {
    return false
  }
}

export function writeDocsCodeLineNumbers(on) {
  try {
    localStorage.setItem(DOCS_CODE_LINES_KEY, on ? '1' : '0')
  } catch {
    /* privacy mode */
  }
}

function highlightLine(h, code, language) {
  if (language && h.getLanguage(language)) {
    try {
      return h.highlight(code, { language }).value
    } catch {
      /* fall through */
    }
  }
  return escapeHtml(code)
}

/**
 * @param {string} code
 * @param {string} info markdown fence info (lang)
 * @param {{ lineNumbers?: boolean }} [opts]
 */
export function renderDocsFence(code, info, { lineNumbers = false } = {}) {
  const h = ensureHljs()
  const language = resolveDocsCodeLang(info)
  let langLabel = String(info || '').trim().split(/\s+/)[0] || 'text'
  let inner

  if (lineNumbers) {
    const lines = String(code).split('\n')
    inner = lines
      .map((line, i) => {
        const body = highlightLine(h, line, language)
        return `<span class="docs-code-line"><span class="docs-code-ln" aria-hidden="true">${i + 1}</span><span class="docs-code-body">${body || ' '}</span></span>`
      })
      .join('')
  } else if (language && h.getLanguage(language)) {
    try {
      inner = h.highlight(String(code), { language }).value
      langLabel = language
    } catch {
      inner = escapeHtml(code)
    }
  } else {
    const auto = h.highlightAuto(String(code))
    inner = auto.value
    if (auto.language) langLabel = auto.language
  }

  const lnClass = lineNumbers ? ' docs-code-block--lines' : ''
  const b64 = plainCodeBase64(code)
  const langRaw = escapeHtml(String(info || '').trim())

  return (
    `<div class="docs-code-block${lnClass}" data-lang="${escapeHtml(langLabel)}" data-lang-raw="${langRaw}" data-plain-b64="${b64}">` +
    `<div class="docs-code-toolbar">` +
    `<span class="docs-code-lang">${escapeHtml(langLabel)}</span>` +
    `<button type="button" class="docs-code-copy">复制</button>` +
    `<button type="button" class="docs-code-lines-btn" aria-pressed="${lineNumbers ? 'true' : 'false'}">行号</button>` +
    `</div>` +
    `<pre class="docs-code-pre"><code class="hljs language-${escapeHtml(langLabel)}">${inner}</code></pre>` +
    `</div>`
  )
}

/** Event delegation for doc-prose clicks (copy / line toggle / links). */
export async function handleDocsProseClick(e, handlers = {}) {
  const copyBtn = e.target.closest?.('.docs-code-copy')
  if (copyBtn) {
    e.preventDefault()
    const block = copyBtn.closest('.docs-code-block')
    const pre = block?.querySelector('.docs-code-pre')
    const b64 = block?.getAttribute('data-plain-b64')
    const text = b64 ? plainCodeFromBase64(b64) : pre?.textContent || ''
    try {
      await navigator.clipboard.writeText(text)
      handlers.onCopied?.()
    } catch {
      handlers.onCopyFailed?.()
    }
    return true
  }

  const linesBtn = e.target.closest?.('.docs-code-lines-btn')
  if (linesBtn) {
    e.preventDefault()
    const block = linesBtn.closest('.docs-code-block')
    if (!block) return true
    const b64 = block.getAttribute('data-plain-b64')
    const langRaw = block.getAttribute('data-lang-raw') || ''
    const nextLines = !block.classList.contains('docs-code-block--lines')
    const html = renderDocsFence(plainCodeFromBase64(b64), langRaw, { lineNumbers: nextLines })
    const wrap = document.createElement('div')
    wrap.innerHTML = html.trim()
    const next = wrap.firstElementChild
    if (next) block.replaceWith(next)
    return true
  }

  return false
}
