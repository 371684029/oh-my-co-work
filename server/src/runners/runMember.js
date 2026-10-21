import path from 'node:path'
import fs from 'node:fs'
import {
  applyParamPlaceholders,
  getParamsMap,
  injectCallArgsParam,
  isFurnaceMember,
} from '@acw/shared'
import { DATA_ROOT } from '../db.js'
import { resolveShowScriptPopup } from '../appSettings.js'
import { consoleChildEnv } from '../consoleEncoding.js'
import { runTerminal } from '../terminal/terminalService.js'
import { applyFurnaceGrokRuntime } from '../furnaceSituation.js'
import { composeMemberPrompt } from '../promptSnippets.js'
import { getAppSettings } from '../appSettings.js'
import { listAgentDefinitions } from '../agentRegistry.js'
import { getScriptWorkDir } from './scriptWorkDir.js'
import { resolveCwdForScript, resolveScriptFilePath } from './cwdResolve.js'
import { resolveLaunchSpec } from './launchSpec.js'
import { runProcess } from './runProcess.js'
import {
  enrichScriptConfig,
  usesKeepAlive,
  usesTerminalExecution,
} from './scriptMemberConfig.js'

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
    const showConsole = resolveShowScriptPopup(script)
    const controlWindow =
      script.showControlWindow === true && process.platform === 'win32'
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
      ECW_SESSION_ID: sessionId || '',
      ECW_MEMBER_ID: member.id || '',
      ECW_HUMAN_INPUT: humanInput != null ? String(humanInput) : '',
      ECW_PARAMS_JSON: JSON.stringify(paramsMap || {}),
      ECW_SCRIPT_PATH: filePath || '',
      ECW_CWD: cwd || '',
    })
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
