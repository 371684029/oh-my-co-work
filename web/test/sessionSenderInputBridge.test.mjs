import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionSenderInputBridge } from '../src/views/workbench/composables/sessionSenderInputBridge.js'

test('createSessionSenderInputBridge exposes sender helpers', () => {
  const bridge = createSessionSenderInputBridge({
    senderRef: { value: null },
    bumpHashInsertLock: () => {},
  })
  assert.equal(typeof bridge.readSenderText, 'function')
  assert.equal(bridge.readSenderText(), '')
  assert.equal(typeof bridge.replaceSenderText, 'function')
})
