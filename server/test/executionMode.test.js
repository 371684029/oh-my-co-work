import assert from 'node:assert/strict'
import test from 'node:test'
import { enrichScriptConfig, resolveLaunchSpec, usesKeepAlive, usesTerminalExecution } from '../src/runners.js'

test('script members default to embedded terminal unless pipe is explicit', () => {
  assert.equal(usesTerminalExecution({}), true)
  assert.equal(usesTerminalExecution({ executionMode: 'terminal' }), true)
  assert.equal(usesTerminalExecution({ executionMode: 'pipe' }), false)
  assert.equal(enrichScriptConfig({ command: 'grok' }).executionMode, 'terminal')
  assert.equal(enrichScriptConfig({ command: 'echo', executionMode: 'pipe' }).executionMode, 'pipe')
})

test('embedded terminal stays keep-alive unless waitForExit is forced', () => {
  assert.equal(usesKeepAlive({}), true)
  assert.equal(usesKeepAlive({ executionMode: 'terminal' }), true)
  assert.equal(usesKeepAlive({ executionMode: 'pipe' }), false)
  assert.equal(usesKeepAlive({ executionMode: 'terminal', waitForExit: true }), false)
  assert.equal(usesKeepAlive({ executionMode: 'terminal', detach: false }), false)
  assert.equal(usesKeepAlive({ executionMode: 'pipe', detach: true }), true)
})

test('command runtime cmd launches cmd.exe; auto does not on non-Windows', () => {
  assert.equal(resolveLaunchSpec({ command: 'grok', runtime: 'cmd' }).cmd, process.env.ComSpec || 'cmd.exe')
  if (process.platform !== 'win32') {
    const auto = resolveLaunchSpec({ command: 'grok', runtime: 'auto' })
    assert.notEqual(auto.cmd, 'cmd.exe')
  }
})
