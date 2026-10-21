import assert from 'node:assert/strict'
import test from 'node:test'
import {
  convMenuActionFromCommand,
  normalizeMenuCommand,
  sessionIdFromConvItem,
} from '../src/views/workbench/composables/sessionConvMenuUi.js'

test('normalizeMenuCommand accepts objects', () => {
  assert.equal(normalizeMenuCommand({ command: 'pin' }), 'pin')
})

test('convMenuActionFromCommand maps zh and en', () => {
  assert.equal(convMenuActionFromCommand('置顶'), 'pin')
  assert.equal(convMenuActionFromCommand('delete'), 'delete')
  assert.equal(convMenuActionFromCommand('noop'), null)
})

test('sessionIdFromConvItem prefers uniqueKey', () => {
  assert.equal(sessionIdFromConvItem({ uniqueKey: 'a', id: 'b' }), 'a')
})
