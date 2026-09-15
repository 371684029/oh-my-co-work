import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-refine-src-'))
process.env.ACW_DATA_ROOT = dataRoot

const {
  REFINE_MARK,
  applyRefineContract,
  applyRefineOnMemberSave,
  refineSaveStatusText,
} = await import('../src/refineSource.js')
const { MEMBER_KIND } = await import('@acw/shared')

test('applyRefineContract：bat 立刻绑定 ACW 输入并打 stdout 标题', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-bat-'))
  const bat = path.join(dir, 'newBranch.bat')
  fs.writeFileSync(bat, '@echo off\r\necho old\r\n', 'utf8')
  const r = applyRefineContract(bat, { title: '切分支台账' })
  assert.equal(r.patched, true)
  const text = fs.readFileSync(bat, 'utf8')
  assert.match(text, new RegExp(REFINE_MARK))
  assert.match(text, /ACW_PARAM_1/)
  assert.match(text, /ACW_HUMAN_INPUT/)
  assert.match(text, /echo ### 切分支台账/)
  assert.match(text, /echo old/)
  const again = applyRefineContract(bat, { title: '切分支台账' })
  assert.equal(again.reason, 'already')
})

test('applyRefineOnMemberSave：保存时备份并改源，立刻写入 format', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-mem-'))
  const bat = path.join(dir, 'newBranch.bat')
  fs.writeFileSync(bat, '@echo off\necho work\n', 'utf8')
  const member = {
    id: 'mem_branch',
    kind: MEMBER_KIND.SCRIPT,
    display_name: '切分支',
    config: {
      refine: { enabled: true },
      script: { mode: 'file', filePath: bat, scriptWorkDir: dir },
    },
  }
  const { nextConfig, prep } = applyRefineOnMemberSave(member)
  assert.equal(prep.fallback, false)
  assert.equal(prep.patched.length, 1)
  assert.ok(nextConfig.refine.format.title)
  assert.deepEqual(nextConfig.refine.format.input.env, [
    'ACW_HUMAN_INPUT',
    'ACW_PARAM_1',
    'ACW_PARAMS_JSON',
  ])
  assert.equal(nextConfig.refine.format.output.channel, 'stdout')
  assert.ok(nextConfig.refine.refineBackup)
  assert.match(fs.readFileSync(bat, 'utf8'), new RegExp(REFINE_MARK))
  assert.match(refineSaveStatusText(prep), /已按炼化契约改写/)
})

test('applyRefineOnMemberSave：无源文件仍保存规格', () => {
  const { nextConfig, prep } = applyRefineOnMemberSave({
    id: 'mem_echo',
    kind: MEMBER_KIND.ECHO,
    display_name: '旁白',
    config: { refine: { enabled: true }, defaultText: 'hi' },
  })
  assert.equal(prep.fallback, true)
  assert.equal(prep.reason, 'no_source')
  assert.equal(nextConfig.refine.status, 'done')
  assert.ok(nextConfig.refine.format.title)
})
