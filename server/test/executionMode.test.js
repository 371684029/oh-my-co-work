import assert from 'node:assert/strict'
import test from 'node:test'
import { enrichScriptConfig, usesTerminalExecution } from '../src/runners.js'

test('script members default to embedded terminal unless pipe is explicit', () => {
  assert.equal(usesTerminalExecution({}), true)
  assert.equal(usesTerminalExecution({ executionMode: 'terminal' }), true)
  assert.equal(usesTerminalExecution({ executionMode: 'pipe' }), false)
  assert.equal(enrichScriptConfig({ command: 'grok' }).executionMode, 'terminal')
  assert.equal(enrichScriptConfig({ command: 'echo', executionMode: 'pipe' }).executionMode, 'pipe')
})
