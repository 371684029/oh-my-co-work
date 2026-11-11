import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { REFINE_MARK, applyRefineContract } from '../src/refineSource.js'
import { stripRefineContractText } from '../src/refineContractStrip.js'

test('stripRefineContractText removes bat + node argv sync blocks', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-strip2-'))
  const bat = path.join(dir, 'a.bat')
  fs.writeFileSync(bat, '@echo off\r\necho work\r\n', 'utf8')
  applyRefineContract(bat, { title: 'T' })
  const mjs = path.join(dir, 'b.mjs')
  fs.writeFileSync(mjs, '#!/usr/bin/env node\nconsole.log(1)\n', 'utf8')
  applyRefineContract(mjs, { title: 'T' })
  const batStripped = stripRefineContractText(fs.readFileSync(bat, 'utf8'))
  assert.equal(batStripped.removed, true)
  assert.doesNotMatch(batStripped.text, new RegExp(REFINE_MARK))
  assert.match(batStripped.text, /echo work/)
  const mjsStripped = stripRefineContractText(fs.readFileSync(mjs, 'utf8'))
  assert.equal(mjsStripped.removed, true)
  assert.doesNotMatch(mjsStripped.text, /acwSyncArgvFromEnv/)
  assert.match(mjsStripped.text, /console\.log\(1\)/)
})

test('stripRefineContractText leaves files without mark unchanged', () => {
  const r = stripRefineContractText('@echo off\necho ok\n')
  assert.equal(r.removed, false)
  assert.match(r.text, /echo ok/)
})
