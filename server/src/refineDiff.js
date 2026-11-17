/** Unified diff for refine source backups and save previews (6.5 RFD-01). */

function normalizeEols(text) {
  return String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function relPath(filePath) {
  const p = String(filePath || 'file').replace(/\\/g, '/')
  return p.split('/').pop() || 'file'
}

/**
 * @param {string} beforeText
 * @param {string} afterText
 * @param {{ filePath?: string, context?: number, maxLines?: number }} [opts]
 */
export function buildUnifiedDiff(beforeText, afterText, opts = {}) {
  const label = relPath(opts.filePath)
  const context = opts.context ?? 3
  const maxLines = opts.maxLines ?? 200
  const a = normalizeEols(beforeText).split('\n')
  const b = normalizeEols(afterText).split('\n')
  if (a.length === 1 && a[0] === '') a.length = 0
  if (b.length === 1 && b[0] === '') b.length = 0

  let pre = 0
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++
  let suf = 0
  while (
    suf < a.length - pre &&
    suf < b.length - pre &&
    a[a.length - 1 - suf] === b[b.length - 1 - suf]
  ) {
    suf++
  }
  if (pre === a.length && pre === b.length) return ''

  const oldCtxStart = Math.max(0, pre - context)
  const aEnd = a.length - suf
  const bEnd = b.length - suf
  const newCtxEnd = Math.min(b.length, bEnd + context)
  const oldStart = oldCtxStart + 1
  const newStart = oldCtxStart + 1
  const oldCount = aEnd - oldCtxStart
  const newCount = newCtxEnd - oldCtxStart

  const lines = [
    `diff --git a/${label} b/${label}`,
    `--- a/${label}`,
    `+++ b/${label}`,
    `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`,
  ]
  let emitted = 0
  for (let i = oldCtxStart; i < pre && emitted < maxLines; i++) {
    lines.push(` ${a[i]}`)
    emitted++
  }
  for (let i = pre; i < aEnd && emitted < maxLines; i++) {
    lines.push(`-${a[i]}`)
    emitted++
  }
  for (let i = pre; i < bEnd && emitted < maxLines; i++) {
    lines.push(`+${b[i]}`)
    emitted++
  }
  for (let i = bEnd; i < newCtxEnd && emitted < maxLines; i++) {
    lines.push(` ${b[i]}`)
    emitted++
  }
  if (emitted >= maxLines) lines.push('… (diff truncated)')
  return lines.join('\n')
}

/** @deprecated Use buildUnifiedDiff */
export function buildLineDiff(beforeText, afterText, maxLines = 160) {
  return buildUnifiedDiff(beforeText, afterText, { maxLines })
}