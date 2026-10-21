import assert from 'node:assert/strict'
import test from 'node:test'
import {
  messageSendMentionFeedback,
  messageSendNewSessionId,
  messageSendOpensNewSession,
  shouldRefreshCurrentSessionAfterSend,
} from '../src/views/workbench/composables/sessionMessageSendUi.js'

test('message send result routing', () => {
  assert.equal(messageSendOpensNewSession({ newSession: true, session: { id: 'n1' } }), true)
  assert.equal(messageSendNewSessionId({ newSession: true, session: { id: 'n1' } }), 'n1')
  assert.equal(shouldRefreshCurrentSessionAfterSend({ newSession: false }), true)
  assert.deepEqual(messageSendMentionFeedback({ mentionPending: true, mainGateWaiting: true }), {
    offsiteMode: undefined,
    mainGateWaiting: true,
  })
  assert.equal(messageSendMentionFeedback({}), null)
})
