/**
 * Dry-run member steps without executing scripts/agents (5.3.0 FLW-02).
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  applyParamPlaceholders,
  injectCallArgsParam,
  getParamsMap,
  isFurnaceMember,
} from '@acw/shared'
import { getAppSettings } from './appSettings.js'
import { getScriptWorkDir, resolveScriptFilePath } from './runners.js'
import { probeGrokStatusAsync, probeCursorStatusAsync } from './grokStatus.js'
import { resolvePromptSnippetRefs } from './promptSnippets.js'

function pushItem(items, { level, text }) {
  items.push({ level, text })
}

/**
 * @returns {Promise<{ ok: boolean, summary: string, data: object }>}
 */
export async function dryRunMemberStep(
  member,
  { group, sessionContext, humanInput, params, sessionId } = {},
) {
  const items = []
  const config =
    typeof member.config_json === 'string'
      ? JSON.parse(member.config_json || '{}')
      : member.config || {}
  const snippets = getAppSettings().promptSnippets || []
  const paramsMap = injectCallArgsParam(
    params || getParamsMap(sessionContext),
    humanInput,
  )
  const phExtra = {
    input: paramsMap['#a'] != null && paramsMap['#a'] !== '' ? paramsMap['#a'] : humanInput,
    folder: sessionContext?.primaryWorkFolder || group?.work_folder || '',
    cwd: sessionContext?.primaryWorkFolder || group?.work_folder || '',
    sessionId: sessionId || '',
  }

  pushItem(items, { level: 'info', text: `成员：${member.display_name || member.name}（${member.kind}）` })
  pushItem(items, {
    level: 'info',
    text: `工作目录：${phExtra.cwd || '（未设，将回落进程 cwd）'}`,
  })

  const quota = getAppSettings().quota || {}
  pushItem(items, {
    level: 'info',
    text: `终端并发配额：最多 ${quota.maxConcurrentTerminals || 8} 个/会话`,
  })

  if (member.kind === 'echo') {
    const tpl = resolvePromptSnippetRefs(
      config.defaultText || humanInput || 'echo: ok',
      snippets,
    )
    const text = applyParamPlaceholders(tpl, paramsMap, phExtra)
    pushItem(items, { level: 'ok', text: `将输出回声文本（约 ${String(text).length} 字）` })
    return finish(items, true)
  }

  if (member.kind === 'script') {
    const script = config.script || config
    const mode = script.mode || (script.filePath || script.path ? 'file' : 'command')
    if (mode === 'file') {
      const raw = script.filePath || script.path
      if (!raw) {
        pushItem(items, { level: 'error', text: '未配置脚本文件路径' })
        return finish(items, false)
      }
      const expanded = applyParamPlaceholders(String(raw), paramsMap, phExtra)
      const filePath = resolveScriptFilePath(expanded, {
        scriptWorkDir: getScriptWorkDir(script),
      })
      if (!filePath || !fs.existsSync(filePath)) {
        pushItem(items, { level: 'error', text: `脚本文件不存在：${expanded}` })
        return finish(items, false)
      }
      pushItem(items, { level: 'ok', text: `将执行脚本文件：${path.resolve(filePath)}` })
    } else {
      const command = applyParamPlaceholders(String(script.command || ''), paramsMap, phExtra)
      if (!command?.trim()) {
        pushItem(items, { level: 'error', text: '命令占位替换后为空' })
        return finish(items, false)
      }
      pushItem(items, { level: 'ok', text: `将运行命令：${command.slice(0, 200)}` })
    }
    const cwd = getScriptWorkDir(script) || phExtra.cwd || process.cwd()
    pushItem(items, { level: 'info', text: `脚本 cwd：${cwd}` })
    return finish(items, !items.some((i) => i.level === 'error'))
  }

  if (isFurnaceMember(member) || member.kind === 'furnace') {
    const grok = getAppSettings().grok || {}
    const grokProbe = await probeGrokStatusAsync({ command: grok.command })
    pushItem(items, {
      level: grokProbe.installed ? 'ok' : 'error',
      text: grokProbe.installed
        ? `Grok CLI：${grokProbe.command || grok.command}`
        : `Grok CLI 未就绪：${grokProbe.gap || '未安装'}`,
    })
    const cursorProbe = await probeCursorStatusAsync({ command: grok.cursorCommand })
    pushItem(items, {
      level: cursorProbe.installed ? 'ok' : 'warn',
      text: cursorProbe.installed
        ? `Cursor CLI：${cursorProbe.command || grok.cursorCommand}`
        : `Cursor CLI：${cursorProbe.gap || '未检测到（部分熔炉能力可能不可用）'}`,
    })
    const ok = !items.some((i) => i.level === 'error')
    return finish(items, ok)
  }

  pushItem(items, { level: 'warn', text: `未知成员类型 ${member.kind}，仅做参数与路径检查` })
  return finish(items, true)
}

function finish(items, ok) {
  const lines = items.map((i) => {
    const tag = i.level === 'error' ? '✗' : i.level === 'warn' ? '!' : '·'
    return `${tag} ${i.text}`
  })
  return {
    ok,
    summary: ok
      ? `试运行通过（${items.length} 项检查）\n${lines.join('\n')}`
      : `试运行发现问题\n${lines.join('\n')}`,
    data: { dryRun: true, checklist: items },
  }
}
