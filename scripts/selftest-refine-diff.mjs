#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-selftest-diff-'))
const bat = path.join(dir, 'x.bat')
fs.writeFileSync(bat, '@echo off\necho hi\n', 'utf8')

const { planRefineOnMemberSave } = await import(path.join(root, 'server/src/refineSource.js'))

const plan = planRefineOnMemberSave({
  kind: 'script',
  display_name: 'd',
  config: {
    refine: { enabled: true },
    script: { mode: 'file', filePath: bat, scriptWorkDir: dir },
  },
})
assert.equal(plan.reason, 'will_patch')
assert.match(plan.files[0].diffPreview, /@@ -/)

console.log('[selftest-refine-diff] ok')