import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  copyLiveSqliteSync,
  stageJournalsAndUploadsSync,
} from '../src/backup/stagingWork.js'

test('stagingWork copies sqlite sidecars and journal tree', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-stage-'))
  const liveDb = path.join(root, 'live.sqlite')
  fs.writeFileSync(liveDb, 'db')
  fs.writeFileSync(liveDb + '-wal', 'wal')
  const work = path.join(root, 'work')
  fs.mkdirSync(work, { recursive: true })
  const dbCopy = path.join(work, 'oh-my-co-work.sqlite')
  copyLiveSqliteSync(liveDb, dbCopy)
  assert.equal(fs.readFileSync(dbCopy, 'utf8'), 'db')
  assert.equal(fs.readFileSync(dbCopy + '-wal', 'utf8'), 'wal')

  fs.mkdirSync(path.join(root, 'journals'), { recursive: true })
  fs.writeFileSync(path.join(root, 'journals', 'a.md'), 'j')
  stageJournalsAndUploadsSync(work, root, { includeUploads: false })
  assert.equal(fs.readFileSync(path.join(work, 'journals', 'a.md'), 'utf8'), 'j')
})
