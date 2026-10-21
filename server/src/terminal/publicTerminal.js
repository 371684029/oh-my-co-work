/** Serialize a live terminal entry for API / WebSocket clients. */
export function publicTerminal(entry, { includeReplay = false } = {}) {
  if (!entry) return null
  return {
    id: entry.id,
    sessionId: entry.sessionId,
    nodeInstanceId: entry.nodeInstanceId,
    memberId: entry.memberId,
    runId: entry.runId,
    label: entry.label,
    runtime: entry.runtime,
    command: entry.command || null,
    furnaceAgent: entry.furnaceAgent || null,
    cwd: entry.cwd,
    status: entry.status,
    pid: entry.pid,
    cols: entry.cols,
    rows: entry.rows,
    seq: entry.seq,
    exitCode: entry.exitCode,
    signal: entry.signal,
    startedAt: entry.startedAt,
    finishedAt: entry.finishedAt,
    log: entry.logName,
    logTruncated: entry.logTruncated,
    replayTruncated: entry.replayTruncated,
    adapter: entry.adapterType || null,
    lastError: entry.lastError || null,
    ...(includeReplay ? { replay: entry.replay } : {}),
  }
}
