import { getDb } from './db.js'
import { killSessionProcesses, listSessionProcesses } from './processRegistry.js'
import { killTerminal, listSessionTerminals } from './terminal/terminalService.js'

function isRunningTerminal(t) {
  return t && (t.status === 'running' || t.status === 'starting')
}

/**
 * 列出当前占用进程 / 内嵌终端的会话，供设置页选择释放。
 */
export function listOccupiedResources() {
  const sessions = getDb().prepare(`SELECT id, title, status FROM sessions`).all()
  const items = []
  for (const s of sessions) {
    const processes = listSessionProcesses(s.id)
    const terminals = listSessionTerminals(s.id).filter(isRunningTerminal)
    if (!processes.length && !terminals.length) continue
    items.push({
      sessionId: s.id,
      title: s.title || s.id,
      status: s.status,
      processCount: processes.length,
      terminalCount: terminals.length,
      processes: processes.map((p) => ({
        pid: p.pid,
        label: p.label || p.command || '',
        detach: !!p.detach,
      })),
      terminals: terminals.map((t) => ({
        id: t.id,
        label: t.label,
        pid: t.pid,
      })),
    })
  }
  return items
}

export function releaseSessionResources(sessionId) {
  let killed = { killed: 0, pids: [] }
  try {
    killed = killSessionProcesses(sessionId, { includeDetach: true })
  } catch (e) {
    console.warn('[acw] release kill processes', sessionId, e?.message || e)
  }
  const terminalIds = []
  try {
    const terms = listSessionTerminals(sessionId).filter(isRunningTerminal)
    for (const t of terms) {
      if (killTerminal(t.id, 'release')) terminalIds.push(t.id)
    }
  } catch (e) {
    console.warn('[acw] release kill terminals', sessionId, e?.message || e)
  }
  return {
    sessionId,
    killed: killed.killed || 0,
    pids: killed.pids || [],
    terminalsKilled: terminalIds,
  }
}

/**
 * @param {{ sessionIds?: string[] }} [opts] 空数组或不传 = 释放当前所有占用
 */
export function releaseResources({ sessionIds } = {}) {
  const occupied = listOccupiedResources()
  const requested = Array.isArray(sessionIds)
    ? sessionIds.map(String).filter(Boolean)
    : []
  const ids = requested.length ? requested : occupied.map((o) => o.sessionId)
  const results = ids.map((id) => releaseSessionResources(id))
  return {
    ok: true,
    released: results.length,
    results,
    remaining: listOccupiedResources(),
  }
}
