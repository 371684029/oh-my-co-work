/**
 * Sync bundled furnace skills from repo `skills/` into Grok workspace `.grok/skills/`.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { ROOT } from './db.js'
import { FURNACE_SKILL_IDS } from '@acw/shared'

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