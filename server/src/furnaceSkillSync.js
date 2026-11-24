/**
 * Sync bundled furnace skills from repo `skills/` into Grok workspace `.grok/skills/`.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { DATA_ROOT, ROOT } from './db.js'
import { FURNACE_SKILL_IDS, furnaceSkillsForRole } from '@acw/shared'

function furnaceDataHome() {
  return path.join(DATA_ROOT, 'furnace')
}

const SKILLS_REPO = path.join(ROOT, 'skills')

function skillSourceDir(skillId) {
  return path.join(SKILLS_REPO, skillId)
}

function skillDestDir(cwd, skillId) {
  return path.join(cwd, '.grok', 'skills', skillId)
}

function hashFile(filePath) {
  const buf = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(buf).digest('hex')
}

/**
 * @param {string} cwd Grok / furnace workspace
 * @param {{ skillIds?: string[] }} [opts]
 */
export function syncFurnaceSkillsToWorkspace(cwd, { skillIds } = {}) {
  const ids = skillIds?.length ? skillIds : [...FURNACE_SKILL_IDS]
  const resolved = path.resolve(cwd)
  fs.mkdirSync(path.join(resolved, '.grok', 'skills'), { recursive: true })
  const synced = []
  const skipped = []
  for (const id of ids) {
    const src = path.join(skillSourceDir(id), 'SKILL.md')
    if (!fs.existsSync(src)) {
      skipped.push({ id, reason: 'missing_repo_skill' })
      continue
    }
    const destDir = skillDestDir(resolved, id)
    const dest = path.join(destDir, 'SKILL.md')
    fs.mkdirSync(destDir, { recursive: true })
    const srcHash = hashFile(src)
    let destHash = null
    if (fs.existsSync(dest)) {
      try {
        destHash = hashFile(dest)
      } catch {
        destHash = null
      }
    }
    if (destHash === srcHash) {
      skipped.push({ id, reason: 'unchanged' })
      continue
    }
    fs.copyFileSync(src, dest)
    synced.push(id)
  }
  return { cwd: resolved, synced, skipped, skillIds: ids }
}

export function listBundledFurnaceSkills() {
  return FURNACE_SKILL_IDS.filter((id) =>
    fs.existsSync(path.join(skillSourceDir(id), 'SKILL.md')),
  )
}

function readSkillFrontmatter(id) {
  const file = path.join(skillSourceDir(id), 'SKILL.md')
  if (!fs.existsSync(file)) return { id, version: '', description: '' }
  const text = fs.readFileSync(file, 'utf8')
  const version = String(text.match(/^version:\s*(.+)$/m)?.[1] || '').trim()
  const description = String(text.match(/^description:\s*(.+)$/m)?.[1] || '').trim()
  const name = String(text.match(/^name:\s*(.+)$/m)?.[1] || id).trim()
  return { id, name, version, description, repoPath: `skills/${id}/SKILL.md` }
}

export function listFurnaceSkillsCatalog() {
  return listBundledFurnaceSkills().map((id) => readSkillFrontmatter(id))
}

function stripSkillFrontmatter(text) {
  const raw = String(text || '')
  if (!raw.startsWith('---')) return raw.trim()
  const end = raw.indexOf('---', 3)
  if (end === -1) return raw.trim()
  return raw.slice(end + 3).trim()
}

/** FSK-B：从 bundled Skill 读正文，作为 ACTIVE 内「单写」片段 */
export function readBundledSkillBody(skillId) {
  const file = path.join(skillSourceDir(skillId), 'SKILL.md')
  if (!fs.existsSync(file)) return ''
  return stripSkillFrontmatter(fs.readFileSync(file, 'utf8'))
}

export function pickPrimarySkillIdForRole(role) {
  const ids = furnaceSkillsForRole(role)
  if (ids.includes('furnace-refine-skill')) return 'furnace-refine-skill'
  if (ids.includes('furnace-review')) return 'furnace-review'
  if (ids.includes('furnace-acw-ctl')) return 'furnace-acw-ctl'
  return ids[0] || 'furnace-core'
}

export function skillExcerptForRole(role, { maxChars = 12000 } = {}) {
  const body = readBundledSkillBody(pickPrimarySkillIdForRole(role))
  if (!body) return ''
  if (!maxChars || maxChars <= 0 || body.length <= maxChars) return body
  return `${body.slice(0, maxChars)}\n…(Skill 正文截断，完整见 .grok/skills/)`
}

/**
 * 自定义 Grok workspace（非 data/furnace）且已有 .grok/skills 时需用户确认再覆盖。
 */
export function assessFurnaceWorkspaceSync(cwd) {
  const resolved = path.resolve(String(cwd || '').trim() || furnaceDataHome())
  const home = path.resolve(furnaceDataHome())
  const custom = resolved !== home
  const skillsRoot = path.join(resolved, '.grok', 'skills')
  let hasSkills = false
  try {
    hasSkills = fs
      .readdirSync(skillsRoot)
      .some((name) => !name.startsWith('.') && fs.statSync(path.join(skillsRoot, name)).isDirectory())
  } catch {
    hasSkills = false
  }
  return {
    cwd: resolved,
    custom,
    hasSkills,
    needsAcknowledgement: custom && hasSkills,
  }
}

const CURSOR_RULE_PREFIX = 'acw-furnace-'

/**
 * CUR-F：Cursor 熔炉无 .grok/skills，将 bundled Skills 镜像到工作区 `.cursor/rules/*.mdc`。
 * @param {string} cwd
 * @param {{ skillIds?: string[] }} [opts]
 */
export function syncFurnaceSkillsToCursorRules(cwd, { skillIds } = {}) {
  const ids = skillIds?.length ? skillIds : [...FURNACE_SKILL_IDS]
  const resolved = path.resolve(cwd)
  const rulesDir = path.join(resolved, '.cursor', 'rules')
  fs.mkdirSync(rulesDir, { recursive: true })
  const synced = []
  const skipped = []
  for (const id of ids) {
    const src = path.join(skillSourceDir(id), 'SKILL.md')
    if (!fs.existsSync(src)) {
      skipped.push({ id, reason: 'missing_repo_skill' })
      continue
    }
    const safe = String(id).replace(/[^a-zA-Z0-9._-]+/g, '-')
    const dest = path.join(rulesDir, `${CURSOR_RULE_PREFIX}${safe}.mdc`)
    const body = fs.readFileSync(src, 'utf8')
    const next = `---\ndescription: oh-my-co-work furnace skill ${id}\nglobs:\nalwaysApply: true\n---\n\n${body.trim()}\n`
    let prev = ''
    try {
      prev = fs.readFileSync(dest, 'utf8')
    } catch {
      prev = ''
    }
    if (prev === next) {
      skipped.push({ id, reason: 'unchanged' })
      continue
    }
    fs.writeFileSync(dest, next, 'utf8')
    synced.push(id)
  }
  return { cwd: resolved, rulesDir, synced, skipped, skillIds: ids }
}