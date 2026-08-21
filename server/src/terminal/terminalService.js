import fs from 'node:fs'
import path from 'node:path'
import * as pty from 'node-pty'
import { uid } from '@acw/shared'
import { DATA_ROOT, getDb } from '../db.js'
import { emitSession } from '../bus.js'
import { getAppSettings } from '../appSettings.js'
import { redactText } from './redact.js'
import {
  appendAdapterReply,
  defaultAdapterPaths,
  watchJsonlAdapter,
} from './adapters/jsonl.js'
import {
  killMemberProcesses,
  killProcessTree,
  registerProcess,
  unregisterProcess,
} from '../processRegistry.js'

const terminals = new Map()
const MAX_INPUT_CHARS = 16_384
const OUTPUT_BATCH_MS = 24
const RETAIN_FINISHED = 20
const RETAIN_FINISHED_GLOBAL = 200
const MAX_INPUT_BYTES_PER_SECOND = 256 * 1024
const MAX_INPUT_MESSAGES_PER_SECOND = 500

let adapterEventHandler = null

export function setAdapterEventHandler(fn) {
  adapterEventHandler = typeof fn === 'function' ? fn : null
}

function quotaLimits() {
  const q = getAppSettings().quota || {}
  return {
    maxConcurrent: Number(q.maxConcurrentTerminals) || 8,
    maxLogBytes: Math.max(1, Number(q.maxLogMiB) || 10) * 1024 * 1024,
    maxReplayChars: Math.max(32, Number(q.maxReplayKiB) || 256) * 1024,
  }
}

function redactOpts() {
  const r = getAppSettings().redact || {}
  return { enabled: r.enabled !== false, patternsText: r.patternsText || '' }
}

function countRunningTerminals(sessionId, { exceptMemberId } = {}) {
  return [...terminals.values()].filter(
    (t) =>
      t.sessionId === sessionId &&
      (t.status === 'running' || t.status === 'starting') &&
      (!exceptMemberId || t.memberId !== exceptMemberId),
  ).length
}

function stopMemberTerminals(sessionId, memberId) {
  if (!sessionId || !memberId) return
  for (const entry of [...terminals.values()]) {
    if (entry.sessionId !== sessionId || entry.memberId !== memberId) continue
    if (entry.status !== 'running' && entry.status !== 'starting') continue
    killTerminal(entry.id, 'replaced')
  }
}

function nowIso() {
  return new Date().toISOString()
}

function clampSize(value, fallback, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function persistTerminal(entry) {
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

function appendReplay(entry, data) {
  const maxChars = quotaLimits().maxReplayChars
  entry.replay += data
  if (entry.replay.length > maxChars) {
    entry.replay = entry.replay.slice(-maxChars)
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
    logTruncated: entry.logTruncated,
    replayTruncated: entry.replayTruncated,
    adapter: entry.adapterType || null,
    lastError: entry.lastError || null,
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
  // 实时回放 / WebSocket 保持原文，避免脱敏改字节长度弄乱 TUI。
  appendReplay(entry, text)
  entry.pendingOutput += text
  if (entry.logStream && !entry.logTruncated) {
    const logged = redactText(text, redactOpts())
    const maxLog = quotaLimits().maxLogBytes
    const bytes = Buffer.byteLength(logged)
    const remaining = maxLog - entry.logBytes
    if (remaining > 0) {
      const chunk = bytes <= remaining ? logged : Buffer.from(logged).subarray(0, remaining)
      entry.logStream.write(chunk)
      entry.logBytes += Math.min(bytes, remaining)
    }
    if (bytes > remaining) {
      entry.logTruncated = true
      entry.logStream.write('\n[oh-my-co-work] terminal log truncated\n')
    }
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
  const allFinished = [...terminals.values()]
    .filter((t) => t.status !== 'running' && t.status !== 'starting')
    .sort((a, b) => String(b.finishedAt || '').localeCompare(String(a.finishedAt || '')))
  for (const entry of allFinished.slice(RETAIN_FINISHED_GLOBAL)) terminals.delete(entry.id)
}

/**
 * 在真实 PTY 内运行脚本。
 * 默认在终端退出后完成 Promise，因此现有流程引擎仍可按节点推进。
 * keepAlive=true 时（交互式常驻终端）在 PTY 启动成功后立即完成，进程继续存活供用户输入。
 */
export function runTerminal({
  launch,
  cwd,
  env,
  keepAlive = false,
  sessionId,
  nodeInstanceId,
  memberId,
  label,
  successCodes = [0],
  stdinText,
  cols = 100,
  rows = 30,
  adapter = null,
}) {
  return new Promise((resolve) => {
    // 常驻终端（keepAlive）会在启动成功后先行 resolve，让流程节点推进；
    // 之后 PTY 真正退出时仍要走完整清理，但不能重复 resolve。
    let resolved = false
    const settle = (payload) => {
      if (resolved) return
      resolved = true
      resolve(payload)
    }

    if (!sessionId) {
      settle({
        ok: false,
        summary: '内嵌终端必须绑定会话',
        error: { code: 'TERMINAL_SESSION_REQUIRED' },
      })
      return
    }

    // 同成员再开终端会先替换旧 PTY，配额按「替换后仍存活的其它终端」计。
    const running = countRunningTerminals(sessionId, { exceptMemberId: memberId || undefined })
    if (running >= quotaLimits().maxConcurrent) {
      settle({
        ok: false,
        summary: `该会话并发终端已达上限（${quotaLimits().maxConcurrent}）`,
        error: { code: 'TERMINAL_QUOTA' },
      })
      return
    }

    if (memberId) {
      stopMemberTerminals(sessionId, memberId)
      killMemberProcesses(sessionId, memberId, { includeDetach: true })
    }

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
      logStream: null,
      logBytes: 0,
      logTruncated: false,
      process: null,
      settled: false,
      timeout: null,
      inputWindowAt: Date.now(),
      inputBytesInWindow: 0,
      inputMessagesInWindow: 0,
      adapterType: null,
      adapterStop: null,
      adapterReplyPath: null,
    }
    terminals.set(id, entry)
    persistTerminal(entry)
    try {
      entry.logStream = fs.createWriteStream(logPath, { flags: 'a' })
      entry.logStream.on('error', () => {
        entry.logStream = null
      })
    } catch {
      entry.logStream = null
    }

    const finish = ({ exitCode = -1, signal = null, error = null } = {}) => {
      if (entry.settled) return
      entry.settled = true
      if (entry.timeout) clearTimeout(entry.timeout)
      if (entry.flushTimer) {
        clearTimeout(entry.flushTimer)
        flushOutput(entry)
      }
      entry.exitCode = Number.isFinite(Number(exitCode)) ? Number(exitCode) : -1
      entry.signal = signal || entry.signal || null
      entry.finishedAt = nowIso()
      if (error) entry.lastError = String(error.message || error)
      entry.status = error
        ? 'failed'
        : entry.status === 'killed' || entry.status === 'timed_out'
          ? entry.status
          : 'exited'
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
      unregisterProcess(sessionId, runId)
      persistTerminal(entry)
      emitTerminal(entry, 'terminal.exited', { terminal: publicTerminal(entry) })
      pruneFinished(sessionId)

      const ok = !error && entry.status === 'exited' && successCodes.includes(entry.exitCode)
      const summary = error
        ? `【${entry.label}】终端启动失败：${error.message}`
        : entry.status === 'timed_out'
          ? `【${entry.label}】终端执行超时`
          : entry.status === 'killed'
            ? `【${entry.label}】终端已停止`
            : ok
              ? `【${entry.label}】终端执行完成（exit ${entry.exitCode}）`
              : `【${entry.label}】终端执行失败（exit ${entry.exitCode}）`
      settle({
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
              code: error
                ? 'PTY_START_FAILED'
                : entry.status === 'timed_out'
                  ? 'TIMEOUT'
                  : entry.status === 'killed'
                    ? 'KILLED'
                    : 'EXIT',
              message: error?.message || summary,
            },
      })
    }

    try {
      const spec = normalizePtyLaunch(launch)
      const adapterEnabled =
        adapter === 'jsonl' ||
        adapter === true ||
        adapter?.type === 'jsonl' ||
        adapter?.enabled === true
      const paths = adapterEnabled
        ? {
            ...defaultAdapterPaths(cwd),
            ...(adapter?.eventsPath ? { eventsPath: path.resolve(String(adapter.eventsPath)) } : {}),
            ...(adapter?.replyPath ? { replyPath: path.resolve(String(adapter.replyPath)) } : {}),
          }
        : null
      const childEnv = {
        ...env,
        TERM: env?.TERM || 'xterm-256color',
        COLORTERM: env?.COLORTERM || 'truecolor',
      }
      if (paths) {
        childEnv.ACW_ADAPTER_EVENTS = paths.eventsPath
        childEnv.ACW_ADAPTER_REPLY = paths.replyPath
        childEnv.ECW_ADAPTER_EVENTS = paths.eventsPath
        childEnv.ECW_ADAPTER_REPLY = paths.replyPath
      }
      entry.process = pty.spawn(spec.file, spec.args, {
        name: 'xterm-256color',
        cols: entry.cols,
        rows: entry.rows,
        cwd,
        env: childEnv,
        useConpty: process.platform === 'win32',
      })
      entry.pid = entry.process.pid
      entry.status = 'running'
      persistTerminal(entry)
      registerProcess(sessionId, runId, {
        pid: entry.pid,
        kind: 'terminal',
        label: entry.label,
        memberId,
        // 常驻终端：节点推进后不随「释放进程」被回收，留给用户继续输入
        detach: !!keepAlive,
        child: entry.process,
      })
      if (paths) {
        entry.adapterType = 'jsonl'
        entry.adapterReplyPath = paths.replyPath
        entry.adapterStop = watchJsonlAdapter({
          eventsPath: paths.eventsPath,
          onEvent: (event) => {
            adapterEventHandler?.({
              sessionId,
              nodeInstanceId: entry.nodeInstanceId,
              memberId: entry.memberId,
              terminalId: entry.id,
              replyPath: entry.adapterReplyPath,
              event,
            })
          },
          onError: (error) => {
            emitTerminal(entry, 'terminal.adapter_error', {
              code: error?.code || 'ADAPTER_ERROR',
              message: error?.message || 'adapter event ignored',
            })
          },
        })
      }
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

      if (keepAlive) {
        // 交互式常驻终端：启动成功即视为本节点成功，进程留在会话里供用户继续输入。
        settle({
          ok: true,
          summary: `【${entry.label}】终端已就绪（pid ${entry.pid}），可直接输入；进程将保留至您停止或到设置释放资源`,
          terminalId: id,
          detached: true,
          keepAlive: true,
          data: {
            terminalId: id,
            code: null,
            signal: null,
            cwd,
            runtime: entry.runtime,
            label: entry.label,
            log: logName,
            executionMode: 'terminal',
            keepAlive: true,
          },
        })
        return
      }
    } catch (error) {
      const msg = String(error?.message || error || 'spawn failed')
      queueOutput(entry, `\r\n[oh-my-co-work] 启动失败：${msg}\r\n`)
      flushOutput(entry)
      finish({ error })
    }
  })
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
  const entry = terminals.get(terminalId)
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

export function readTerminalLogPath(sessionId, terminalId) {
  const entry = terminals.get(terminalId)
  if (!entry || entry.sessionId !== sessionId) return null
  if (entry.logPath && fs.existsSync(entry.logPath)) return entry.logPath
  return null
}

export function forgetSessionTerminals(sessionId) {
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

export function killTerminal(id, reason = 'user') {
  const entry = terminals.get(id)
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
    if (entry.pendingOutput) {
      if (entry.flushTimer) clearTimeout(entry.flushTimer)
      flushOutput(entry)
    }
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
    const now = Date.now()
    if (now - entry.inputWindowAt >= 1000) {
      entry.inputWindowAt = now
      entry.inputBytesInWindow = 0
      entry.inputMessagesInWindow = 0
    }
    entry.inputBytesInWindow += Buffer.byteLength(data)
    entry.inputMessagesInWindow += 1
    if (
      entry.inputBytesInWindow > MAX_INPUT_BYTES_PER_SECOND ||
      entry.inputMessagesInWindow > MAX_INPUT_MESSAGES_PER_SECOND
    ) {
      send(ws, {
        type: 'terminal.error',
        payload: { terminalId, code: 'INPUT_RATE_LIMITED', message: '终端输入过于频繁' },
      })
      return true
    }
    try {
      if (entry.status === 'running') entry.process.write(data)
    } catch {
      send(ws, {
        type: 'terminal.error',
        payload: { terminalId, code: 'TERMINAL_NOT_RUNNING', message: '终端已结束' },
      })
    }
    return true
  }
  if (message.type === 'terminal.resize') {
    const cols = clampSize(message.cols ?? message.payload?.cols, entry.cols, 20, 300)
    const rows = clampSize(message.rows ?? message.payload?.rows, entry.rows, 5, 120)
    entry.cols = cols
    entry.rows = rows
    try {
      if (entry.status === 'running') entry.process.resize(cols, rows)
    } catch {
      send(ws, {
        type: 'terminal.error',
        payload: { terminalId, code: 'RESIZE_FAILED', message: '终端尺寸同步失败' },
      })
    }
    return true
  }
  if (message.type === 'terminal.kill') {
    killTerminal(terminalId, 'user')
    return true
  }
  return true
}

