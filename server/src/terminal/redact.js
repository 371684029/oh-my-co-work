const BUILTIN_PATTERNS = [
  /\bsk-[A-Za-z0-9]{16,}\b/g,
  /\bghp_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  /\b(Bearer|token|api[_-]?key|secret|password)\s*[:=]\s*\S+/gi,
]

function compileUserPatterns(text) {
  const out = []
  for (const line of String(text || '').split(/\r?\n/)) {
    const src = line.trim()
    if (!src || src.startsWith('#')) continue
    try {
      out.push(new RegExp(src, 'g'))
    } catch {
      /* ignore invalid user regex */
    }
  }
  return out
}

export function redactText(text, { enabled = true, patternsText = '' } = {}) {
  if (!enabled) return String(text ?? '')
  let next = String(text ?? '')
  if (!next) return next
  const patterns = [...BUILTIN_PATTERNS, ...compileUserPatterns(patternsText)]
  for (const re of patterns) {
    re.lastIndex = 0
    next = next.replace(re, '[REDACTED]')
  }
  return next
}
