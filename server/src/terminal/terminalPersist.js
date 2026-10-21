import { getDb } from '../db.js'

export function persistTerminal(entry) {
  try {
    const db = getDb()
    db.prepare(
      `INSERT OR REPLACE INTO terminal_sessions
        (id, session_id, node_instance_id, member_id, run_id, status, cwd, command_label, pid, cols, rows, log_path, exit_code, signal, started_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      entry.id,
      entry.sessionId,
      entry.nodeInstanceId || null,
      entry.memberId || null,
      entry.runId || null,
      entry.status,
      entry.cwd || null,
      entry.label || null,
      entry.pid || null,
      entry.cols || null,
      entry.rows || null,
      entry.logName || null,
      entry.exitCode,
      entry.signal || null,
      entry.startedAt || null,
      entry.finishedAt || null,
    )
  } catch {
    /* tests may run without sqlite tables */
  }
}
