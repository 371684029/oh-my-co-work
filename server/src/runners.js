import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { DATA_ROOT } from './db.js'
import {
  registerProcess,
  unregisterProcess,
  killProcessTree,
  killMemberProcesses,
  launchArchiveControlWindow,
  writeRunTargetPid,
  getRunPidFilePath,
} from './processRegistry.js'
import {
  uid,
  applyParamPlaceholders,
  getParamsMap,
  DEFAULT_SCRIPT_TIMEOUT_MS,
  formatScriptUserSummary,
  injectCallArgsParam,
} from '@acw/shared'
import { resolveShowScriptPopup } from './appSettings.js'
import { decodeConsoleBytes, consoleChildEnv } from './consoleEncoding.js'
import { runTerminal } from './terminal/terminalService.js'

/**
 * 工作文件夹候选（用于解析「相对路径的脚本文件」落在哪）
 * 不含「脚本所在目录」——那是文件定位成功后的运行 cwd
 */
export function resolveWorkFolderCandidates({ member, group, sessionContext, scriptCfg }) {
  const list = []
  const push = (p) => {
    if (p && typeof p === 'string' && p.trim() && !list.includes(p)) list.push(p)
  }
  push(scriptCfg?.cwd)
  push(member?.work_folder)
  push(sessionContext?.primaryWorkFolder)
  push(sessionContext?.workFolders?.[0])
  push(group?.work_folder)
  push(process.cwd())
  return list
}

/**
 * 脚本工作目录（与成员/会话「工作文件夹」无关）
 * 兼容旧字段 scriptDir
 */
export function getScriptWorkDir(script) {
  if (!script || typeof script !== 'object') return ''
  const w = script.scriptWorkDir || script.scriptDir || ''
  return String(w).trim()
}

/** 保存成员/指令时校验 */
export function assertScriptWorkDirConfigured(script) {
  const w = getScriptWorkDir(script)
  if (!w) {
    const err = new Error('请填写脚本工作目录')
    err.code = 'NO_SCRIPT_WORK_DIR'
    throw err
  }
  return w
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

/**
 * 解析脚本运行 cwd（不用成员/群/会话工作文件夹）
 */
export function resolveCwdForScript(scriptCfg, filePath) {
  if (!scriptCfg || typeof scriptCfg !== 'object') return null
  if (scriptCfg.cwd) return String(scriptCfg.cwd)

  const sw = getScriptWorkDir(scriptCfg)
  if (sw && fs.existsSync(sw)) return path.resolve(sw)

  if (filePath) {
    try {
      const dir = path.dirname(path.resolve(String(filePath)))
      if (fs.existsSync(dir)) return dir
    } catch {
      /* ignore */
    }
  }
  return null
}

/**
 * 解析脚本运行 cwd（非 script 场景遗留；script 请用 resolveCwdForScript）
 */
export function resolveCwd({ member, group, sessionContext, scriptCfg, filePath }) {
  if (scriptCfg) {
    const sw = resolveCwdForScript(scriptCfg, filePath)
    if (sw) return sw
  }
  if (scriptCfg?.cwd) return scriptCfg.cwd

  const workCandidates = [
    member?.work_folder,
    sessionContext?.primaryWorkFolder,
    sessionContext?.workFolders?.[0],
    group?.work_folder,
  ].filter((p) => p && fs.existsSync(String(p)))

  // 文件脚本：在工作目录内 → cwd=脚本目录；外部工具（Cursor CLI）→ 优先工作目录
  if (filePath) {
    try {
      const abs = path.resolve(String(filePath))
      const dir = path.dirname(abs)
      const underWork = workCandidates.some((w) => {
        const root = path.resolve(String(w))
        const prefix = root.endsWith(path.sep) ? root : root + path.sep
        return abs === root || abs.startsWith(prefix) || dir === root || dir.startsWith(prefix)
      })
      if (underWork && fs.existsSync(dir)) return dir
      if (!underWork && workCandidates[0]) return path.resolve(String(workCandidates[0]))
      if (fs.existsSync(dir)) return dir
    } catch {
      /* ignore */
    }
  }
  if (workCandidates[0]) return path.resolve(String(workCandidates[0]))
  return process.cwd()
}

/**
 * 将配置中的脚本路径解析为绝对路径
 * 相对路径**仅**相对 scriptWorkDir（与成员/会话工作文件夹无关）
 */
export function resolveScriptFilePath(rawPath, { scriptWorkDir, scriptDir } = {}) {
  if (!rawPath || !String(rawPath).trim()) return null
  const p = String(rawPath).trim()
  if (path.isAbsolute(p)) return path.resolve(p)
  const base = getScriptWorkDir({ scriptWorkDir, scriptDir })
  if (!base) return null
  return path.resolve(base, p)
}

/**
 * 从 command 行里抽出「像脚本文件」的片段（如 node index.mjs → index.mjs）
 * @param {string} command
 * @returns {string|null}
 */
export function extractScriptPathFromCommand(command) {
  const s = String(command || '').trim()
  if (!s) return null
  const parts = s.match(/(?:[^\s"'`]+|"[^"]*"|'[^']*')+/g) || []
  const extRe = /\.(mjs|cjs|js|ts|tsx|jsx|bat|cmd|ps1|py|sh)$/i
  for (let i = parts.length - 1; i >= 0; i--) {
    let t = parts[i].replace(/^["']|["']$/g, '').trim()
    if (!t || t.startsWith('-')) continue
    if (extRe.test(t)) return t
  }
  return null
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
 * Windows bat/cmd：先 chcp 65001 再 call，避免 UTF-8 中文脚本被 CP936 拆成乱码「不是内部或外部命令」
 * @param {string} absPath
 * @param {string[]} [userArgs]
 */
export function winBatCallCommand(absPath, userArgs = []) {
  const bat = `"${String(absPath).replace(/"/g, '')}"`
  const extra = (userArgs || [])
    .map((a) => {
      const s = String(a)
      if (!s.length) return '""'
      if (/[\s"&<>|^]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    })
    .join(' ')
  // 同一 cmd 会话内先改代码页再 call，批处理中文/括号才能正确解析
  return extra
    ? `chcp 65001>nul & call ${bat} ${extra}`
    : `chcp 65001>nul & call ${bat}`
}

/**
 * 根据扩展名 / runtime 解析启动方式
 * @returns {{ cmd: string, args: string[], shell?: boolean, label: string }}
 */
export function resolveLaunchSpec({ filePath, command, shell, runtime, args = [] }) {
  const isWin = process.platform === 'win32'
  const extraArgs = Array.isArray(args) ? args.map(String) : []

  // —— 一段命令 ——
  if (!filePath && command) {
    let sh = (shell || runtime || 'auto').toLowerCase()
    // auto：识别 PowerShell 语法，避免 $env: 被 cmd 当字面量执行
    if (sh === 'auto' && /\$env:|\$PSVersionTable|Set-Location\b|Write-Host\b/i.test(command)) {
      sh = 'powershell'
    }
    if (sh === 'powershell' || sh === 'ps' || sh === 'pwsh') {
      const exe = sh === 'pwsh' ? 'pwsh' : 'powershell.exe'
      return {
        cmd: exe,
        args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
        label: 'powershell',
      }
    }
    if (sh === 'bash' || sh === 'sh') {
      const exe = sh === 'sh' ? 'sh' : 'bash'
      return { cmd: exe, args: ['-lc', command], label: exe }
    }
    if (sh === 'cmd' || (sh === 'auto' && isWin)) {
      return {
        cmd: process.env.ComSpec || 'cmd.exe',
        args: ['/d', '/s', '/c', command],
        label: 'cmd',
      }
    }
    // unix auto / shell
    return { cmd: command, args: [], shell: true, label: 'shell' }
  }

  // —— 脚本文件 ——
  const abs = filePath
  const ext = path.extname(abs).toLowerCase()
  const rt = (runtime || 'auto').toLowerCase()

  // 显式 runtime 覆盖
  if (rt && rt !== 'auto') {
    if (rt === 'python' || rt === 'python3' || rt === 'py') {
      const py = isWin ? 'python' : 'python3'
      return { cmd: py, args: [abs, ...extraArgs], label: 'python' }
    }
    if (rt === 'node' || rt === 'nodejs') {
      return { cmd: 'node', args: [abs, ...extraArgs], label: 'node' }
    }
    if (rt === 'powershell' || rt === 'ps1') {
      return {
        cmd: 'powershell.exe',
        args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', abs, ...extraArgs],
        label: 'powershell',
      }
    }
    if (rt === 'pwsh') {
      return {
        cmd: 'pwsh',
        args: ['-NoProfile', '-File', abs, ...extraArgs],
        label: 'pwsh',
      }
    }
    if (rt === 'bash' || rt === 'sh') {
      return { cmd: rt === 'sh' ? 'sh' : 'bash', args: [abs, ...extraArgs], label: rt }
    }
    if (rt === 'cmd' || rt === 'bat') {
      return {
        cmd: process.env.ComSpec || 'cmd.exe',
        args: ['/d', '/s', '/c', `"${abs}"${extraArgs.length ? ' ' + extraArgs.map(a => `"${a}"`).join(' ') : ''}`],
        label: 'cmd',
      }
    }
    // 自定义解释器路径：runtime 即可执行文件
    return { cmd: runtime, args: [abs, ...extraArgs], label: path.basename(runtime) }
  }

  // 按扩展名
  switch (ext) {
    case '.ps1':
      return {
        cmd: 'powershell.exe',
        args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', abs, ...extraArgs],
        label: 'powershell',
      }
    case '.bat':
    case '.cmd':
      // UTF-8 中文 bat：必须先 chcp 65001 再 call（见 screenShot.bat）
      return {
        cmd: process.env.ComSpec || 'cmd.exe',
        args: isWin
          ? ['/d', '/s', '/c', winBatCallCommand(abs, extraArgs)]
          : ['/d', '/s', '/c', 'call', abs, ...extraArgs],
        label: 'bat',
      }
    case '.sh':
    case '.bash':
      return {
        cmd: isWin ? 'bash' : ext === '.bash' ? 'bash' : 'bash',
        args: [abs, ...extraArgs],
        label: 'bash',
      }
    case '.py':
    case '.pyw':
      return {
        cmd: isWin ? 'python' : 'python3',
        args: [abs, ...extraArgs],
        label: 'python',
      }
    case '.js':
    case '.mjs':
    case '.cjs':
      return { cmd: 'node', args: [abs, ...extraArgs], label: 'node' }
    case '.ts':
    case '.tsx':
      // 优先 tsx / ts-node，失败由 spawn error 暴露
      return { cmd: 'npx', args: ['--yes', 'tsx', abs, ...extraArgs], label: 'tsx' }
    case '.rb':
      return { cmd: 'ruby', args: [abs, ...extraArgs], label: 'ruby' }
    case '.pl':
      return { cmd: 'perl', args: [abs, ...extraArgs], label: 'perl' }
    case '.php':
      return { cmd: 'php', args: [abs, ...extraArgs], label: 'php' }
    case '.vbs':
      return { cmd: 'cscript.exe', args: ['//Nologo', abs, ...extraArgs], label: 'vbs' }
    case '.wsf':
      return { cmd: 'cscript.exe', args: ['//Nologo', abs, ...extraArgs], label: 'wsf' }
    case '.exe':
    case '.com':
      return { cmd: abs, args: extraArgs, label: 'exe' }
    case '.jar':
      return { cmd: 'java', args: ['-jar', abs, ...extraArgs], label: 'java' }
    default: {
      // 无扩展名或未知：尝试直接执行（需可执行权限 / PATHEXT）
      if (isWin) {
        return {
          cmd: process.env.ComSpec || 'cmd.exe',
          args: ['/d', '/s', '/c', abs, ...extraArgs],
          label: 'exec',
        }
      }
      return { cmd: abs, args: extraArgs, label: 'exec' }
    }
  }
}

/**
 * @param member
 * @param {{ group, sessionContext, humanInput, sessionId?: string, nodeInstanceId?: string }} opts
 */
export async function runMember(
  member,
  { group, sessionContext, humanInput, sessionId, nodeInstanceId, params } = {},
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
    const tpl = config.defaultText || humanInput || 'echo: ok'
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
    const timeoutMs =
      Number(script.timeoutMs) > 0 ? Number(script.timeoutMs) : DEFAULT_SCRIPT_TIMEOUT_MS
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

    const cwd = resolveCwdForScript(script, mode === 'file' ? filePath : null)
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

    const launch = resolveLaunchSpec({
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
      return runTerminal({
        launch,
        cwd,
        timeoutMs,
        // 交互式常驻终端（如 cmd / bash / TUI 工具）：进程留着可继续输入，
        // 但节点不等它退出，否则必然挂到超时。复用弹窗模式的 detach/waitForExit 语义。
        keepAlive: detach,
        env,
        sessionId,
        nodeInstanceId,
        memberId: member.id,
        label,
        successCodes,
        stdinText: passStdin && humanInput != null ? String(humanInput) : script.stdinText || null,
        cols: script.terminal?.cols,
        rows: script.terminal?.rows,
      })
    }

    return runProcess({
      launch,
      cwd,
      timeoutMs,
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

/** PowerShell 单引号转义 */
function psSingleQuote(s) {
  return `'${String(s).replace(/'/g, "''")}'`
}

/**
 * 启动脚本进程。
 * Windows 弹窗：Start-Process 可见 cmd；bat 经 chcp 65001 + call（UTF-8 中文脚本安全）
 * 真实 PID 写入 pid 文件，归档可杀干净
 * @param {{ detach?: boolean }} [opts] detach=true：只唤起窗口，不等待结束（Cursor CLI 等）
 */
function spawnScriptChild({
  launch,
  cwd,
  env,
  showConsole,
  isWin,
  filePath,
  targetPidFile,
  detach = false,
}) {
  const baseCwd = cwd && fs.existsSync(cwd) ? cwd : process.cwd()
  const baseEnv = env

  if (showConsole && isWin) {
    const pidWrite = targetPidFile
      ? `if ($p -ne $null) { Set-Content -LiteralPath ${psSingleQuote(targetPidFile)} -Value $p.Id -Encoding ascii }`
      : ''

    // 仅唤起：直接 Start-Process 目标 .cmd/.bat，避免 cmd /c 包一层导致闪退难查
    const directDetach =
      detach && filePath && /\.(cmd|bat)$/i.test(String(filePath)) && fs.existsSync(filePath)

    const args = launch.args || []
    const argPart =
      args.length > 0 ? `-ArgumentList @(${args.map((a) => psSingleQuote(a)).join(',')})` : ''
    const startCore = directDetach
      ? [
          `$p = Start-Process -FilePath ${psSingleQuote(path.resolve(filePath))}`,
          `-WorkingDirectory ${psSingleQuote(baseCwd)}`,
          '-PassThru',
        ].join(' ')
      : [
          `$p = Start-Process -FilePath ${psSingleQuote(launch.cmd)}`,
          argPart,
          `-WorkingDirectory ${psSingleQuote(baseCwd)}`,
          '-PassThru',
        ]
          .filter(Boolean)
          .join(' ')
    console.log(
      `[acw] popup: ${directDetach ? filePath : `${launch.cmd} ${(args || []).join(' ').slice(0, 100)}`} cwd=${baseCwd} detach=${!!detach}`,
    )

    const ps = detach
      ? [startCore, pidWrite, 'if ($null -eq $p) { exit 1 }', 'exit 0'].filter(Boolean).join('; ')
      : [
          startCore,
          pidWrite,
          'if ($null -eq $p) { exit 1 }',
          '$p.WaitForExit()',
          'exit $p.ExitCode',
        ]
          .filter(Boolean)
          .join('; ')

    return spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      {
        cwd: baseCwd,
        env: baseEnv,
        windowsHide: true,
        shell: false,
      },
    )
  }

  return spawn(launch.cmd, launch.args || [], {
    cwd: baseCwd,
    env: baseEnv,
    windowsHide: !showConsole,
    shell: launch.shell === true,
  })
}

/** 脚本结果摘要：业务向短文案（路径/命令行进 data，不进聊天主文） */
function buildScriptSummary({ ok, exitCode, stdout, stderr, label }) {
  return formatScriptUserSummary({ ok, exitCode, stdout, stderr, label })
}

function runProcess({
  launch,
  cwd,
  timeoutMs,
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
    const captureLog = path.join(DATA_ROOT, 'logs', `run_${runId}.console.log`)
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
        // 外层 launcher 可卸；detach 的真实窗口 PID 要保留，供归档杀、且避免节点结束误杀
        unregisterProcess(sessionId, runId)
        if (!detach && !preserveConsole) unregisterProcess(sessionId, `${runId}_target`)
        unregisterProcess(sessionId, `${runId}_hta`)
      }
      resolve(result)
    }

    const timer = setTimeout(() => {
      try {
        if (pid) killProcessTree(pid)
        else child.kill()
      } catch {
        /* ignore */
      }
      finish({
        ok: false,
        summary: `【${displayLabel}】超时 (${timeoutMs}ms)`,
        error: { code: 'TIMEOUT' },
        data: {
          stdout: decodeConsoleBytes(Buffer.concat(chunks)),
          cwd,
          pid,
          runtime: launch.label,
        },
      })
    }, timeoutMs)

    child.stdout?.on('data', (d) => chunks.push(d))
    child.stderr?.on('data', (d) => errChunks.push(d))

    child.on('error', (e) => {
      clearTimeout(timer)
      finish({
        ok: false,
        summary: `【${displayLabel}】${e.message}`,
        error: { code: 'PROCESS', message: e.message },
      })
    })

    child.on('close', (code) => {
      clearTimeout(timer)
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
          path.join(DATA_ROOT, 'logs', logName),
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
