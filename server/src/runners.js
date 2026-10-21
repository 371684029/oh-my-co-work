import { DATA_ROOT } from './db.js'
import path from 'node:path'
import fs from 'node:fs'

import {
  registerProcess,
  unregisterProcess,
  killMemberProcesses,
  launchArchiveControlWindow,
  writeRunTargetPid,
  getRunPidFilePath,
} from './processRegistry.js'
import {
  uid,
  applyParamPlaceholders,
  getParamsMap,
  injectCallArgsParam,
  isFurnaceMember,
} from '@acw/shared'
import { resolveShowScriptPopup } from './appSettings.js'
import { decodeConsoleBytes, consoleChildEnv } from './consoleEncoding.js'
import { runTerminal } from './terminal/terminalService.js'
import { applyFurnaceGrokRuntime } from './furnaceSituation.js'
import { composeMemberPrompt } from './promptSnippets.js'
import { getAppSettings } from './appSettings.js'
import { listAgentDefinitions } from './agentRegistry.js'

import {
  resolveWorkFolderCandidates,
  getScriptWorkDir,
  assertScriptWorkDirConfigured,
} from './runners/scriptWorkDir.js'
import {
  resolveCwd,
  resolveCwdForScript,
  resolveScriptFilePath,
  extractScriptPathFromCommand,
} from './runners/cwdResolve.js'
import { resolveLaunchSpec, winBatCallCommand } from './runners/launchSpec.js'
import {
  buildScriptSummary,
  spawnScriptChild,
} from './runners/scriptSpawn.js'

export { resolveWorkFolderCandidates, getScriptWorkDir, assertScriptWorkDirConfigured }
export {
  resolveCwd,
  resolveCwdForScript,
  resolveScriptFilePath,
  extractScriptPathFromCommand,
  resolveLaunchSpec,
  winBatCallCommand,
}

function mirrorScriptWorkDirFields(script) {
  if (!script || typeof script !== 'object') return script
  const w = getScriptWorkDir(script)
  if (w) {
    script.scriptWorkDir = w
    script.scriptDir = w
  }
  return script
}

export function usesTerminalExecution(script) {
  return script?.executionMode !== 'pipe'
}

/**
 * 常驻进程：节点启动成功即推进，不等待退出。
 * 内嵌终端默认常驻（grok / CLI / TUI）；显式 waitForExit:true 或 detach:false 才等待退出。
 * 普通执行仅在 detach:true / waitForExit:false 时常驻。
 */
export function usesKeepAlive(script) {
  if (script?.waitForExit === true || script?.detach === false) return false
  if (script?.detach === true || script?.waitForExit === false) return true
  return usesTerminalExecution(script)
}

/**
 * 补全 scriptWorkDir（选脚本 / 命令中的脚本名 / 绝对路径）
 * @param {object} script
 */
export function enrichScriptConfig(script) {
  if (!script || typeof script !== 'object') return script
  const next = { ...script }
  delete next.timeoutMs
  if (next.executionMode !== 'pipe' && next.executionMode !== 'terminal') {
    next.executionMode = 'terminal'
  }
  const raw =
    next.filePath ||
    next.path ||
    next.scriptPath ||
    extractScriptPathFromCommand(next.command)
  if (raw && !next.scriptPath && !next.filePath && !next.path) {
    next.scriptPath = String(raw).trim()
  }

  const existing = getScriptWorkDir(next)
  if (existing && fs.existsSync(existing)) {
    return mirrorScriptWorkDirFields(next)
  }

  if (!raw || !String(raw).trim()) return mirrorScriptWorkDirFields(next)

  const trimmed = String(raw).trim()
  if (path.isAbsolute(trimmed)) {
    if (fs.existsSync(trimmed)) {
      next.scriptWorkDir = path.dirname(path.resolve(trimmed))
    } else {
      const d = path.dirname(path.resolve(trimmed))
      if (fs.existsSync(d)) next.scriptWorkDir = d
    }
    return mirrorScriptWorkDirFields(next)
  }

  const sw = getScriptWorkDir(next)
  if (sw) {
    const abs = path.resolve(sw, trimmed)
    if (fs.existsSync(abs)) {
      next.scriptWorkDir = path.dirname(abs)
    }
  }
  return mirrorScriptWorkDirFields(next)
}

/**
 * @param member
 * @param {{ group, sessionContext, humanInput, sessionId?: string, nodeInstanceId?: string }} opts
 */
export async function runMember(
  member,
  { group: _group, sessionContext, humanInput, sessionId, nodeInstanceId, params } = {},
) {
  const kind = member.kind
  const config =
    typeof member.config_json === 'string'
      ? JSON.parse(member.config_json || '{}')
      : member.config || {}

  const paramsMap = injectCallArgsParam(
    params || getParamsMap(sessionContext),
    humanInput,
  )
  const phExtra = {
    input: paramsMap['#a'] != null && paramsMap['#a'] !== '' ? paramsMap['#a'] : humanInput,
    folder: null,
    cwd: null,
    sessionId: sessionId || '',
  }

  if (kind === 'echo') {
    const snippets = getAppSettings().promptSnippets || []
    const tpl = composeMemberPrompt(
      config.defaultText || humanInput || 'echo: ok',
      config,
      snippets,
    )
    const text = applyParamPlaceholders(tpl, paramsMap, {
      ...phExtra,
      input: humanInput != null ? humanInput : tpl,
    })
    return {
      ok: true,
      summary: String(text),
      data: { echo: text, params: paramsMap },
    }
  }

  if (kind === 'script') {
    const script = enrichScriptConfig({ ...(config.script || config) })
    const mode = script.mode || (script.filePath || script.path ? 'file' : 'command')
    // 弹窗优先级：成员 script.showScriptPopup > 遗留 showConsole/hideWindow > 全局
    const showConsole = resolveShowScriptPopup(script)
    // HTA「释放资源」小窗：默认永不弹（占地方、几乎无用）
    // 仅成员配置显式 showControlWindow===true 时才开（调试用）
    const controlWindow =
      script.showControlWindow === true && process.platform === 'win32'
    // 仅唤起：弹窗启动后不等待结束（Cursor CLI 等交互工具）
    const detach = usesKeepAlive(script)
    const label = member.display_name || member.name || 'script'
    const successCodes = Array.isArray(script.successCodes)
      ? script.successCodes.map(Number)
      : [0]
    const passStdin =
      script.passHumanInput === true ||
      script.stdin === true ||
      (humanInput != null && script.passHumanInput !== false && script.useHumanAsStdin === true)

    const scriptWorkDir = getScriptWorkDir(script)
    phExtra.folder = scriptWorkDir || ''
    phExtra.cwd = scriptWorkDir || ''

    let filePath = null
    let command = null
    let args = Array.isArray(script.args) ? script.args.map(String) : []
    args = args.map((a) => applyParamPlaceholders(a, paramsMap, phExtra))

    if (mode === 'file') {
      const raw = script.filePath || script.path
      if (!raw) return { ok: false, summary: '未配置脚本文件路径', error: { code: 'NO_FILE' } }
      const expanded = applyParamPlaceholders(String(raw), paramsMap, phExtra)
      filePath = resolveScriptFilePath(expanded, {
        scriptWorkDir: getScriptWorkDir(script),
      })
      if (!filePath || !fs.existsSync(filePath)) {
        const hint = getScriptWorkDir(script)
          ? ''
          : '（请先配置脚本工作目录，或选择脚本文件以自动填写）'
        return {
          ok: false,
          summary: `脚本不存在: ${expanded}${hint}`,
          error: { code: 'FILE_MISSING', path: expanded },
        }
      }
      filePath = path.resolve(filePath)
    } else {
      command = script.command
      if (!command || !String(command).trim()) {
        return {
          ok: false,
          summary:
            '未配置命令：请在「设置 → 成员」中填写要执行的命令（走 PATH，勿写死机器路径/工具名）',
          error: { code: 'NO_COMMAND' },
        }
      }
      command = applyParamPlaceholders(String(command), paramsMap, phExtra)
      if (!command || !String(command).trim()) {
        return {
          ok: false,
          summary: '命令占位替换后为空，请检查成员命令与项目参数 #1…',
          error: { code: 'NO_COMMAND' },
        }
      }
    }

    let cwd = resolveCwdForScript(script, mode === 'file' ? filePath : null)
    let furnaceLaunch = null
    let furnaceAgent = null
    if (isFurnaceMember(member)) {
      const fx = applyFurnaceGrokRuntime({
        member,
        sessionId,
        command,
        furnaceAgent: sessionContext?.furnaceAgent,
      })
      if (fx) {
        if (mode !== 'file') command = fx.command
        cwd = fx.cwd
        furnaceLaunch = fx.launch || null
        furnaceAgent = fx.furnaceAgent || null
      }
    }
    if (!cwd) {
      return {
        ok: false,
        summary:
          '未配置脚本工作目录：请在成员里填写「脚本工作目录」，或选择脚本/锚点脚本自动填写（与会话工作文件夹无关）',
        error: { code: 'NO_SCRIPT_WORK_DIR' },
      }
    }
    phExtra.folder = cwd
    phExtra.cwd = cwd

    const env = consoleChildEnv({
      ...process.env,
      ...(script.env && typeof script.env === 'object'
        ? Object.fromEntries(
            Object.entries(script.env).map(([k, v]) => [
              k,
              applyParamPlaceholders(String(v ?? ''), paramsMap, phExtra),
            ]),
          )
        : {}),
      ACW_SESSION_ID: sessionId || '',
      ACW_MEMBER_ID: member.id || '',
      ACW_HUMAN_INPUT: humanInput != null ? String(humanInput) : '',
      ACW_PARAMS_JSON: JSON.stringify(paramsMap || {}),
      ACW_SCRIPT_PATH: filePath || '',
      ACW_CWD: cwd || '',
      ACW_ADAPTER_EVENTS: '',
      ACW_ADAPTER_REPLY: '',
      // 兼容旧脚本读 ECW_*
      ECW_SESSION_ID: sessionId || '',
      ECW_MEMBER_ID: member.id || '',
      ECW_HUMAN_INPUT: humanInput != null ? String(humanInput) : '',
      ECW_PARAMS_JSON: JSON.stringify(paramsMap || {}),
      ECW_SCRIPT_PATH: filePath || '',
      ECW_CWD: cwd || '',
    })
    // CI04：系统参数也写入 ACW_PARAM_群聊 / ACW_PARAM_文件夹 等（含无 # 前缀别名）
    Object.keys(paramsMap || {}).forEach((k) => {
      const v = String(paramsMap[k] ?? '')
      if (k.startsWith('#')) {
        const n = k.slice(1)
        env[`ACW_PARAM_${n}`] = v
        env[`ACW_PARAM_${k}`] = v
        env[`ECW_PARAM_${n}`] = v
        env[`ECW_PARAM_${k}`] = v
      } else if (k === '群聊' || k === '文件夹') {
        env[`ACW_PARAM_${k}`] = v
        env[`ECW_PARAM_${k}`] = v
      }
    })
    // 明确文件夹别名
    if (cwd) {
      env.ACW_FOLDER = String(cwd)
      env.ECW_FOLDER = String(cwd)
    }

    const launch =
      furnaceLaunch ||
      resolveLaunchSpec({
        filePath,
        command,
        shell: script.shell,
        runtime: script.runtime,
        args,
      })

    console.log(
      `[acw] script run label=${label} file=${filePath || '-'} cwd=${cwd} mode=${script.executionMode || 'terminal'} popup=${showConsole}`,
    )

    if (usesTerminalExecution(script)) {
      let adapter = script.adapter || script.terminal?.adapter || null
      if (!adapter && furnaceAgent) {
        const def = listAgentDefinitions().find((d) => d.id === furnaceAgent)
        if (def?.structuredAdapter === 'jsonl') adapter = 'jsonl'
      }
      if (script.sandbox?.readOnly === true) {
        env.ACW_SANDBOX_READONLY = '1'
      }
      return runTerminal({
        launch,
        cwd,
        keepAlive: detach,
        env,
        sessionId,
        nodeInstanceId,
        memberId: member.id,
        label,
        successCodes,
        stdinText: passStdin && humanInput != null ? String(humanInput) : script.stdinText || null,
        cols: isFurnaceMember(member) ? 120 : script.terminal?.cols,
        rows: isFurnaceMember(member) ? 40 : script.terminal?.rows,
        adapter,
        furnaceAgent,
      })
    }

    return runProcess({
      context: { DATA_ROOT },
      launch,
      cwd,
      env,
      showConsole,
      controlWindow,
      detach,
      sessionId,
      memberId: member.id,
      label,
      sessionTitle: sessionContext?.sessionTitle,
      successCodes,
      stdinText: passStdin && humanInput != null ? String(humanInput) : script.stdinText || null,
      filePath,
      command,
    })
  }

  return { ok: false, summary: `未知成员类型: ${kind}`, error: { code: 'UNKNOWN_KIND' } }
}

function runProcess({ context,
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
    /** Windows 弹窗脚本：默认保留黑窗，直至用户手动关或流程进入下一成员步/归档 */
    const preserveConsole = !!(showConsole && isWin && !detach)

    // 同一会话 + 同一成员：只保留一个脚本进程；新开前连旧的 detach 窗口一并清掉
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
      // 轮询读取 Start-Process 真实脚本 PID，归档时才能杀掉黑窗
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

    // 弹窗模式输出进文件，stdin 暂不支持；静默模式可写 stdin
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
        // 外层 launcher 可卸；detach 的真实窗口 PID 要保留，供设置里释放、且避免节点结束误杀
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

      // 弹窗交互模式不再重定向捕获；若仍有 captureLog 则读回（兼容旧包装）
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
        // 交互弹窗无管道输出：用退出码生成简短说明（细节在黑窗里）
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

/** 供设置页 / 文档展示 */
export const SUPPORTED_SCRIPT_HINTS = {
  fileExt: [
    '.bat',
    '.cmd',
    '.ps1',
    '.sh',
    '.bash',
    '.py',
    '.js',
    '.mjs',
    '.cjs',
    '.ts',
    '.rb',
    '.pl',
    '.php',
    '.vbs',
    '.jar',
    '.exe',
  ],
  runtimes: ['auto', 'cmd', 'powershell', 'pwsh', 'bash', 'python', 'node', '自定义解释器路径'],
  placeholders: ['#a', '{#a}', '{a}', '{input}', '{human}', '{folder}', '{cwd}', '{sessionId}'],
}
