/** Copy helpers for xterm buffer (5.2.0 CP-02 / CP-05). */
import { formatTerminalCopyText } from './terminalClipboard.js'

export function copyVisibleTerminalText(xterm) {
  if (!xterm?.buffer?.active) return ''
  const buffer = xterm.buffer.active
  const start = buffer.viewportY
  const rows = Number(xterm.rows) || 0
  const parts = []
  for (let i = 0; i < rows; i++) {
    const line = buffer.getLine(start + i)
    if (!line) continue
    const text = line.translateToString(true)
    if (i > 0 && line.isWrapped && parts.length) {
      parts[parts.length - 1] += text
    } else {
      parts.push(text)
    }
  }
  return formatTerminalCopyText(parts.join('\n'))
}

export function scrollTerminalToBottom(xterm) {
  if (!xterm?.buffer?.active) return
  xterm.scrollToBottom()
}
