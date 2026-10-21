import { getDb } from '../db.js'
import { setWsTerminalAttach } from '../bus.js'
import { publicTerminal } from './publicTerminal.js'
import { normalizePtyLaunch, resolveWindowsExecutable } from './ptyLaunch.js'
import { appendAdapterReply } from './adapters/jsonl.js'
import { handleTerminalClientMessage as handleTerminalClientMessageImpl } from './clientMessage.js'
import {
  deleteTerminalLogForEntry,
  readTerminalLogPath as readTerminalLogPathImpl,
  readTerminalLogPreview as readTerminalLogPreviewImpl,
} from './terminalLog.js'
import { flushOutput } from './terminalOutput.js'
import {
  forgetSessionTerminalsInMap,
  killTerminalEntry,
  markInterruptedTerminalsInDb,
} from './terminalLifecycle.js'
import { runTerminalPty } from './terminalRun.js'

export { normalizePtyLaunch, resolveWindowsExecutable }

const terminals = new Map()

let adapterEventHandler = null

export function setAdapterEventHandler(fn) {
  adapterEventHandler = typeof fn === 'function' ? fn : null
}

function nowIso() {
  return new Date().toISOString()
}

export function runTerminal(params) {
  return runTerminalPty(
    {
      terminals,
      killTerminal: (id, reason) => killTerminalEntry(terminals.get(id), reason),
      get adapterEventHandler() {
        return adapterEventHandler
      },
      nowIso,
    },
    params,
  )
}

export function listSessionTerminals(sessionId, { includeReplay = true } = {}) {
  const entries = [...terminals.values()].filter((entry) => entry.sessionId === sessionId)
  for (const entry of entries) {
    if (entry.pendingOutput) {
      if (entry.flushTimer) clearTimeout(entry.flushTimer)
      flushOutput(entry)
    }
  }
  return entries
    .sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)))
    .map((entry) => publicTerminal(entry, { includeReplay }))
}

export function getTerminal(id) {
  return terminals.get(id) || null
}

export function writeAdapterReply(terminalId, payload) {
  const entry = terminals.get(terminalId)
  if (!entry?.adapterReplyPath) return false
  try {
    return appendAdapterReply(entry.adapterReplyPath, {
      type: 'answer',
      at: nowIso(),
      terminalId,
      ...payload,
    })
  } catch {
    return false
  }
}

export function deleteTerminalLog(sessionId, terminalId) {
  return deleteTerminalLogForEntry(terminals.get(terminalId), sessionId, terminalId)
}

export function readTerminalLogPath(sessionId, terminalId) {
  return readTerminalLogPathImpl(sessionId, terminalId, (id) => terminals.get(id))
}

/** Tail log for in-app replay preview (5.3.0 TRC-04). */
export function readTerminalLogPreview(sessionId, terminalId, opts = {}) {
  return readTerminalLogPreviewImpl(sessionId, terminalId, (id) => terminals.get(id), opts)
}

export function forgetSessionTerminals(sessionId) {
  forgetSessionTerminalsInMap(terminals, sessionId)
}

/**
 * On server boot, any terminal the DB still considers live was orphaned by a
 * crash/restart (its in-memory PTY is gone). Mark it interrupted so the UI can
 * show "已中断，可重启同配置会话" instead of a phantom "running". (5.1.0 CLI-17)
 * @returns {number} rows updated (0 when the table is unavailable, e.g. in tests)
 */
export function markInterruptedTerminalsOnBoot() {
  return markInterruptedTerminalsInDb(getDb, nowIso)
}

export function killTerminal(id, reason = 'user') {
  return killTerminalEntry(terminals.get(id), reason)
}

const terminalWsDeps = {
  getEntry: (id) => terminals.get(id),
  setWsTerminalAttach,
  flushOutput,
  publicTerminal,
  killTerminal,
}

export function handleTerminalClientMessage(ws, sessionId, raw) {
  return handleTerminalClientMessageImpl(terminalWsDeps, ws, sessionId, raw)
}
