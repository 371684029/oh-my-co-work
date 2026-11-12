import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-refine-plan-'))
process.env.ACW_DATA_ROOT = dataRoot

const { planRefineOnMemberSave } = await import('../src/refineSource.js')
const { previewRefineVerify } = await import('../src/memberVerify.js')
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

test('previewRefineVerify simulates before first patch', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-preview-'))
  const bat = path.join(dir, 'p.bat')
  fs.writeFileSync(bat, '@echo off\necho ok\n', 'utf8')
  const member = {
    kind: MEMBER_KIND.SCRIPT,
    display_name: '预览',
    config: {
      refine: { enabled: true, format: { output: { heading: '标题' } } },
      script: { mode: 'file', filePath: bat, scriptWorkDir: dir },
    },
  }
  const p = previewRefineVerify(member)
  assert.equal(p.simulated, true)
  assert.equal(p.pendingPatch, true)
  assert.ok(p.checks.some((c) => c.id === 'preview_pending_patch'))
})
