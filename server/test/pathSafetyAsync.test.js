import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { assertRegularFileAsync, assertTreeNoSymlinksAsync } from '../src/backup/pathSafety.js'

test('async restore validation accepts regular nested files', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-safe-restore-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'journals', 'sessions'), { recursive: true })
  const db = path.join(root, 'oh-my-co-work.sqlite')
  fs.writeFileSync(db, 'sqlite fixture')
  fs.writeFileSync(path.join(root, 'journals', 'sessions', 'a.md'), 'hello')

  await assertTreeNoSymlinksAsync(root)
  await assertRegularFileAsync(db, '备份库')
})

test('async restore validation rejects symlinks before applying files', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-unsafe-restore-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.symlinkSync(os.tmpdir(), path.join(root, 'journals'))

  await assert.rejects(assertTreeNoSymlinksAsync(root), { code: 'SYMLINK' })
  await assert.rejects(assertRegularFileAsync(path.join(root, 'journals'), '备份库'), { code: 'SYMLINK' })
})

test('async restore validation rejects symlink at staging root', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-unsafe-root-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const link = path.join(root, 'staging')
  fs.symlinkSync(os.tmpdir(), link)

  await assert.rejects(assertTreeNoSymlinksAsync(link), { code: 'SYMLINK' })
})
