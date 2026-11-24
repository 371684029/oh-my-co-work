import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-furnace-skills-'))
process.env.ACW_DATA_ROOT = dataRoot

const {
  syncFurnaceSkillsToWorkspace,
  syncFurnaceSkillsToCursorRules,
  listBundledFurnaceSkills,
} = await import('../src/furnaceSkillSync.js')
const { FURNACE_ROLE } = await import('@acw/shared')
const { activateFurnaceRole, resolveFurnaceRoleFromSituation } = await import('../src/furnaceContext.js')

test('syncFurnaceSkillsToWorkspace copies bundled skills', () => {
  const cwd = path.join(dataRoot, 'ws')
  fs.mkdirSync(cwd, { recursive: true })
  const bundled = listBundledFurnaceSkills()
  assert.ok(bundled.includes('furnace-core'))
  const r = syncFurnaceSkillsToWorkspace(cwd)
  assert.ok(r.synced.length >= 3)
  for (const id of ['furnace-core', 'furnace-acw-ctl', 'furnace-refine-skill']) {
    const dest = path.join(cwd, '.grok', 'skills', id, 'SKILL.md')
    assert.ok(fs.existsSync(dest), id)
  }
  const r2 = syncFurnaceSkillsToWorkspace(cwd)
  assert.ok(r2.synced.length === 0)
  assert.ok(r2.skipped.some((s) => s.reason === 'unchanged'))
})

test('resolveFurnaceRoleFromSituation prefers REFINE when step/member refined', () => {
  assert.equal(resolveFurnaceRoleFromSituation({ now: { refineStep: true } }), FURNACE_ROLE.REFINE)
  assert.equal(resolveFurnaceRoleFromSituation({ now: { refineMember: true } }), FURNACE_ROLE.REFINE)
  assert.equal(resolveFurnaceRoleFromSituation({ now: {} }), FURNACE_ROLE.SESSION)
})

test('syncFurnaceSkillsToCursorRules mirrors to .cursor/rules', () => {
  const cwd = path.join(dataRoot, 'ws-cursor')
  fs.mkdirSync(cwd, { recursive: true })
  const r = syncFurnaceSkillsToCursorRules(cwd)
  assert.ok(r.synced.length >= 1)
  const rule = path.join(cwd, '.cursor', 'rules', 'acw-furnace-furnace-core.mdc')
  assert.ok(fs.existsSync(rule))
  assert.ok(fs.readFileSync(rule, 'utf8').includes('furnace-core'))
})

test('ACTIVE.md lists Skills section', () => {
  const pack = activateFurnaceRole(FURNACE_ROLE.REFINE, { situation: '意图：炼化成员' })
  assert.ok(pack.text.includes('## Skills'))
  assert.ok(pack.text.includes('furnace-refine-skill'))
})