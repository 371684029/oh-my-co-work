import assert from 'node:assert/strict'
import test from 'node:test'
import {
  shortcutsT,
  shortcutsToast,
  shortcutsKindLabel,
  shortcutsPopupLabelForMode,
  shortcutsCloneName,
  shortcutsRunAgentOk,
  shortcutsToggleEnableAria,
} from '../src/composables/settingsShortcutsCopy.js'

test('settingsShortcutsCopy returns shortcuts page title and table copy', () => {
  assert.match(shortcutsT('title'), /斜杠指令|Slash/)
  assert.match(shortcutsToast('saveWarn'), /填写|required/i)
})

test('shortcuts kind and popup labels resolve per mode', () => {
  assert.match(shortcutsKindLabel('url'), /网址|URL/)
  assert.match(shortcutsKindLabel('shell'), /本机命令|Local command/)
  assert.match(shortcutsPopupLabelForMode('yes'), /是|Yes/)
  assert.match(shortcutsPopupLabelForMode('inherit'), /跟随|Follow/)
})

test('shortcuts helpers substitute values', () => {
  assert.match(shortcutsCloneName('Build'), /Build/)
  assert.match(shortcutsRunAgentOk('AgentX'), /AgentX/)
  assert.match(shortcutsToggleEnableAria('Build'), /Build/)
})
