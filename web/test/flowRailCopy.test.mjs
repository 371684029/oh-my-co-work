import assert from 'node:assert/strict'
import test from 'node:test'
import {
  flowRailIoInputLabel,
  flowRailJournalButton,
  flowRailSkippedExpandLabel,
  flowRailTagAdapt,
} from '../src/views/workbench/composables/flowRailCopy.js'

test('flowRailCopy node chrome labels', () => {
  assert.match(flowRailJournalButton(), /台账|Journal/)
  assert.match(flowRailTagAdapt(), /适配|Adapt/)
  assert.match(flowRailIoInputLabel(), /输入|Input/)
  assert.match(flowRailSkippedExpandLabel(3), /3/)
})
