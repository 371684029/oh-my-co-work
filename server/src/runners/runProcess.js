import fs from 'node:fs'
import path from 'node:path'
import { uid } from '@acw/shared'
import { DATA_ROOT } from '../db.js'
import {
  registerProcess,
  unregisterProcess,
  killMemberProcesses,
  launchArchiveControlWindow,
  writeRunTargetPid,
  getRunPidFilePath,
} from '../processRegistry.js'
import { decodeConsoleBytes } from '../consoleEncoding.js'
import { buildScriptSummary, spawnScriptChild } from './scriptSpawn.js'

export function runProcess({
  context,
  launch,
  cwd,
  env,
  showConsole = true,
  controlWindow = false,
  detach = false,
  sessionId,
  memberId,
  label,
  sessionTitle,
  successCodes = [0],
  stdinText,
  filePath,
  command,
}) {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32'
    let child
    const chunks = []
    const errChunks = []
    const runId = uid('run')
    const captureLog = path.join(context?.DATA_ROOT || DATA_ROOT, 'logs', `run_${runId}.console.log`)
    const displayLabel = label || filePath || command || 'script'
    const targetPidFile =
      sessionId && showConsole && isWin ? getRunPidFilePath(sessionId, runId) : null
    const preserveConsole = !!(showConsole && isWin && !detach)

    if (sessionId && memberId) {
      try {
        const killed = killMemberProcesses(sessionId, memberId, { includeDetach: true })
        if (killed.killed > 0) {
          console.log(
            `[acw] member single-process: killed ${killed.killed} old run(s) for ${memberId} in ${sessionId}`,
          )
        }
      } catch {
        /* ignore */
      }
    }

    try {
      console.log(
        `[acw] runProcess showConsole=${showConsole} controlWindow=${controlWindow} label=${displayLabel}`,
      )
      child = spawnScriptChild({
        launch,
        cwd,
        env,
        showConsole,
        isWin,
        filePath,
        targetPidFile,
        detach,
      })
    } catch (e) {
      resolve({
        ok: false,
        summary: `【${displayLabel}】启动失败: ${e.message}`,
        error: { code: 'SPAWN', message: e.message },
      })
      return
    }

    const pid = child.pid
    if (sessionId && pid) {
      registerProcess(sessionId, runId, {
        pid,
        kind: launch.label || 'script',
        label: displayLabel,
        memberId: memberId || null,
        child,
      })
      if (targetPidFile) {
        let tries = 0
        const poll = setInterval(() => {
          tries += 1
          try {
            if (fs.existsSync(targetPidFile)) {
              const tpid = parseInt(fs.readFileSync(targetPidFile, 'utf8').trim(), 10)
              if (Number.isFinite(tpid) && tpid > 0) {
                writeRunTargetPid(sessionId, runId, tpid)
                registerProcess(sessionId, `${runId}_target`, {
                  pid: tpid,
                  kind: 'script-window',
                  label: `${displayLabel} (window)`,
                  memberId: memberId || null,
                  detach: !!detach || preserveConsole,
                })
                console.log(
                  `[acw] tracked script window pid=${tpid} for ${runId} detach=${!!detach || preserveConsole}`,
                )
                clearInterval(poll)
                return
              }
            }
          } catch {
            /* ignore */
          }
          if (tries >= 40) clearInterval(poll)
        }, 100)
      }
      if (controlWindow && isWin) {
        try {
          const ctl = launchArchiveControlWindow({
            sessionId,
            runId,
            title: `ECW · ${displayLabel}${sessionTitle ? ` · ${sessionTitle}` : ''}`.slice(
              0,
              80,
            ),
          })
          if (ctl?.pid) {
            console.log(`[acw] HTA control window pid=${ctl.pid}`)
            registerProcess(sessionId, `${runId}_hta`, {
              pid: ctl.pid,
              kind: 'control',
              label: '资源控制窗',
              memberId: memberId || null,
            })
          } else {
            console.warn('[acw] HTA control window failed to start')
          }
        } catch (e) {
          console.warn('[acw] HTA control window error', e?.message || e)
        }
      }
    }

    if (!showConsole || !isWin) {
      if (stdinText != null && child.stdin) {
        try {
          child.stdin.write(stdinText)
          child.stdin.end()
        } catch {
          /* ignore */
        }
      } else if (child.stdin) {
        try {
          child.stdin.end()
        } catch {
          /* ignore */
        }
      }
    } else if (child.stdin) {
      try {
        child.stdin.end()
      } catch {
        /* ignore */
      }
    }

    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      if (sessionId) {
        unregisterProcess(sessionId, runId)
        if (!detach && !preserveConsole) unregisterProcess(sessionId, `${runId}_target`)
        unregisterProcess(sessionId, `${runId}_hta`)
      }
      resolve(result)
    }

    child.stdout?.on('data', (d) => chunks.push(d))
    child.stderr?.on('data', (d) => errChunks.push(d))

    child.on('error', (e) => {
      finish({
        ok: false,
        summary: `【${displayLabel}】${e.message}`,
        error: { code: 'PROCESS', message: e.message },
      })
    })

    child.on('close', (code) => {
      let stdout = decodeConsoleBytes(Buffer.concat(chunks))
      let stderr = decodeConsoleBytes(Buffer.concat(errChunks))

      if (showConsole && isWin) {
        try {
          if (fs.existsSync(captureLog)) {
            const raw = fs.readFileSync(captureLog)
            const text = decodeConsoleBytes(raw)
            if (text.trim()) {
              stdout = text
              if (!stderr && /Error:|Cannot find|MODULE_NOT_FOUND/i.test(text)) {
                stderr = text
              }
            }
          }
        } catch {
          /* ignore */
        }
        if (!stdout.trim() && !stderr.trim()) {
          const ec = code == null ? -1 : code
          if (detach && successCodes.includes(ec)) {
            stdout = `【${displayLabel}】已打开独立控制台（不等待结束）`
          } else {
            stdout = successCodes.includes(ec)
              ? `【${displayLabel}】已在独立控制台完成（exit ${ec}）${
                  preserveConsole ? '；窗口将保留至您关闭或流程进入下一步' : ''
                }`
              : `【${displayLabel}】控制台已结束（exit ${ec}），详见弹窗输出`
          }
        }
      }

      const logName = `run_${Date.now()}.log`
      try {
        fs.writeFileSync(
          path.join(context?.DATA_ROOT || DATA_ROOT, 'logs', logName),
          `cwd=${cwd}\npid=${pid}\ncode=${code}\ndetach=${!!detach}\nruntime=${launch.label}\nlabel=${displayLabel}\ncmd=${launch.cmd} ${(launch.args || []).join(' ')}\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}\n`,
        )
      } catch {
        /* ignore */
      }
      const exitCode = code == null ? -1 : code
      const ok = successCodes.includes(exitCode)
      const summary = detach && ok
        ? `已打开【${displayLabel}】`
        : buildScriptSummary({
            ok,
            exitCode,
            stdout,
            stderr,
            label: displayLabel,
            cwd,
            launch,
            filePath,
            command,
          })
      finish({
        ok,
        summary,
        detached: !!detach,
        preserveConsole,
        data: {
          code: exitCode,
          pid,
          runtime: launch.label,
          label: displayLabel,
          stdout: stdout.slice(0, 80_000),
          stderr: stderr.slice(0, 40_000),
          cwd,
          log: logName,
          cmd: launch.cmd,
          args: launch.args,
          detach: !!detach,
          preserveConsole,
        },
        error: ok
          ? undefined
          : {
              code: 'EXIT',
              message: summary.split('\n').find((l) => l.startsWith('原因:')) || `exit ${exitCode}`,
            },
      })
    })
  })
}
