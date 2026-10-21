import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  moveLiveAsideAsync,
  moveLiveAsideSync,
} from '../src/backup/moveLiveAside.js'

test('moveLiveAsideSync copies then removes live paths', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-aside-'))
  const live = path.join(root, 'journals')
  fs.mkdirSync(live, { recursive: true })
  fs.writeFileSync(path.join(live, 'a.md'), 'hello')
  const aside = path.join(root, 'aside')
  moveLiveAsideSync(root, aside, ['journals'])
  assert.ok(!fs.existsSync(live))
  assert.equal(fs.readFileSync(path.join(aside, 'journals', 'a.md'), 'utf8'), 'hello')
})

test('moveLiveAsideAsync copies then removes live paths', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-aside-async-'))
  const live = path.join(root, 'uploads')
  fs.mkdirSync(live, { recursive: true })
  fs.writeFileSync(path.join(live, 'b.txt'), 'data')
  const aside = path.join(root, 'aside')
  await moveLiveAsideAsync(root, aside, ['uploads'])
  assert.ok(!fs.existsSync(live))
  assert.equal(fs.readFileSync(path.join(aside, 'uploads', 'b.txt'), 'utf8'), 'data')
})
