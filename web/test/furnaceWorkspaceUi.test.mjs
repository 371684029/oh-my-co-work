import assert from 'node:assert/strict'
import test from 'node:test'
import {
  furnaceAgentDisplayLabel,
  furnaceAgentFromHotkey,
  shouldIgnoreFurnaceHotkeyTarget,
} from '../src/components/terminal/furnaceWorkspaceUi.js'
import { nextGateIdempotencyKey } from '../src/views/workbench/composables/sessionGateIdempotency.js'

test('furnaceAgentDisplayLabel', () => {
  assert.equal(furnaceAgentDisplayLabel('cursor'), 'Cursor')
  assert.equal(furnaceAgentDisplayLabel('grok'), 'Grok')
})

test('furnaceAgentFromHotkey maps digits', () => {
  assert.equal(furnaceAgentFromHotkey('1'), 'grok')
  assert.equal(furnaceAgentFromHotkey('2'), 'cursor')
  assert.equal(furnaceAgentFromHotkey('3'), null)
})

test('shouldIgnoreFurnaceHotkeyTarget for xterm', () => {
  assert.equal(
    shouldIgnoreFurnaceHotkeyTarget({ closest: (sel) => (sel.includes('xterm') ? {} : null) }),
    true,
  )
})

test('nextGateIdempotencyKey format', () => {
  const k = nextGateIdempotencyKey('submit', 'node-1', 1000)
  assert.match(k, /^gate_submit_node-1_1000_[a-z0-9]+$/)
})
