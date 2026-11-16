import { getDb } from '../db.js'
import { publicTerminal } from './publicTerminal.js'
import { readTerminalLogPreview, resolveTerminalLogAbs } from './terminalLog.js'

const PREVIEW_TAIL_BYTES = 48_000

/**
 * Build API terminals from SQLite for rows not present in the in-memory map
 * (e.g. after server restart). Replay comes from on-disk log tail — not live PTY.
 */
export function listPersistedTerminalsForSession(sessionId, liveIds, { includeReplay = true } = {}) {
  let rows = []
  try {
    rows = getDb()
      .prepare(
        `SELECT id, session_id, node_instance_id, member_id, run_id, status, cwd, command_label,
                pid, cols, rows, log_path, exit_code, signal, started_at, finished_at
           FROM terminal_sessions WHERE session_id = ? ORDER BY started_at ASC`,
      )
      .all(sessionId)
  } catch {
    return []
  }
  const resolveEntry = () => null
  return rows
    .filter((row) => row?.id && !liveIds.has(row.id))
    .map((row) => {
      let replay = ''
      let replayTruncated = false
      if (includeReplay) {
        const preview = readTerminalLogPreview(sessionId, row.id, resolveEntry, {
          maxBytes: PREVIEW_TAIL_BYTES,
        })
        if (preview?.text) {
          replay = preview.text
          replayTruncated = !!preview.truncated
        }
      }
      const logAbs = resolveTerminalLogAbs(row.log_path)
      return publicTerminal(
        {
          id: row.id,
          sessionId: row.session_id,
          nodeInstanceId: row.node_instance_id,
          memberId: row.member_id,
          runId: row.run_id,
          label: row.command_label || '终端',
          runtime: 'terminal',
          command: null,
          cwd: row.cwd,
          status: row.status,
          pid: row.pid,
          cols: row.cols,
          rows: row.rows,
          seq: 0,
          exitCode: row.exit_code,
          signal: row.signal,
          startedAt: row.started_at,
          finishedAt: row.finished_at,
          logName: row.log_path,
          logPath: logAbs,
          logTruncated: replayTruncated,
          replayTruncated,
          replay,
          rehydrated: true,
        },
        { includeReplay },
      )
    })
}