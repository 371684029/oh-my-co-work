/**
 * 熔炉角色壳 + 会话情境。
 * Prompt 随仓库；记忆在本机 data/furnace/memory（不覆盖已有）。
 * 开跑只装入当前角色，拼上 SITUATION，写成 ACTIVE.md。
 */
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, DATA_ROOT } from './db.js'
import { FURNACE_ROLE, FURNACE_ROLE_LABEL } from '@acw/shared'

const ROLE_FILES = {
  [FURNACE_ROLE.SESSION]: 'session.md',
  [FURNACE_ROLE.MEMBER_ADAPT]: 'member-adapt.md',
  [FURNACE_ROLE.NODE_ADAPT]: 'node-adapt.md',
  [FURNACE_ROLE.REVIEW]: 'review.md',
}

export const SITUATION_LIMITS = {
  intent: 2000,
  field: 800,
  total: 8000,
  params: 8,
  agenda: 30,
  prevOut: 240,
}

export function furnaceHomeDir() {
  return path.join(DATA_ROOT, 'furnace')
}

export function furnacePromptDir() {
  return path.join(ROOT, 'server/config/furnace/prompts')
}

export function furnaceMemorySeedDir() {
  return path.join(ROOT, 'server/config/furnace/memory-seed')
}

export function furnaceMemoryDir() {
  return path.join(furnaceHomeDir(), 'memory')
}

export function isFurnaceRole(role) {
  return !!ROLE_FILES[role]
}

export function ensureFurnaceWorkspace() {
  const home = furnaceHomeDir()
  const memDir = furnaceMemoryDir()
  fs.mkdirSync(memDir, { recursive: true })
  for (const file of Object.values(ROLE_FILES)) {
    const dest = path.join(memDir, file)
    if (fs.existsSync(dest)) continue
    const seed = path.join(furnaceMemorySeedDir(), file)
    if (fs.existsSync(seed)) fs.copyFileSync(seed, dest)
    else fs.writeFileSync(dest, `# ${file}\n`, 'utf8')
  }
  const readme = path.join(home, 'README.md')
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(
      readme,
      [
        '# 熔炉本机上下文',
        '',
        '角色壳各有 prompt（仓库）和 memory（本目录）。',
        '`ACTIVE.md` = 当前角色 + 此刻在做什么。`SITUATION.md` 是情境副本。',
        '`inbox/` = GUI 上传的附件，Grok 用相对路径打开。',
        '不要把多套角色 prompt 拼在一起。',
        '',
      ].join('\n'),
      'utf8',
    )
  }
  return home
}

function readUtf8(file) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

export function loadFurnacePrompt(role) {
  if (!isFurnaceRole(role)) throw new Error(`未知熔炉角色: ${role}`)
  return readUtf8(path.join(furnacePromptDir(), ROLE_FILES[role])).trim()
}

export function loadFurnaceMemory(role) {
  if (!isFurnaceRole(role)) throw new Error(`未知熔炉角色: ${role}`)
  ensureFurnaceWorkspace()
  return readUtf8(path.join(furnaceMemoryDir(), ROLE_FILES[role])).trim()
}

export function clipFurnaceText(s, max) {
  const t = String(s ?? '').trim()
  if (!max || t.length <= max) return t
  return `${t.slice(0, max)}\n…(截断)`
}

export function formatFurnaceAgendaLine(item, i, nowIndex) {
  const n = i + 1
  const raw = typeof item === 'string' ? { title: item } : item || {}
  const title = clipFurnaceText(raw.title || `步骤 ${n}`, 120) || `步骤 ${n}`
  const flags = []
  if (raw.adapt) flags.push('适配')
  if (raw.gateAdmin) flags.push('熔炉闸')
  if (raw.gateHuman) flags.push('人闸')
  const meta = [raw.kind, raw.member, ...flags].filter(Boolean).join(' · ')
  const status = raw.statusLabel ? ` · ${raw.statusLabel}` : ''
  const mark = i === nowIndex ? ' ← 现在' : ''
  const head = meta ? `#${n} [${meta}]` : `#${n}`
  return `  ${head} ${title}${status}${mark}`
}

export function composeFurnaceSituation(facts = {}) {
  const lim = SITUATION_LIMITS
  const intent =
    clipFurnaceText(facts.intent, lim.intent) ||
    clipFurnaceText(facts.groupDescription, lim.field) ||
    clipFurnaceText(facts.groupTitle, lim.field) ||
    '（无）'
  const agenda = Array.isArray(facts.agenda) ? facts.agenda.slice(0, lim.agenda) : []
  const nowIndex = Number(facts.nowIndex)
  const agendaLines = agenda.length
    ? agenda.map((item, i) => formatFurnaceAgendaLine(item, i, nowIndex))
    : ['  （无）']
  const now = facts.now && typeof facts.now === 'object' ? facts.now : {}
  const nowN = Number.isFinite(nowIndex) ? nowIndex + 1 : ''
  const nowWhat = [
    now.kind,
    now.member ? `执行者 ${now.member}` : '',
    now.adapt ? '勾了适配' : '',
    now.gateAdmin ? '熔炉闸' : '',
    now.gateHuman ? '人闸' : '',
  ]
    .filter(Boolean)
    .join(' · ')
  const nowBlock = [
    `当前节点：${nowN ? `#${nowN} ` : ''}${clipFurnaceText(now.title, lim.field) || '（尚未推进）'}`,
    `它是什么：${clipFurnaceText(nowWhat || now.status, lim.field) || '（无）'}`,
    `状态：${clipFurnaceText(now.statusLabel || now.status, 80) || '（无）'}`,
    `上一节点产出：${clipFurnaceText(now.prevOutput, lim.prevOut) || '（无）'}`,
    '合同：只处理当前节点。节点一览里其它行只是地图，不要提前执行、不要改编排。',
  ]
  const params = Array.isArray(facts.params) ? facts.params.slice(0, lim.params) : []
  const paramLines = params.length
    ? params.map((p) => {
        const key = p?.key || p?.name || '#'
        const val = clipFurnaceText(p?.value, lim.field) || '（空）'
        return `  - \`${key}\` ${val}`
      })
    : ['  （无）']
  const text = [
    `意图：${intent}`,
    `这场群：${clipFurnaceText(facts.groupTitle, lim.field) || '（无）'} · 会话 ${clipFurnaceText(facts.sessionTitle, lim.field) || '（无）'}`,
    `简介：${clipFurnaceText(facts.groupDescription, lim.field) || '（无）'}`,
    `工作文件夹：${clipFurnaceText(facts.workFolder, lim.field) || '（无）'}`,
    '节点一览：',
    ...agendaLines,
    ...nowBlock,
    '已知 # 参数：',
    ...paramLines,
    `群报告：${clipFurnaceText(facts.announcementPath, lim.field) || '（尚未生成）'}`,
  ].join('\n')
  return clipFurnaceText(text, lim.total)
}

export function composeFurnaceContext(role, { situation } = {}) {
  const prompt = loadFurnacePrompt(role)
  const memory = loadFurnaceMemory(role)
  const label = FURNACE_ROLE_LABEL[role] || role
  const sitText =
    typeof situation === 'string'
      ? situation.trim()
      : situation && typeof situation === 'object'
        ? composeFurnaceSituation(situation)
        : ''
  return [
    `# 熔炉本轮：${label}`,
    '',
    `角色 id：\`${role}\``,
    '只使用下面这一套角色。其它角色的 prompt / 记忆视为不存在。',
    '先读「此刻在做什么」里的节点一览和当前节点，再按 Prompt 行动。',
    '',
    '## 此刻在做什么',
    '',
    sitText || '（尚无会话情境）',
    '',
    '## Prompt',
    '',
    prompt || '（缺 prompt 文件）',
    '',
    '## 本机记忆',
    '',
    memory || '（尚无记忆）',
    '',
  ].join('\n')
}

export function currentFurnaceRole() {
  try {
    const raw = fs.readFileSync(path.join(furnaceHomeDir(), 'active.json'), 'utf8')
    const role = JSON.parse(raw)?.role
    return isFurnaceRole(role) ? role : FURNACE_ROLE.SESSION
  } catch {
    return FURNACE_ROLE.SESSION
  }
}

/**
 * 装入一套角色。返回 ACTIVE.md 路径。
 */
export function activateFurnaceRole(role, { sessionId, nodeId, situation } = {}) {
  if (!isFurnaceRole(role)) throw new Error(`未知熔炉角色: ${role}`)
  const home = ensureFurnaceWorkspace()
  const sitText =
    typeof situation === 'string'
      ? situation
      : situation && typeof situation === 'object'
        ? composeFurnaceSituation(situation)
        : ''
  const composed = composeFurnaceContext(role, { situation: sitText || situation })
  const activeMd = path.join(home, 'ACTIVE.md')
  const situationMd = path.join(home, 'SITUATION.md')
  const activeJson = path.join(home, 'active.json')
  fs.writeFileSync(activeMd, composed, 'utf8')
  if (sitText) fs.writeFileSync(situationMd, sitText, 'utf8')
  fs.writeFileSync(
    activeJson,
    JSON.stringify(
      {
        role,
        label: FURNACE_ROLE_LABEL[role] || role,
        sessionId: sessionId || null,
        nodeId: nodeId || null,
        at: new Date().toISOString(),
        promptFile: ROLE_FILES[role],
        memoryFile: path.join('memory', ROLE_FILES[role]),
        situationFile: sitText ? 'SITUATION.md' : null,
      },
      null,
      2,
    ),
    'utf8',
  )
  return {
    role,
    label: FURNACE_ROLE_LABEL[role] || role,
    activeMd,
    situationMd,
    text: composed,
  }
}

export function resolveAdaptFurnaceRole({ stepAdapt, memberAdapt } = {}) {
  if (stepAdapt) return FURNACE_ROLE.NODE_ADAPT
  if (memberAdapt) return FURNACE_ROLE.MEMBER_ADAPT
  return null
}
