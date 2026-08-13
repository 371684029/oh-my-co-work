import fs from 'node:fs'
import path from 'node:path'
import * as pty from 'node-pty'
import { uid } from '@acw/shared'
import { DATA_ROOT } from '../db.js'
import { emitSession } from '../bus.js'
import {
  killMemberProcesses,
  registerProcess,
  unregisterProcess,
} from '../processRegistry.js'

const terminals = new Map()
const MAX_REPLAY_CHARS = 256_000
const MAX_INPUT_CHARS = 16_384
const OUTPUT_BATCH_MS = 24
const RETAIN_FINISHED = 20

function nowIso() {
  return new Date().toISOString()
}

function clampSize(value, fallback, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function appendReplay(entry, data) {
  entry.replay += data
  if (entry.replay.length > MAX_REPLAY_CHARS) {
    entry.replay = entry.replay.slice(-MAX_REPLAY_CHARS)
    entry.replayTruncated = true
  }
}

function publicTerminal(entry, { includeReplay = false } = {}) {
  if (!entry) return null
  return {
    id: entry.id,
    sessionId: entry.sessionId,
    nodeInstanceId: entry.nodeInstanceId,
    memberId: entry.memberId,
    runId: entry.runId,
    label: entry.label,
    runtime: entry.runtime,
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
    replayTruncated: entry.replayTruncated,
    ...(includeReplay ? { replay: entry.replay } : {}),
  }
}

function send(ws, event) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(event))
}

function emitTerminal(entry, type, payload = {}) {
  emitSession(entry.sessionId, {
    type,
    payload: {
      terminalId: entry.id,
      ...payload,
    },
  })
}

function flushOutput(entry) {
  entry.flushTimer = null
  if (!entry.pendingOutput) return
  const data = entry.pendingOutput
  entry.pendingOutput = ''
  entry.seq += 1
  emitTerminal(entry, 'terminal.output', { seq: entry.seq, data })
}

function queueOutput(entry, data) {
  const text = String(data || '')
  if (!text) return
  appendReplay(entry, text)
  entry.pendingOutput += text
  try {
    fs.appendFileSync(entry.logPath, text)
  } catch {
    /* 日志失败不应中断终端 */
  }
  if (!entry.flushTimer) {
    entry.flushTimer = setTimeout(() => flushOutput(entry), OUTPUT_BATCH_MS)
  }
}

function normalizePtyLaunch(launch) {
  if (launch?.shell !== true) {
    return { file: launch.cmd, args: launch.args || [] }
  }
  if (process.platform === 'win32') {
    return {
      file: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', String(launch.cmd || '')],
    }
  }
  return {
    file: process.env.SHELL || '/bin/sh',
    args: ['-lc', String(launch.cmd || '')],
  }
}

function pruneFinished(sessionId) {
  const finished = [...terminals.values()]
    .filter((t) => t.sessionId === sessionId && t.status !== 'running' && t.status !== 'starting')
    .sort((a, b) => String(b.finishedAt || '').localeCompare(String(a.finishedAt || '')))
  for (const entry of finished.slice(RETAIN_FINISHED)) terminals.delete(entry.id)
}

/**
 * 在真实 PTY 内运行脚本。Promise 在终端退出后完成，因此现有流程引擎仍可按节点推进。
 */
export function runTerminal({
  launch,
  cwd,
  env,
  timeoutMs,
  sessionId,
  nodeInstanceId,
  memberId,
  label,
  successCodes = [0],
  stdinText,
  cols = 100,
  rows = 30,
}) {
  return new Promise((resolve) => {
    if (!sessionId) {
      resolve({
        ok: false,
        summary: '内嵌终端必须绑定会话',
        error: { code: 'TERMINAL_SESSION_REQUIRED' },
      })
      return
    }

    if (memberId) killMemberProcesses(sessionId, memberId, { includeDetach: true })

    const id = uid('term')
    const runId = uid('run')
    const logName = `terminal_${id}.log`
    const logPath = path.join(DATA_ROOT, 'logs', logName)
    fs.mkdirSync(path.dirname(logPath), { recursive: true })
    const size = {
      cols: clampSize(cols, 100, 20, 300),
      rows: clampSize(rows, 30, 5, 120),
    }
    const entry = {
      id,
      runId,
      sessionId,
      nodeInstanceId: nodeInstanceId || null,
      memberId: memberId || null,
      label: label || '终端',
      runtime: launch?.label || 'terminal',
      cwd,
      status: 'starting',
      pid: null,
      cols: size.cols,
      rows: size.rows,
      seq: 0,
      replay: '',
      replayTruncated: false,
      pendingOutput: '',
      flushTimer: null,
      exitCode: null,
      signal: null,
      startedAt: nowIso(),
      finishedAt: null,
      logName,
      logPath,
      process: null,
      settled: false,
      timeout: null,
    }
    terminals.set(id, entry)

    const finish = ({ exitCode = -1, signal = null, error = null } = {}) => {
      if (entry.settled) return
      entry.settled = true
      if (entry.timeout) clearTimeout(entry.timeout)
      if (entry.flushTimer) {
        clearTimeout(entry.flushTimer)
        flushOutput(entry)
      }
      entry.exitCode = Number.isFinite(Number(exitCode)) ? Number(exitCode) : -1
      entry.signal = signal || null
      entry.finishedAt = nowIso()
      entry.status = error ? 'failed' : entry.status === 'killed' ? 'killed' : 'exited'
      unregisterProcess(sessionId, runId)
      emitTerminal(entry, 'terminal.exited', { terminal: publicTerminal(entry) })
      pruneFinished(sessionId)

      const ok = !error && successCodes.includes(entry.exitCode)
      const summary = error
        ? `【${entry.label}】终端启动失败：${error.message}`
        : entry.status === 'killed'
          ? `【${entry.label}】终端已停止`
          : ok
            ? `【${entry.label}】终端执行完成（exit ${entry.exitCode}）`
            : `【${entry.label}】终端执行失败（exit ${entry.exitCode}）`
      resolve({
        ok,
        summary,
        terminalId: id,
        data: {
          terminalId: id,
          code: entry.exitCode,
          signal: entry.signal,
          cwd,
          runtime: entry.runtime,
          label: entry.label,
          log: logName,
          executionMode: 'terminal',
        },
        error: ok
          ? undefined
          : {
              code: error ? 'PTY_START_FAILED' : entry.status === 'killed' ? 'KILLED' : 'EXIT',
              message: error?.message || summary,
            },
      })
    }

    try {
      const spec = normalizePtyLaunch(launch)
      entry.process = pty.spawn(spec.file, spec.args, {
        name: 'xterm-256color',
        cols: entry.cols,
        rows: entry.rows,
        cwd,
        env: {
          ...env,
          TERM: env?.TERM || 'xterm-256color',
          COLORTERM: env?.COLORTERM || 'truecolor',
        },
        useConpty: process.platform === 'win32',
      })
      entry.pid = entry.process.pid
      entry.status = 'running'
      registerProcess(sessionId, runId, {
        pid: entry.pid,
        kind: 'terminal',
        label: entry.label,
        memberId,
        child: entry.process,
      })
      entry.process.onData((data) => queueOutput(entry, data))
      entry.process.onExit(({ exitCode, signal }) => finish({ exitCode, signal }))
      emitTerminal(entry, 'terminal.opened', {
        terminal: publicTerminal(entry, { includeReplay: true }),
      })

      if (stdinText != null && String(stdinText)) {
        setTimeout(() => {
          if (entry.status === 'running') entry.process.write(String(stdinText))
        }, 30)
      }
      if (Number(timeoutMs) > 0) {
        entry.timeout = setTimeout(() => {
          entry.status = 'killed'
          try {
            entry.process.kill()
          } catch {
            finish({ exitCode: -1, signal: 'timeout' })
          }
        }, Number(timeoutMs))
      }
    } catch (error) {
      finish({ error })
    }
  })
}

export function listSessionTerminals(sessionId, { includeReplay = true } = {}) {
  return [...terminals.values()]
    .filter((entry) => entry.sessionId === sessionId)
    .sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)))
    .map((entry) => publicTerminal(entry, { includeReplay }))
}

export function getTerminal(id) {
  return terminals.get(id) || null
}

export function killTerminal(id, reason = 'user') {
  const entry = terminals.get(id)
  if (!entry) return false
  if (entry.status !== 'running' && entry.status !== 'starting') return true
  entry.status = 'killed'
  entry.signal = reason
  try {
    entry.process?.kill()
  } catch {
    return false
  }
  return true
}

export function handleTerminalClientMessage(ws, sessionId, raw) {
  let message
  try {
    message = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(raw.toString())
  } catch {
    return false
  }
  if (!String(message?.type || '').startsWith('terminal.')) return false

  const terminalId = String(message.terminalId || message.payload?.terminalId || '')
  const entry = terminals.get(terminalId)
  if (!entry || entry.sessionId !== sessionId) {
    send(ws, {
      type: 'terminal.error',
      payload: { terminalId, code: 'TERMINAL_NOT_FOUND', message: '终端不存在或不属于当前会话' },
    })
    return true
  }

  if (message.type === 'terminal.attach') {
    send(ws, {
      type: 'terminal.snapshot',
      payload: {
        terminalId,
        terminal: publicTerminal(entry),
        seq: entry.seq,
        data: entry.replay,
        truncated: entry.replayTruncated,
      },
    })
    return true
  }
  if (message.type === 'terminal.input') {
    const data = String(message.data ?? message.payload?.data ?? '')
    if (data.length > MAX_INPUT_CHARS) {
      send(ws, {
        type: 'terminal.error',
        payload: { terminalId, code: 'INPUT_TOO_LARGE', message: '单次终端输入过大' },
      })
      return true
    }
    if (entry.status === 'running') entry.process.write(data)
    return true
  }
  if (message.type === 'terminal.resize') {
    const cols = clampSize(message.cols ?? message.payload?.cols, entry.cols, 20, 300)
    const rows = clampSize(message.rows ?? message.payload?.rows, entry.rows, 5, 120)
    entry.cols = cols
    entry.rows = rows
    if (entry.status === 'running') entry.process.resize(cols, rows)
    return true
  }
  if (message.type === 'terminal.kill') {
    killTerminal(terminalId, 'user')
    return true
  }
  return true
}

