import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { captureStepSnapshot, summarizeStepChange } from '../src/stepSnapshot.js'
import { previewStepRevert, applyStepRevert } from '../src/stepRevert.js'

function runGit(cwd, args) {
  execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' })
}

test('applyStepRevert restores worktree to step start', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-revert-'))
  runGit(root, ['init'])
  runGit(root, ['config', 'user.email', 't@acw.local'])
  runGit(root, ['config', 'user.name', 'acw'])
  fs.writeFileSync(path.join(root, 'a.txt'), 'one\n')
  runGit(root, ['add', 'a.txt'])
  runGit(root, ['commit', '-m', 'init'])
  const before = captureStepSnapshot(root)
  fs.writeFileSync(path.join(root, 'a.txt'), 'two\n')
  const stored = summarizeStepChange(before, root)
  assert.ok(stored.filesChanged >= 1)
  applyStepRevert(stored, root, { force: false })
  assert.equal(fs.readFileSync(path.join(root, 'a.txt'), 'utf8'), 'one\n')
})

test('previewStepRevert detects drift after step', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-revert-drift-'))
  runGit(root, ['init'])
  runGit(root, ['config', 'user.email', 't@acw.local'])
  runGit(root, ['config', 'user.name', 'acw'])
  fs.writeFileSync(path.join(root, 'a.txt'), 'one\n')
  runGit(root, ['add', 'a.txt'])
  runGit(root, ['commit', '-m', 'init'])
  const before = captureStepSnapshot(root)
  fs.writeFileSync(path.join(root, 'a.txt'), 'two\n')
  const stored = summarizeStepChange(before, root)
  fs.writeFileSync(path.join(root, 'a.txt'), 'three\n')
  const preview = previewStepRevert(stored, root)
  assert.equal(preview.ok, true)
  assert.equal(preview.needsForce, true)
})
