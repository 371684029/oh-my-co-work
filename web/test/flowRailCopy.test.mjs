import assert from 'node:assert/strict'
import test from 'node:test'
import { flowRailJournalButton, flowRailTagAdapt } from '../src/views/workbench/composables/flowRailCopy.js'

test('flowRailCopy node chrome labels', () => {
  assert.match(flowRailJournalButton(), /台账|Journal/)
  assert.match(flowRailTagAdapt(), /适配|Adapt/)
})
