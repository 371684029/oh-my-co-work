import assert from 'node:assert/strict'
import test from 'node:test'
import { countRunningTerminals } from '../src/terminal/terminalQuota.js'

test('countRunningTerminals excludes exceptMemberId', () => {
  const terminals = new Map([
    ['a', { sessionId: 's1', memberId: 'm1', status: 'running' }],
    ['b', { sessionId: 's1', memberId: 'm2', status: 'running' }],
  ])
  assert.equal(countRunningTerminals(terminals, 's1', { exceptMemberId: 'm1' }), 1)
})
