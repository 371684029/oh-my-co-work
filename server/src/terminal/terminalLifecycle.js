import { killProcessTree } from '../processRegistry.js'

export const RETAIN_FINISHED_PER_SESSION = 20
export const RETAIN_FINISHED_GLOBAL = 200

export function pruneFinishedTerminals(terminals, sessionId) {
  const finished = [...terminals.values()]
    .filter((t) => t.sessionId === sessionId && t.status !== 'running' && t.status !== 'starting')
    .sort((a, b) => String(b.finishedAt || '').localeCompare(String(a.finishedAt || '')))
  for (const entry of finished.slice(RETAIN_FINISHED_PER_SESSION)) terminals.delete(entry.id)
  const allFinished = [...terminals.values()]
    .filter((t) => t.status !== 'running' && t.status !== 'starting')
    .sort((a, b) => String(b.finishedAt || '').localeCompare(String(a.finishedAt || '')))
  for (const entry of allFinished.slice(RETAIN_FINISHED_GLOBAL)) terminals.delete(entry.id)
}

export function killTerminalEntry(entry, reason = 'user') {
  if (!entry) return false
  if (entry.status !== 'running' && entry.status !== 'starting') return true
  entry.status = 'killed'
  entry.signal = reason
  try {
    entry.process?.kill()
    killProcessTree(entry.pid)
  } catch {
    return false
  }
  return true
}

export function forgetSessionTerminalsInMap(terminals, sessionId) {
  for (const [id, entry] of [...terminals.entries()]) {
    if (entry.sessionId !== sessionId) continue
    if (entry.flushTimer) clearTimeout(entry.flushTimer)
    entry.flushTimer = null
    entry.logStream?.end()
    entry.logStream = null
    if (typeof entry.adapterStop === 'function') {
      try {
        entry.adapterStop()
      } catch {
        /* ignore */
      }
      entry.adapterStop = null
    }
    if (entry.status === 'running' || entry.status === 'starting') {
      entry.status = 'killed'
      entry.signal = 'session_deleted'
      try {
        entry.process?.kill()
        killProcessTree(entry.pid)
      } catch {
        /* process may already have exited */
      }
    }
    terminals.delete(id)
  }
}

export function markInterruptedTerminalsInDb(getDb, nowIso) {
  try {
    const info = getDb()
      .prepare(
        `UPDATE terminal_sessions
            SET status = 'interrupted', finished_at = ?
          WHERE status IN ('running', 'starting')`,
      )
      .run(nowIso())
    return Number(info?.changes || 0)
  } catch {
    return 0
  }
}
