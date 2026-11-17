#!/usr/bin/env node
/**
 * FSK-14：检查熔炉 Skill 是否可同步到 Grok 工作区（无 grok 也可跑）。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-selftest-skills-'))
process.env.ACW_DATA_ROOT = dataRoot
process.env.ACW_GROK_WORKSPACE = path.join(dataRoot, 'grok-ws')

const { initDb } = await import(path.join(root, 'server/src/db.js'))
initDb()

const { syncFurnaceSkillsToWorkspace, listBundledFurnaceSkills } = await import(
  path.join(root, 'server/src/furnaceSkillSync.js')
)

const cwd = process.env.ACW_GROK_WORKSPACE
const bundled = listBundledFurnaceSkills()
if (bundled.length < 4) {
  console.error('[selftest-furnace-skills] expected >=4 skills, got', bundled.length)
  process.exit(1)
}
const r = syncFurnaceSkillsToWorkspace(cwd)
for (const id of ['furnace-core', 'furnace-acw-ctl', 'furnace-refine-skill']) {
  const p = path.join(cwd, '.grok', 'skills', id, 'SKILL.md')
  if (!fs.existsSync(p)) {
    console.error('[selftest-furnace-skills] missing', p)
    process.exit(1)
  }
}
console.log('[selftest-furnace-skills] ok synced=%j skipped=%d', r.synced, r.skipped?.length || 0)