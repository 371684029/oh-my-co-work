import assert from 'node:assert/strict'
import test from 'node:test'
import {
  shellNavWorkbench,
  shellPrimaryNavAria,
  shellZoomOutAria,
} from '../src/composables/appShellCopy.js'

test('appShellCopy returns non-empty labels', () => {
  assert.match(shellNavWorkbench(), /工作台|Workbench/)
  assert.match(shellPrimaryNavAria(), /主导航|Primary navigation/)
  assert.match(shellZoomOutAria(), /缩小|Zoom out/)
})
