import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import test from 'node:test'

test('perf baseline script passes against fixture', () => {
  const script = path.join(process.cwd(), '..', 'scripts', 'perf-baseline.mjs')
  const r = spawnSync(process.execPath, [script], {
    cwd: path.join(process.cwd()),
    encoding: 'utf8',
  })
  assert.equal(r.status, 0, r.stderr || r.stdout)
})
