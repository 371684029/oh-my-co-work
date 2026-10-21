import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-skill-'))
process.env.ACW_DATA_ROOT = dataRoot

const { listBundledSkills, installSkillPack } = await import('../src/skillPack.js')

test('install bundled agent-refine skill', () => {
  const list = listBundledSkills()
  assert.ok(list.some((s) => s.id === 'agent-refine-skill'))
  const m = installSkillPack({ skillId: 'agent-refine-skill' })
  assert.ok(fs.existsSync(path.join(m.dest, 'SKILL.md')))
  assert.equal(m.skillId, 'agent-refine-skill')
})
