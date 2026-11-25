/**
 * Parse unified diff / git patch text for side-by-side gutter rendering (RFD-10).
 * @param {string} text
 * @returns {Array<{ kind: 'meta'|'hunk'|'ctx'|'add'|'del', text: string, oldNo?: number, newNo?: number }>}
 */
export function parseUnifiedDiff(text) {
  const lines = String(text || '').split('\n')
  const rows = []
  let oldLine = 0
  let newLine = 0
  for (const line of lines) {
    if (line.startsWith('@@')) {
      rows.push({ kind: 'hunk', text: line })
      const m = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (m) {
        oldLine = Math.max(0, Number(m[1]) - 1)
        newLine = Math.max(0, Number(m[2]) - 1)
      }
      continue
    }
    if (line.startsWith('--- ') || line.startsWith('+++ ') || line === '---' || line === '+++') {
      rows.push({ kind: 'meta', text: line })
      continue
    }
    if (line.startsWith('\\')) {
      rows.push({ kind: 'meta', text: line })
      continue
    }
    if (line.startsWith('-')) {
      oldLine += 1
      rows.push({ kind: 'del', text: line.slice(1), oldNo: oldLine })
      continue
    }
    if (line.startsWith('+')) {
      newLine += 1
      rows.push({ kind: 'add', text: line.slice(1), newNo: newLine })
      continue
    }
    const content = line.startsWith(' ') ? line.slice(1) : line
    if (line.startsWith(' ') || line === '') {
      oldLine += 1
      newLine += 1
      rows.push({ kind: 'ctx', text: content, oldNo: oldLine, newNo: newLine })
      continue
    }
    rows.push({ kind: 'ctx', text: line })
  }
  return rows
}