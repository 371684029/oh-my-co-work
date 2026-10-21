import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-refine-plan-'))
process.env.ACW_DATA_ROOT = dataRoot

const { planRefineOnMemberSave } = await import('../src/refineSource.js')
const { MEMBER_KIND } = await import('@acw/shared')

test('planRefineOnMemberSave lists files without writing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-plan-'))
  const bat = path.join(dir, 'x.bat')
  fs.writeFileSync(bat, '@echo off\necho hi\n', 'utf8')
  const member = {
    id: 'mem_x',
    kind: MEMBER_KIND.SCRIPT,
    display_name: '测试',
    config: {
      refine: { enabled: true },
      script: { mode: 'file', filePath: bat, scriptWorkDir: dir },
    },
  }
  const plan = planRefineOnMemberSave(member)
  assert.equal(plan.reason, 'will_patch')
  assert.equal(plan.files.length, 1)
  assert.match(plan.files[0].snippet, /ACW-REFINE/)
  assert.equal(fs.readFileSync(bat, 'utf8').includes('ACW-REFINE'), false)
})
