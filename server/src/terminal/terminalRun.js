import fs from 'node:fs'
import path from 'node:path'
import * as pty from 'node-pty'
import { uid } from '@acw/shared'
import { DATA_ROOT } from '../db.js'
import { quotaLimits } from './quota.js'
import { publicTerminal } from './publicTerminal.js'
import { normalizePtyLaunch } from './ptyLaunch.js'
import { defaultAdapterPaths, watchJsonlAdapter } from './adapters/jsonl.js'
import {
  killMemberProcesses,
  registerProcess,
  unregisterProcess,
} from '../processRegistry.js'
import { clampTerminalSize } from './inputLimits.js'
import { emitTerminal, flushOutput, queueOutput } from './terminalOutput.js'
import { persistTerminal } from './terminalPersist.js'
import { pruneFinishedTerminals } from './terminalLifecycle.js'
import { countRunningTerminals, stopMemberTerminals } from './terminalQuota.js'

const clampSize = clampTerminalSize

/**
 * Spawn and track a PTY terminal session (extracted from terminalService for SRV-04).
 * @param {object} deps
 * @param {Map} deps.terminals
 * @param {(id: string, reason?: string) => void} deps.killTerminal
 * @param {(payload: object) => void} [deps.adapterEventHandler]
 * @param {() => string} [deps.nowIso]
 */
export function runTerminalPty(
  deps,
  {
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
  },
) {
  const { terminals, killTerminal, adapterEventHandler, nowIso = () => new Date().toISOString() } =
    deps

  const pruneFinished = (sid) => {
    pruneFinishedTerminals(terminals, sid)
  }

  return new Promise((resolve) => {
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
    const running = countRunningTerminals(terminals, sessionId, {
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
      stopMemberTerminals(terminals, sessionId, memberId, {
        furnaceAgent: agentKind,
        killTerminal,
      })
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
