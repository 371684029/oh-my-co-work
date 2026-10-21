import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultTerminalPrefs } from '../src/views/workbench/composables/sessionDetailResetState.js'

test('defaultTerminalPrefs has expected keys', () => {
  const p = defaultTerminalPrefs()
  assert.equal(p.theme, 'project-dark')
  assert.equal(p.fontSize, 13)
})
