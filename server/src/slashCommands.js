import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { ROOT } from './db.js'
import { getSessionDetail, getGroup, listMembers, createMember } from './services.js'
import { MEMBER_KIND, applyParamPlaceholders, SYSTEM_PARAM_KEYS } from '@acw/shared'
import { resolveShowScriptPopup } from './appSettings.js'
import {
  enrichScriptConfig,
  getScriptWorkDir,
  resolveScriptFilePath,
  extractScriptPathFromCommand,
} from './runners.js'

const CONFIG_PATH = path.join(ROOT, 'server/config/slash-commands.json')

/** 首位默认：统一管理员 Agent */
export const ADMIN_MEMBER = {
  name: 'unified_admin',
  displayName: '统一管理员',
  kind: MEMBER_KIND.ECHO,
  config: {
    role: 'admin',
    defaultText:
      '【统一管理员】收到。我是本机协同台的管理员 Agent，可协助调度、核对流程与本机事项（完全本地）。',
  },
}

const DEFAULT_COMMANDS = [
  {
    id: 'cmd_admin_agent',
    name: '统一管理员',
    slash: 'admin',
    description: '管理员 Agent：调度协同、本机事项与流程协助（首位默认）',
    enabled: true,
    kind: 'agent',
    memberName: '统一管理员',
    memberKey: 'unified_admin',
    prompt: '请【统一管理员】协助处理：',
  },
  {
    id: 'cmd_open_editor',
    name: '打开编辑器',
    slash: 'editor',
    description: '用本机编辑器打开当前工作文件夹',
    enabled: true,
    kind: 'shell',
    command: 'code "{folder}"',
    openTarget: 'sessionWorkFolder',
  },
  {
    id: 'cmd_open_folder',
    name: '打开工作文件夹',
    slash: 'folder',
    description: '用系统资源管理器打开当前工作文件夹',
    enabled: true,
    kind: 'shell',
    command: process.platform === 'win32' ? 'explorer "{folder}"' : 'open "{folder}"',
    openTarget: 'sessionWorkFolder',
  },
  {
    id: 'cmd_open_browser',
    name: '打开浏览器',
    slash: 'browser',
    description: '打开网址（可询问 URL）',
    enabled: true,
    kind: 'url',
    url: 'https://',
    promptForUrl: true,
  },
]

/** 确保存在「统一管理员」成员 Agent */
export function ensureAdminMember() {
  const list = listMembers()
  let m = list.find(
    (x) =>
      x.name === ADMIN_MEMBER.name ||
      x.display_name === ADMIN_MEMBER.displayName,
  )
  if (!m) {
    m = createMember({
      name: ADMIN_MEMBER.name,
      displayName: ADMIN_MEMBER.displayName,
      kind: ADMIN_MEMBER.kind,
      config: ADMIN_MEMBER.config,
    })
    console.log('[acw] seeded member: 统一管理员')
  }
  return m
}

function ensureConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
    fs.writeFileSync(
      CONFIG_PATH,
      JSON.stringify({ commands: DEFAULT_COMMANDS }, null, 2),
      'utf8',
    )
    return
  }
  // 已有配置：若缺少管理员首位指令，则插入到最前（不覆盖用户其它项）
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
    const list = Array.isArray(raw.commands) ? raw.commands : []
    const hasAdmin = list.some(
      (c) =>
        c.id === 'cmd_admin_agent' ||
        c.slash === 'admin' ||
        c.kind === 'agent' ||
        c.name === '统一管理员',
    )
    if (!hasAdmin) {
      const next = [DEFAULT_COMMANDS[0], ...list]
      fs.writeFileSync(CONFIG_PATH, JSON.stringify({ commands: next }, null, 2), 'utf8')
      console.log('[acw] prepended default slash: 统一管理员')
    }
  } catch {
    /* ignore */
  }
}

export function listSlashCommands() {
  ensureConfig()
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
    const list = Array.isArray(raw.commands) ? raw.commands : []
    return list.map(normalizeCommand)
  } catch {
    return DEFAULT_COMMANDS.map(normalizeCommand)
  }
}

function normalizeCommand(c) {
  const slash = String(c.slash || c.name || '')
    .trim()
    .replace(/^\//, '')
    .replace(/\s+/g, '')
  let kind = 'shell'
  if (c.kind === 'url') kind = 'url'
  else if (c.kind === 'agent') kind = 'agent'
  return {
    id: c.id || `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: String(c.name || slash || '未命名').trim(),
    slash,
    description: String(c.description || '').trim(),
    enabled: c.enabled !== false,
    kind,
    command: String(c.command || '').trim(),
    url: String(c.url || '').trim(),
    promptForUrl: !!c.promptForUrl,
    openTarget: c.openTarget || 'sessionWorkFolder',
    customPath: String(c.customPath || '').trim(),
    memberId: String(c.memberId || '').trim(),
    memberName: String(c.memberName || '').trim(),
    memberKey: String(c.memberKey || '').trim(),
    prompt: String(c.prompt || '').trim(),
    scriptPath: String(c.scriptPath || c.scriptFile || '').trim(),
    scriptWorkDir: String(c.scriptWorkDir || c.scriptDir || '').trim(),
    scriptDir: String(c.scriptWorkDir || c.scriptDir || '').trim(),
    anchorMemberId: String(c.anchorMemberId || '').trim(),
    /** 快捷键触发跑脚本（页内/桌面/任意绑定同一规则）：scriptWorkDir 仅用户手填 */
    hotkeyScript:
      c.hotkeyScript === true || c.desktopHotkey === true,
    /** @deprecated 使用 hotkeyScript */
    desktopHotkey: c.hotkeyScript === true || c.desktopHotkey === true,
    hotkey: String(c.hotkey || '').trim(),
  }
}

/** 快捷键触发脚本（非聊天 / 斜杠）；任意位置绑键共用此规则 */
export function isHotkeyScriptCommand(cmd) {
  return !!(cmd && (cmd.hotkeyScript === true || cmd.desktopHotkey === true))
}

/** @deprecated */
export function isDesktopHotkeyCommand(cmd) {
  return isHotkeyScriptCommand(cmd)
}

function mirrorSlashScriptWorkDir(next) {
  const w = getScriptWorkDir(next)
  if (w) {
    next.scriptWorkDir = w
    next.scriptDir = w
  }
  return next
}

/** 保存时补全 scriptWorkDir；斜杠指令自动推断，桌面快捷键仅保留用户填写 */
function enrichSlashCommand(cmd, { persist = false } = {}) {
  if (!cmd || cmd.kind !== 'shell') return cmd
  const next = { ...cmd }
  const anchor = next.scriptPath || extractScriptPathFromCommand(next.command)
  if (anchor && !next.scriptPath) next.scriptPath = anchor

  if (isHotkeyScriptCommand(next)) {
    return mirrorSlashScriptWorkDir(next)
  }

  const enriched = enrichScriptConfig({
    filePath: anchor,
    scriptPath: next.scriptPath,
    scriptWorkDir: next.scriptWorkDir || next.scriptDir,
    scriptDir: next.scriptDir,
    command: next.command,
  })
  const sw = getScriptWorkDir(enriched)
  if (sw) {
    next.scriptWorkDir = sw
    next.scriptDir = sw
  }
  if (enriched.scriptPath && !cmd.scriptPath) next.scriptPath = enriched.scriptPath
  return next
}

function slashHasScriptAnchor(cmd) {
  if (!cmd || cmd.kind !== 'shell') return false
  if (String(cmd.scriptPath || '').trim()) return true
  if (String(cmd.scriptWorkDir || cmd.scriptDir || '').trim()) return true
  if (cmd.anchorMemberId) return true
  return !!extractScriptPathFromCommand(cmd.command)
}

function getSlashScriptWorkDir(cmd) {
  let w = getScriptWorkDir(cmd)
  if (!isHotkeyScriptCommand(cmd) && !w && cmd.anchorMemberId) {
    const m = listMembers().find((x) => x.id === cmd.anchorMemberId)
    const sc = enrichScriptConfig({ ...(m?.config?.script || {}) })
    w = getScriptWorkDir(sc)
  }
  return w ? path.resolve(String(w)) : ''
}

/**
 * shell 子进程 cwd：有脚本锚点时仅用 scriptWorkDir / scriptPath；否则用会话工作目录目标
 */
function resolveSlashSpawnCwd(cmd, sessionId) {
  const sessionFolder = resolveFolder(cmd, sessionId)
  if (!slashHasScriptAnchor(cmd)) return sessionFolder

  if (isHotkeyScriptCommand(cmd)) {
    const scriptWorkDir = getSlashScriptWorkDir(cmd)
    return scriptWorkDir && fs.existsSync(scriptWorkDir) ? scriptWorkDir : ''
  }

  const scriptWorkDir = getSlashScriptWorkDir(cmd)
  if (scriptWorkDir && fs.existsSync(scriptWorkDir)) return scriptWorkDir

  const sp =
    String(cmd.scriptPath || '').trim() || extractScriptPathFromCommand(cmd.command) || ''
  if (sp) {
    const abs = resolveScriptFilePath(sp, {
      scriptWorkDir,
      scriptDir: scriptWorkDir,
    })
    if (abs && fs.existsSync(abs)) return path.dirname(path.resolve(abs))
  }

  return ''
}

export function saveSlashCommands(commands) {
  if (!Array.isArray(commands)) throw new Error('commands 必须是数组')
  const list = commands.map(normalizeCommand).map((c) => enrichSlashCommand(c, { persist: true }))
  const seen = new Set()
  for (const c of list) {
    if (!c.slash) throw new Error(`指令「${c.name}」缺少 / 触发词`)
    if (seen.has(c.slash.toLowerCase())) throw new Error(`触发词 /${c.slash} 重复`)
    seen.add(c.slash.toLowerCase())
    if (c.kind === 'shell' && !c.command) throw new Error(`指令「${c.name}」缺少本机命令`)
    if (c.kind === 'url' && !c.url && !c.promptForUrl) {
      throw new Error(`指令「${c.name}」缺少 URL 或未开启询问网址`)
    }
    if (c.kind === 'agent' && !c.memberId && !c.memberName && !c.memberKey) {
      throw new Error(`指令「${c.name}」需绑定管理员/成员 Agent`)
    }
    if (
      c.kind === 'shell' &&
      isHotkeyScriptCommand(c) &&
      slashHasScriptAnchor(c) &&
      !getScriptWorkDir(c)
    ) {
      throw new Error(`「${c.name}」为快捷键脚本，须手填脚本工作目录`)
    }
  }
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ commands: list }, null, 2), 'utf8')
  return list
}

function resolveFolder(cmd, sessionId) {
  if (cmd.openTarget === 'custom' && cmd.customPath) {
    return path.resolve(cmd.customPath)
  }
  if (sessionId) {
    try {
      const detail = getSessionDetail(sessionId)
      if (detail?.session) {
        const s = detail.session
        if (s.primary_work_folder) return path.resolve(s.primary_work_folder)
        if (s.group_id) {
          const g = getGroup(s.group_id)
          if (g?.work_folder) return path.resolve(g.work_folder)
        }
      }
    } catch {
      /* ignore */
    }
  }
  return process.cwd()
}

function applyTemplate(tpl, ctx) {
  const map = {
    [SYSTEM_PARAM_KEYS.CALL_ARGS]: ctx.args != null ? String(ctx.args) : '',
  }
  return applyParamPlaceholders(String(tpl || ''), map, {
    input: ctx.args != null ? String(ctx.args) : '',
    folder: ctx.folder,
    cwd: ctx.cwd != null ? ctx.cwd : ctx.folder,
    sessionId: ctx.sessionId || '',
  })
    .replaceAll('{path}', ctx.folder || '')
    .replaceAll('{title}', ctx.title || '')
    .replaceAll('{url}', ctx.url || '')
    .replaceAll('{agent}', ctx.agentName || '')
}

function findAgentMember(cmd) {
  const list = listMembers()
  if (cmd.memberId) {
    const byId = list.find((m) => m.id === cmd.memberId)
    if (byId) return byId
  }
  if (cmd.memberKey) {
    const byKey = list.find((m) => m.name === cmd.memberKey)
    if (byKey) return byKey
  }
  if (cmd.memberName) {
    const byName = list.find((m) => m.display_name === cmd.memberName)
    if (byName) return byName
  }
  // 回落统一管理员
  return (
    list.find((m) => m.name === ADMIN_MEMBER.name) ||
    list.find((m) => m.display_name === ADMIN_MEMBER.displayName) ||
    null
  )
}

/**
 * 执行快捷指令（仅本机）
 */
export async function runSlashCommand(id, { sessionId, url, args } = {}) {
  let cmd = listSlashCommands().find((c) => c.id === id)
  if (!cmd) throw new Error('指令不存在')
  if (!cmd.enabled) throw new Error('指令已禁用')
  if (cmd.kind === 'shell') {
    cmd = isHotkeyScriptCommand(cmd)
      ? mirrorSlashScriptWorkDir({ ...cmd })
      : enrichSlashCommand(cmd, { persist: true })
  }

  const sessionFolder = resolveFolder(cmd, sessionId)
  const scriptWorkDir = getSlashScriptWorkDir(cmd)
  const spawnCwd = resolveSlashSpawnCwd(cmd, sessionId)
  if (cmd.kind === 'shell' && slashHasScriptAnchor(cmd) && !spawnCwd) {
    throw new Error(
      isHotkeyScriptCommand(cmd)
        ? '快捷键跑脚本须在设置里手填脚本工作目录（不会自动用脚本所在目录）'
        : '请配置脚本工作目录，或选择脚本文件以自动填写（与会话/成员工作文件夹无关）',
    )
  }
  const callArgs = args != null ? String(args) : ''
  let title = ''
  try {
    if (sessionId) title = getSessionDetail(sessionId)?.session?.title || ''
  } catch {
    /* ignore */
  }

  // —— 管理员 / 成员 Agent ——
  if (cmd.kind === 'agent') {
    ensureAdminMember()
    const member = findAgentMember(cmd)
    if (!member) throw new Error('未找到绑定的管理员 Agent，请先在成员管理中创建')
    const agentName = member.display_name || cmd.memberName || '统一管理员'
    const insertText =
      applyTemplate(cmd.prompt || `请【{agent}】协助处理：`, {
        folder: sessionFolder,
        cwd: sessionFolder,
        sessionId: sessionId || '',
        title,
        url: '',
        agentName,
        args: callArgs,
      }) || `请【${agentName}】协助处理：`
    const withArgs = callArgs
      ? `${insertText}${insertText.endsWith('\n') ? '' : ' '}${callArgs}`.trim()
      : insertText
    return {
      ok: true,
      kind: 'agent',
      memberId: member.id,
      memberName: agentName,
      insertText: withArgs,
      args: callArgs,
      message: `已唤起「${agentName}」，请补充需求后发送`,
    }
  }

  const ctx = {
    folder: sessionFolder,
    cwd: slashHasScriptAnchor(cmd) && scriptWorkDir ? scriptWorkDir : sessionFolder,
    sessionId: sessionId || '',
    title,
    url: url || cmd.url || '',
    args: callArgs,
  }

  if (cmd.kind === 'url') {
    const finalUrl = applyTemplate(ctx.url || cmd.url, ctx)
    if (!finalUrl || finalUrl === 'https://') {
      throw new Error('请提供有效网址')
    }
    try {
      await spawnDetached(openBrowserCommand(finalUrl))
    } catch {
      /* 前端仍可打开 */
    }
    return {
      ok: true,
      kind: 'url',
      url: finalUrl,
      message: `已请求打开：${finalUrl}`,
    }
  }

  const line = applyTemplate(cmd.command, ctx)
  if (!line.trim()) throw new Error('命令为空')
  // 弹窗优先级：本指令 showScriptPopup > 全局
  const showPopup = resolveShowScriptPopup(cmd)
  await spawnDetached(line, spawnCwd || sessionFolder, { showPopup })
  return {
    ok: true,
    kind: 'shell',
    command: line,
    folder: spawnCwd || sessionFolder,
    sessionFolder,
    scriptWorkDir: scriptWorkDir || undefined,
    args: callArgs,
    showScriptPopup: showPopup,
    message: `已执行：${line}`,
  }
}

function openBrowserCommand(url) {
  if (process.platform === 'win32') {
    return `cmd /c start "" "${url.replace(/"/g, '')}"`
  }
  if (process.platform === 'darwin') return `open "${url.replace(/"/g, '\\"')}"`
  return `xdg-open "${url.replace(/"/g, '\\"')}"`
}

function spawnDetached(commandLine, cwd, { showPopup = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandLine, {
      cwd: cwd && fs.existsSync(cwd) ? cwd : process.cwd(),
      shell: true,
      detached: true,
      stdio: 'ignore',
      // showPopup=true 时尝试显示控制台（GUI 应用本身仍会弹自己的窗）
      windowsHide: !showPopup,
    })
    child.on('error', reject)
    child.unref()
    setTimeout(() => resolve({ pid: child.pid }), 80)
  })
}
