import fs from 'node:fs'
import path from 'node:path'
import * as pty from 'node-pty'
import { inferFurnaceAgent, uid } from '@acw/shared'
import { DATA_ROOT, getDb } from '../db.js'
import { setWsTerminalAttach } from '../bus.js'
import { quotaLimits } from './quota.js'
import { publicTerminal } from './publicTerminal.js'
import { normalizePtyLaunch, resolveWindowsExecutable } from './ptyLaunch.js'
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
import { clampTerminalSize } from './inputLimits.js'
import { handleTerminalClientMessage as handleTerminalClientMessageImpl } from './clientMessage.js'
import {
  deleteTerminalLogForEntry,
  readTerminalLogPath as readTerminalLogPathImpl,
  readTerminalLogPreview as readTerminalLogPreviewImpl,
} from './terminalLog.js'
import { emitTerminal, flushOutput, queueOutput } from './terminalOutput.js'
import { persistTerminal } from './terminalPersist.js'

export { normalizePtyLaunch, resolveWindowsExecutable }

const terminals = new Map()

const RETAIN_FINISHED = 20
const RETAIN_FINISHED_GLOBAL = 200

let adapterEventHandler = null

export function setAdapterEventHandler(fn) {
  adapterEventHandler = typeof fn === 'function' ? fn : null
}

function countRunningTerminals(sessionId, { exceptMemberId, exceptPair } = {}) {
  return [...terminals.values()].filter((t) => {
    if (t.sessionId !== sessionId) return false
    if (t.status !== 'running' && t.status !== 'starting') return false
    if (exceptPair?.memberId && t.memberId === exceptPair.memberId) {
      if (inferFurnaceAgent(t) === exceptPair.furnaceAgent) return false
    } else if (exceptMemberId && t.memberId === exceptMemberId) {
      return false
    }
    return true
  }).length
}

function stopMemberTerminals(sessionId, memberId, { furnaceAgent } = {}) {
  if (!sessionId || !memberId) return
  const onlyAgent = furnaceAgent === 'cursor' || furnaceAgent === 'grok' ? furnaceAgent : null
  for (const entry of [...terminals.values()]) {
    if (entry.sessionId !== sessionId || entry.memberId !== memberId) continue
    if (entry.status !== 'running' && entry.status !== 'starting') continue
    if (onlyAgent && inferFurnaceAgent(entry) !== onlyAgent) continue
    killTerminal(entry.id, 'replaced')
  }
}

function nowIso() {
  return new Date().toISOString()
}

const clampSize = clampTerminalSize

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
  furnaceAgent = null,
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

    const agentKind = furnaceAgent === 'cursor' || furnaceAgent === 'grok' ? furnaceAgent : null
    // 同成员再开终端会先替换旧 PTY；双 Agent 只替换同一 Agent，另一路常驻。
    const running = countRunningTerminals(sessionId, {
      exceptMemberId: agentKind ? undefined : memberId || undefined,
      exceptPair:
        agentKind && memberId ? { memberId, furnaceAgent: agentKind } : undefined,
    })
    if (running >= quotaLimits().maxConcurrent) {
      settle({
        ok: false,
        summary: `该会话并发终端已达上限（${quotaLimits().maxConcurrent}）`,
        error: { code: 'TERMINAL_QUOTA' },
      })
      return
    }

    if (memberId) {
      stopMemberTerminals(sessionId, memberId, { furnaceAgent: agentKind })
      if (!agentKind) {
        killMemberProcesses(sessionId, memberId, { includeDetach: true })
      }
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
      command: [launch?.cmd, ...(Array.isArray(launch?.args) ? launch.args : [])]
        .filter(Boolean)
        .join(' '),
      furnaceAgent: agentKind,
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

/**
 * On server boot, any terminal the DB still considers live was orphaned by a
 * crash/restart (its in-memory PTY is gone). Mark it interrupted so the UI can
 * show "已中断，可重启同配置会话" instead of a phantom "running". (5.1.0 CLI-17)
 * @returns {number} rows updated (0 when the table is unavailable, e.g. in tests)
 */
export function markInterruptedTerminalsOnBoot() {
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

