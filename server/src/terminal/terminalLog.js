import fs from 'node:fs'
import { getDb } from '../db.js'

/**
 * @param {(id: string) => object | undefined} resolveEntry
 */
export function readTerminalLogPath(sessionId, terminalId, resolveEntry) {
  const entry = resolveEntry(terminalId)
  if (!entry || entry.sessionId !== sessionId) return null
  if (entry.logPath && fs.existsSync(entry.logPath)) return entry.logPath
  const row = getDb()
    .prepare('SELECT log_path FROM terminal_sessions WHERE id = ? AND session_id = ?')
    .get(terminalId, sessionId)
  if (row?.log_path && fs.existsSync(row.log_path)) return row.log_path
  return null
}

export function deleteTerminalLogForEntry(entry, sessionId, _terminalId) {
  if (!entry || entry.sessionId !== sessionId) return false
  try {
    if (entry.logPath && fs.existsSync(entry.logPath)) fs.unlinkSync(entry.logPath)
  } catch {
    return false
  }
  entry.logBytes = 0
  entry.logTruncated = false
  return true
}

/** Tail log for in-app replay preview (5.3.0 TRC-04). */
export function readTerminalLogPreview(sessionId, terminalId, resolveEntry, { maxBytes = 48_000 } = {}) {
  const file = readTerminalLogPath(sessionId, terminalId, resolveEntry)
  if (!file) return null
  try {
    const stat = fs.statSync(file)
    const start = Math.max(0, stat.size - maxBytes)
    const fd = fs.openSync(file, 'r')
    try {
      const buf = Buffer.alloc(stat.size - start)
      fs.readSync(fd, buf, 0, buf.length, start)
      const text = buf.toString('utf8')
      return {
        text,
        truncated: start > 0,
        bytes: stat.size,
        path: file,
      }
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return null
  }
}
