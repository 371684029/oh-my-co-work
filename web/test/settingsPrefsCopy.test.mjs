import assert from 'node:assert/strict'
import test from 'node:test'
import { prefsT, prefsTitle, prefsResourceLabel } from '../src/composables/settingsPrefsCopy.js'

test('settingsPrefsCopy returns prefs page title', () => {
  assert.match(prefsTitle(), /设置|Preferences/)
  assert.match(prefsT('demo.title'), /演示|Demo/)
})

test('prefsResourceLabel formats session title', () => {
  const label = prefsResourceLabel({ title: 'S1', processCount: 2, terminalCount: 0 })
  assert.match(label, /S1/)
  assert.match(label, /2/)
})
