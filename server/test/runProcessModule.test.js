import assert from 'node:assert/strict'
import test from 'node:test'

test('runProcess module exports runProcess', async () => {
  const mod = await import('../src/runners/runProcess.js')
  assert.equal(typeof mod.runProcess, 'function')
})

test('runMember module exports runMember', async () => {
  const mod = await import('../src/runners/runMember.js')
  assert.equal(typeof mod.runMember, 'function')
})
