/** Paste confirmation helpers (5.2.0 CP-08). */

// eslint-disable-next-line no-control-regex -- bracketed paste OSC sequences
const BRACKET_MARKERS = /\x1b\[200~|\x1b\[201~/g

export function stripBracketedPasteMarkers(data) {
  return String(data ?? '').replace(BRACKET_MARKERS, '')
}

export function countPasteNewlines(data) {
  return (stripBracketedPasteMarkers(data).match(/[\r\n]/g) || []).length
}

export function pasteConfirmSummary(data) {
  const body = stripBracketedPasteMarkers(data)
  const lines = body.split(/[\r\n]/)
  const charCount = body.length
  const previewLines = lines.slice(0, 3)
  const preview = previewLines.join('\n')
  const extra =
    lines.length > 3 ? `\n… 还有 ${lines.length - 3} 行` : ''
  return {
    charCount,
    lineCount: Math.max(1, lines.length),
    preview: `${preview}${extra}`,
  }
}

/**
 * @param {{ data: string, pastePolicy?: string, pasteContext?: string }} opts
 */
export function shouldConfirmTerminalPaste({ data, pastePolicy = 'confirm', pasteContext = 'shell' }) {
  if (pastePolicy === 'allow') return false
  if (pasteContext === 'furnace' || pasteContext === 'agent') return false
  const lineBreaks = countPasteNewlines(data)
  if (lineBreaks <= 1) return false
  if (pastePolicy === 'shell-only') return lineBreaks > 2
  return true
}

export function buildPasteConfirmMessage(data) {
  const { charCount, lineCount, preview } = pasteConfirmSummary(data)
  return {
    title: '粘贴确认',
    message: `即将粘贴 ${charCount} 字符（约 ${lineBreaksLabel(lineCount)}）。\n\n${preview}`,
  }
}

function lineBreaksLabel(lineCount) {
  return `${Math.max(0, lineCount - 1)} 处换行`
}
