import assert from 'node:assert/strict'
import test from 'node:test'
import {
  shouldHideMessageFromBubbleList,
  mapMessageToBubbleItem,
  mergeBubbleRowsByTime,
} from '../src/views/workbench/composables/sessionBubbleListUi.js'

test('shouldHideMessageFromBubbleList hides archive_confirm gates', () => {
  assert.equal(
    shouldHideMessageFromBubbleList({ type: 'gate', content: { mode: 'archive_confirm' } }, () => false),
    true,
  )
})

test('mapMessageToBubbleItem user placement end', () => {
  const row = mapMessageToBubbleItem(
    { id: '1', role: 'user', content: { text: 'hi' }, created_at: '2026-01-01' },
    {
      messageText: (m) => m.content.text,
      roleLabel: () => 'You',
      shortSender: () => 'Y',
      isArchiveMessage: () => false,
    },
  )
  assert.equal(row.placement, 'end')
  assert.equal(row._kind, 'user')
})

test('mergeBubbleRowsByTime sorts by _time', () => {
  const merged = mergeBubbleRowsByTime(
    [{ _time: '2026-01-02' }],
    [{ _time: '2026-01-01' }],
  )
  assert.equal(merged[0]._time, '2026-01-01')
})
