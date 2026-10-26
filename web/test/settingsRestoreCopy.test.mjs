import assert from 'node:assert/strict'
import test from 'node:test'
import {
  restoreT,
  restoreToast,
  restoreConfirm,
  restoreNodeLine,
} from '../src/composables/settingsRestoreCopy.js'

test('settingsRestoreCopy returns restore page copy', () => {
  assert.match(restoreT('title'), /还原中心|Restore/)
  assert.match(restoreT('empty'), /暂无|Nothing/i)
  assert.match(restoreToast('restored'), /还原|restor/i)
  assert.match(restoreConfirm('title'), /还原|Restor/i)
})

test('restoreNodeLine substitutes step values', () => {
  const line = restoreNodeLine(2, 'Build docs', 3)
  assert.match(line, /2/)
  assert.match(line, /Build docs/)
  assert.match(line, /3/)
})
