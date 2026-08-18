/**
 * 熔炉三套上下文：成员适配 / 节点适配 / 系统审核。
 * Prompt 随仓库；记忆在本机 data/furnace/memory（不覆盖已有）。
 * 开跑只装入当前角色，写成 ACTIVE.md，绝不把三套拼进同一份。
 */
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, DATA_ROOT } from './db.js'
import { FURNACE_ROLE, FURNACE_ROLE_LABEL } from '@acw/shared'

const ROLE_FILES = {
  [FURNACE_ROLE.MEMBER_ADAPT]: 'member-adapt.md',
  [FURNACE_ROLE.NODE_ADAPT]: 'node-adapt.md',
  [FURNACE_ROLE.REVIEW]: 'review.md',
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
        '三套角色各有 prompt（仓库）和 memory（本目录）。',
        '`ACTIVE.md` 只含**当前这一套**，给本机 Grok TUI 读。',
        '不要把三套拼在一起。',
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

export function composeFurnaceContext(role) {
  const prompt = loadFurnacePrompt(role)
  const memory = loadFurnaceMemory(role)
  const label = FURNACE_ROLE_LABEL[role] || role
  return [
    `# 熔炉本轮：${label}`,
    '',
    `角色 id：\`${role}\``,
    '只使用下面这一套。其它角色的 prompt / 记忆视为不存在。',
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

/**
 * 装入一套角色。返回 ACTIVE.md 路径。
 */
export function activateFurnaceRole(role, { sessionId, nodeId } = {}) {
  if (!isFurnaceRole(role)) throw new Error(`未知熔炉角色: ${role}`)
  const home = ensureFurnaceWorkspace()
  const composed = composeFurnaceContext(role)
  const activeMd = path.join(home, 'ACTIVE.md')
  const activeJson = path.join(home, 'active.json')
  fs.writeFileSync(activeMd, composed, 'utf8')
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
    text: composed,
  }
}

export function resolveAdaptFurnaceRole({ stepAdapt, memberAdapt } = {}) {
  if (stepAdapt) return FURNACE_ROLE.NODE_ADAPT
  if (memberAdapt) return FURNACE_ROLE.MEMBER_ADAPT
  return null
}
