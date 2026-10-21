/** Quote paths for terminal / CLI paste (5.2.0 CP-09). */

export function quotePathForTerminal(filePath) {
  const p = String(filePath || '').trim()
  if (!p) return ''
  if (/[\s"'`]/u.test(p)) return `"${p.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  return p
}

export function pathsToTerminalPaste(paths, { asAtRef = false } = {}) {
  return paths
    .map((p) => {
      const raw = String(p || '').trim()
      if (!raw) return ''
      if (asAtRef && !raw.startsWith('@')) return `@${raw}`
      return quotePathForTerminal(raw)
    })
    .filter(Boolean)
    .join(' ')
}
