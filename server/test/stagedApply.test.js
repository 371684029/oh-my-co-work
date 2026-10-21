import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { applyStagedToLiveSync } from '../src/backup/stagedApply.js'

test('applyStagedToLiveSync copies staged db into live data root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-staged-apply-'))
  const work = path.join(root, 'work')
  const live = path.join(root, 'live')
  fs.mkdirSync(work, { recursive: true })
  fs.mkdirSync(live, { recursive: true })
  fs.writeFileSync(path.join(work, 'oh-my-co-work.sqlite'), 'live-db')
  applyStagedToLiveSync(work, live)
  assert.equal(fs.readFileSync(path.join(live, 'oh-my-co-work.sqlite'), 'utf8'), 'live-db')
})
