import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import {
  captureStepSnapshot,
  summarizeStepChange,
  formatChangeSummary,
} from '../src/stepSnapshot.js'

function runGit(cwd, args) {
  execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' })
}

test('captureStepSnapshot + summarizeStepChange on temp git repo', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-trc-'))
  runGit(root, ['init'])
  runGit(root, ['config', 'user.email', 't@acw.local'])
  runGit(root, ['config', 'user.name', 'acw'])
  fs.writeFileSync(path.join(root, 'a.txt'), 'one\n')
  runGit(root, ['add', 'a.txt'])
  runGit(root, ['commit', '-m', 'init'])
  const before = captureStepSnapshot(root)
  assert.equal(before.mode, 'git')
  fs.writeFileSync(path.join(root, 'a.txt'), 'two\n')
  fs.writeFileSync(path.join(root, 'b.txt'), 'new\n')
  runGit(root, ['add', '.'])
  const change = summarizeStepChange(before, root)
  assert.equal(change.mode, 'git')
  assert.ok(change.filesChanged >= 1)
  assert.match(formatChangeSummary(change), /文件/)
})

test('non-git directory returns no_git', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-trc-plain-'))
  assert.equal(captureStepSnapshot(root).reason, 'no_git')
})
