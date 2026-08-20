/**
 * 把短合同写入 Grok cwd 的 AGENTS 标记块；启动只用短 --prompt。
 * 长文在 ACTIVE.md，对话里不复述。禁止写 ~/.grok/AGENTS.md。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { FURNACE_ROLE } from '@acw/shared'
import { clipFurnaceText, furnaceHomeDir } from './furnaceContext.js'
import { grokHomeDir } from './grokStatus.js'
import { getAppSettings } from './appSettings.js'

export const FURNACE_AGENTS_BEGIN = '<!-- oh-my-co-work-furnace:begin -->'
export const FURNACE_AGENTS_END = '<!-- oh-my-co-work-furnace:end -->'

/** 短启动词：点名角色 + 四句自我介绍，禁止复述 ACTIVE。 */
const LAUNCH_PROMPT = {
  [FURNACE_ROLE.SESSION]:
    '熔炉主持。读 AGENTS.md。用不超过四句介绍你能做什么（看当前格、提醒缺输入、不改编排），然后停，等用户。勿复述 ACTIVE 全文。',
  [FURNACE_ROLE.MEMBER_ADAPT]:
    '熔炉成员适配。读 AGENTS.md。四句内说明：只把当前执行者接到工作台。然后停。勿复述全文。',
  [FURNACE_ROLE.NODE_ADAPT]:
    '熔炉节点适配。读 AGENTS.md。四句内说明：只接当前这一格。然后停。勿复述全文。',
  [FURNACE_ROLE.REVIEW]:
    '熔炉审核。读 AGENTS.md。四句内说明：只对当前格通过或拒绝。然后停。勿复述全文。',
}

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

export function resolveGrokWorkspaceDir(grok = {}) {
  const env = String(process.env.ACW_GROK_WORKSPACE || '').trim()
  if (env) return path.resolve(expandUserPath(env))
  const custom = String(grok.workspaceDir || '').trim()
  let dir = custom ? expandUserPath(custom) : furnaceHomeDir()
  if (path.resolve(dir) === path.resolve(grokHomeDir())) dir = furnaceHomeDir()
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
  fs.writeFileSync(filePath, `${before}${after}`.replace(/\n{3,}/g, '\n\n'), 'utf8')
  return { ok: true, mode: 'removed' }
}

export function grokRulesWriteAllowed(grok = {}, { ready } = {}) {
  if (grok.writeRules === false) return false
  if (grok.configured === false) return false
  if (ready === false) return false
  return true
}

function composeAgentsInner(pack) {
  const sit = clipFurnaceText(pack?.situationText || '', 420)
  return [
    '你是 oh-my-co-work「熔炉」：本机协同台里的 Grok，不是独立聊天窗。',
    `角色：${pack?.label || '主持'}（${pack?.role || ''}）。只做节点一览里标了「现在」的那一格。`,
    '用户可以：问进度/缺什么、适配接到工作台、过闸只说通过或拒绝、打开 inbox/ 相对路径附件。',
    '菜单和模型在 TUI。需要细节再读 ACTIVE.md，不要把全文贴进对话。',
    sit ? `此刻：${sit}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function maybeInjectGrokFurnace(pack, overrides = {}) {
  const grok = overrides.grok || getAppSettings().grok || {}
  const cwd = ensureGrokWorkspace(overrides.cwd || resolveGrokWorkspaceDir(grok))
  if (path.resolve(cwd) === path.resolve(grokHomeDir())) {
    return { wrote: false, skipped: 'refuse_grok_home', cwd }
  }
  if (!grokRulesWriteAllowed(grok, { ready: overrides.ready })) {
    return {
      wrote: false,
      skipped: grok.writeRules === false ? 'write_rules_off' : 'grok_not_ready',
      cwd,
    }
  }

  const agentsMd = path.join(cwd, 'AGENTS.md')
  const sessionRule = path.join(cwd, '.grok', 'rules', 'session.md')
  const furnaceHome = path.resolve(furnaceHomeDir())
  const sameAsFurnace = path.resolve(cwd) === furnaceHome
  if (!sameAsFurnace && pack?.text) {
    fs.writeFileSync(path.join(cwd, 'ACTIVE.md'), pack.text, 'utf8')
  }

  const inner = composeAgentsInner(pack)
  const agents = upsertMarkedBlock(agentsMd, inner)
  fs.writeFileSync(sessionRule, [`# 熔炉：${pack?.label || ''}`, '', inner, ''].join('\n'), 'utf8')
  return {
    wrote: true,
    cwd,
    agentsMd,
    activeMd: pack?.activeMd || path.join(cwd, 'ACTIVE.md'),
    sessionRule,
    agentsMode: agents.mode,
  }
}

export function formatFurnaceRoleNotice(pack) {
  const label = pack?.label || '熔炉'
  if (pack?.grok?.wrote) {
    return `熔炉本轮：${label}（短规则已写入 AGENTS.md，详情在 ACTIVE.md）`
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
