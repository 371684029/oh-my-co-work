import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-refine-restore-'))
process.env.ACW_DATA_ROOT = dataRoot

const { stripRefineContract } = await import('../src/refineRestore.js')
const { REFINE_MARK, applyRefineContract } = await import('../src/refineSource.js')

test('stripRefineContract removes refine block when backup missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-strip-'))
  const bat = path.join(dir, 't.bat')
  fs.writeFileSync(bat, '@echo off\necho keep\n', 'utf8')
  applyRefineContract(bat, { title: '台账' })
  assert.match(fs.readFileSync(bat, 'utf8'), new RegExp(REFINE_MARK))
  const r = stripRefineContract(bat)
  assert.equal(r.ok, true)
  const text = fs.readFileSync(bat, 'utf8')
  assert.doesNotMatch(text, new RegExp(REFINE_MARK))
  assert.match(text, /@echo off/)
})
