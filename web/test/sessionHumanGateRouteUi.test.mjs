import assert from 'node:assert/strict'
import test from 'node:test'
import { humanGateShouldSendAsMessage } from '../src/views/workbench/composables/sessionHumanGateRouteUi.js'

test('human gate routes pure @ assist to message send', () => {
  const members = [{ name: 'alice', display_name: 'Alice' }]
  assert.equal(humanGateShouldSendAsMessage('@Alice', members), true)
  assert.equal(humanGateShouldSendAsMessage('hello', members), false)
  assert.equal(humanGateShouldSendAsMessage('', members), false)
})
