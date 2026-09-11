import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const { DATA_ROOT } = await import('../src/db.js')
const { rememberSessionPid, resolveRegistryDataRoot } = await import('../src/processRegistry.js')

test('processRegistry defaults to db DATA_ROOT instead of process.cwd', () => {
  assert.equal(resolveRegistryDataRoot(), DATA_ROOT)
  const sessionId = `ses_reg_${Date.now()}`
  rememberSessionPid(sessionId, 424242, 'test')
  const pidFile = path.join(DATA_ROOT, 'console', `session_${sessionId}.pids`)
  assert.equal(fs.existsSync(pidFile), true)
  const cwdLeak = path.join(process.cwd(), 'console', `session_${sessionId}.pids`)
  if (path.resolve(DATA_ROOT) !== path.resolve(process.cwd())) {
    assert.equal(fs.existsSync(cwdLeak), false)
  }
  const text = fs.readFileSync(pidFile, 'utf8')
  assert.match(text, /424242/)
})
