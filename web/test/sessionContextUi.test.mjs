import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseSessionContext,
  extractSessionParamsList,
  sessionGroupCardFromContext,
  footerCollapsedHintForPendingGate,
} from '../src/views/workbench/composables/sessionContextUi.js'

test('parseSessionContext and params list', () => {
  assert.deepEqual(parseSessionContext({ context: { paramsList: ['a', 'b'] } }), {
    paramsList: ['a', 'b'],
  })
  assert.deepEqual(extractSessionParamsList({ params: { '#1': 'x', '#2': 'y' } }), ['x', 'y'])
  assert.equal(sessionGroupCardFromContext({ groupCard: 'G' }), 'G')
})

test('footerCollapsedHintForPendingGate', () => {
  assert.match(footerCollapsedHintForPendingGate(null), /输入消息/)
  assert.match(
    footerCollapsedHintForPendingGate({ content: { mode: 'adapter_question' } }),
    /工具提问/,
  )
})
