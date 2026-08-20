/**
 * 把本轮熔炉合同写入 Grok 会自动装载的本机 md（cwd 内 AGENTS 标记块）。
 * 默认 cwd 仍是 data/furnace，与 ACTIVE.md / GUI inbox 同目录。
 * 禁止写用户全局 ~/.grok/AGENTS.md。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { FURNACE_ROLE } from '@acw/shared'
import { clipFurnaceText, furnaceHomeDir, furnaceMemoryDir } from './furnaceContext.js'
import { grokHomeDir } from './grokStatus.js'
import { getAppSettings } from './appSettings.js'

export const FURNACE_AGENTS_BEGIN = '<!-- oh-my-co-work-furnace:begin -->'
export const FURNACE_AGENTS_END = '<!-- oh-my-co-work-furnace:end -->'

const LAUNCH_PROMPT = {
  [FURNACE_ROLE.SESSION]:
    '你是熔炉主持。先读本目录 AGENTS.md 标记块与 ACTIVE.md。复述当前格（节点一览里标了「现在」的那一行），提醒缺输入。不要改编排、不过闸、不改代码。',
  [FURNACE_ROLE.MEMBER_ADAPT]:
    '你是熔炉成员适配。先读本目录 AGENTS.md 与 ACTIVE.md。只把当前执行者接到工作台，不要改其它节点。',
  [FURNACE_ROLE.NODE_ADAPT]:
    '你是熔炉节点适配。先读本目录 AGENTS.md 与 ACTIVE.md。只接当前这一格；改不了则保留适配标记。',
  [FURNACE_ROLE.REVIEW]:
    '你是熔炉系统审核。先读本目录 AGENTS.md 与 ACTIVE.md。只对当前格通过或拒绝，不要改编排、不要改代码。',
}

/** 默认与熔炉本机上下文同目录，保证 inbox 相对路径仍对。 */
export function defaultGrokWorkspaceDir() {
  return furnaceHomeDir()
}

export function expandUserPath(p) {
  const s = String(p || '').trim()
  if (!s) return defaultGrokWorkspaceDir()
  if (s === '~') return os.homedir()
  if (s.startsWith('~/') || s.startsWith('~\\')) return path.join(os.homedir(), s.slice(2))
  return path.resolve(s)
}

/**
 * 熔炉 Grok cwd。ACW_GROK_WORKSPACE 便于测试。
 * 空 workspaceDir = data/furnace。若填成 ~/.grok 本体则回落到熔炉目录。
 */
export function resolveGrokWorkspaceDir(grok = {}) {
  const env = String(process.env.ACW_GROK_WORKSPACE || '').trim()
  if (env) return path.resolve(expandUserPath(env))
  const custom = String(grok.workspaceDir || '').trim()
  let dir = custom ? expandUserPath(custom) : furnaceHomeDir()
  const home = path.resolve(grokHomeDir())
  if (path.resolve(dir) === home) dir = furnaceHomeDir()
  return dir
}

export function ensureGrokWorkspace(dir) {
  const cwd = dir || resolveGrokWorkspaceDir(getAppSettings().grok || {})
  fs.mkdirSync(path.join(cwd, '.grok', 'rules'), { recursive: true })
  return cwd
}

export function withGrokPrompt(command, prompt) {
  const base = String(command || 'grok').trim() || 'grok'
  const text = String(prompt || '').trim()
  if (!text) return base
  if (/(^|\s)--prompt(\s|=)/.test(base)) return base
  return `${base} --prompt ${JSON.stringify(text)}`
}

export function buildGrokLaunchPrompt(role) {
  return LAUNCH_PROMPT[role] || LAUNCH_PROMPT[FURNACE_ROLE.SESSION]
}

export function upsertMarkedBlock(
  filePath,
  innerBody,
  { begin = FURNACE_AGENTS_BEGIN, end = FURNACE_AGENTS_END } = {},
) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const block = `${begin}\n${String(innerBody || '').trim()}\n${end}\n`
  let existing = ''
  try {
    existing = fs.readFileSync(filePath, 'utf8')
  } catch {
    existing = ''
  }
  const beginIdx = existing.indexOf(begin)
  const endIdx = existing.indexOf(end)
  if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
    const after = existing.slice(endIdx + end.length).replace(/^\r?\n/, '')
    fs.writeFileSync(filePath, `${existing.slice(0, beginIdx)}${block}${after}`, 'utf8')
    return { ok: true, mode: 'replace' }
  }
  if (beginIdx !== -1 || endIdx !== -1) {
    const bak = `${filePath}.bak-furnace`
    fs.writeFileSync(bak, existing, 'utf8')
    fs.writeFileSync(filePath, block, 'utf8')
    return { ok: true, mode: 'reset', backup: bak }
  }
  const next = existing.trimEnd() ? `${existing.replace(/\s*$/, '')}\n\n${block}` : block
  fs.writeFileSync(filePath, next, 'utf8')
  return { ok: true, mode: existing.trim() ? 'append' : 'create' }
}

export function removeMarkedBlock(
  filePath,
  { begin = FURNACE_AGENTS_BEGIN, end = FURNACE_AGENTS_END } = {},
) {
  if (!fs.existsSync(filePath)) return { ok: true, mode: 'missing' }
  const existing = fs.readFileSync(filePath, 'utf8')
  const beginIdx = existing.indexOf(begin)
  const endIdx = existing.indexOf(end)
  if (beginIdx === -1 && endIdx === -1) return { ok: true, mode: 'absent' }
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    const bak = `${filePath}.bak-furnace`
    fs.writeFileSync(bak, existing, 'utf8')
    return { ok: false, mode: 'malformed', backup: bak }
  }
  const before = existing.slice(0, beginIdx)
  const after = existing.slice(endIdx + end.length).replace(/^\r?\n/, '')
  const next = `${before}${after}`.replace(/\n{3,}/g, '\n\n')
  fs.writeFileSync(filePath, next, 'utf8')
  return { ok: true, mode: 'removed' }
}

export function grokRulesWriteAllowed(grok = {}, { ready } = {}) {
  if (grok.writeRules === false) return false
  if (grok.configured === false) return false
  if (ready === false) return false
  return true
}

function composeAgentsInner(pack) {
  const sit = clipFurnaceText(pack?.situationText || '', 1600)
  const mem = furnaceMemoryDir()
  return [
    '# 熔炉 · oh-my-co-work',
    '',
    '你在本机协同台「熔炉」里工作。只使用当前角色。先读本块与同目录 ACTIVE.md。',
    '只处理节点一览里标了「现在」的那一格；其它行是地图，不要提前执行、不要改编排。',
    'GUI 附件在 inbox/<会话>/，用相对路径打开。不要改全局 ~/.grok/AGENTS.md。',
    `本轮角色：${pack?.label || ''}（${pack?.role || ''}）`,
    '',
    sit || '（尚无会话情境）',
    '',
    '全文：同目录 ACTIVE.md',
    `风格记忆目录：${mem}（不要把本场事实写进去）`,
  ].join('\n')
}

/**
 * 写入 cwd：AGENTS 只动标记块；rules/session.md 整份覆盖。
 * ACTIVE / SITUATION 仅在 cwd 不是熔炉目录时复制一份（默认 cwd 就是熔炉目录，已由 activateFurnaceRole 写好）。
 * 绝不写入 grokHome/AGENTS.md。
 */
export function maybeInjectGrokFurnace(pack, overrides = {}) {
  const grok = overrides.grok || getAppSettings().grok || {}
  const cwd = ensureGrokWorkspace(overrides.cwd || resolveGrokWorkspaceDir(grok))
  const grokHome = path.resolve(grokHomeDir())
  if (path.resolve(cwd) === grokHome) {
    return { wrote: false, skipped: 'refuse_grok_home', cwd }
  }
  const allowed = grokRulesWriteAllowed(grok, { ready: overrides.ready })
  if (!allowed) {
    return {
      wrote: false,
      skipped: grok.writeRules === false ? 'write_rules_off' : 'grok_not_ready',
      cwd,
    }
  }

  const agentsMd = path.join(cwd, 'AGENTS.md')
  const activeMd = path.join(cwd, 'ACTIVE.md')
  const situationMd = path.join(cwd, 'SITUATION.md')
  const sessionRule = path.join(cwd, '.grok', 'rules', 'session.md')
  const furnaceHome = path.resolve(furnaceHomeDir())
  const sameAsFurnace = path.resolve(cwd) === furnaceHome

  if (!sameAsFurnace) {
    if (pack?.text) fs.writeFileSync(activeMd, pack.text, 'utf8')
    if (pack?.situationText) fs.writeFileSync(situationMd, pack.situationText, 'utf8')
  }

  const inner = composeAgentsInner(pack)
  const agents = upsertMarkedBlock(agentsMd, inner)
  fs.writeFileSync(
    sessionRule,
    [`# 熔炉本轮：${pack?.label || ''}`, '', inner, ''].join('\n'),
    'utf8',
  )

  return {
    wrote: true,
    cwd,
    agentsMd,
    activeMd: sameAsFurnace ? pack?.activeMd || activeMd : activeMd,
    situationMd: sameAsFurnace ? pack?.situationMd || situationMd : situationMd,
    sessionRule,
    agentsMode: agents.mode,
    backup: agents.backup || null,
  }
}

export function formatFurnaceRoleNotice(pack) {
  const label = pack?.label || '熔炉'
  const grok = pack?.grok
  if (grok?.wrote && grok.agentsMd) {
    return `熔炉本轮：${label}（已写入 ACTIVE.md 与 ${grok.agentsMd}；新开一轮熔炉或在 TUI 里再说一句即可）`
  }
  return `熔炉本轮：${label}（prompt 与记忆已写入 ${pack?.activeMd || 'data/furnace'}）`
}

export function removeFurnaceGrokBlock(grok = {}) {
  const cwd = resolveGrokWorkspaceDir(grok)
  const agentsMd = path.join(cwd, 'AGENTS.md')
  const result = removeMarkedBlock(agentsMd)
  const sessionRule = path.join(cwd, '.grok', 'rules', 'session.md')
  if (fs.existsSync(sessionRule)) fs.unlinkSync(sessionRule)
  return { ...result, cwd, agentsMd }
}
