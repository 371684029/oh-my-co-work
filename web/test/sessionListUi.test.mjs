import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildConversationItems,
  filterSessionsByListFilter,
  sortSessionsForSidebar,
  CONVERSATION_MENU,
} from '../src/views/workbench/composables/sessionListUi.js'

test('CONVERSATION_MENU has pin and delete commands', () => {
  assert.ok(CONVERSATION_MENU.some((m) => m.command === 'pin'))
  assert.ok(CONVERSATION_MENU.some((m) => m.command === 'delete'))
})

test('filterSessionsByListFilter archived vs active', () => {
  const sessions = [
    { id: '1', status: 'active' },
    { id: '2', status: 'archived' },
  ]
  assert.equal(filterSessionsByListFilter(sessions, 'archived').length, 1)
  assert.equal(filterSessionsByListFilter(sessions, 'active').length, 1)
})

test('buildConversationItems assigns group blocks', () => {
  const items = buildConversationItems(
    [
      { id: 'a', adhoc: false, status: 'active', updated_at: '2026-01-02T00:00:00Z', title: 'T' },
      { id: 'b', adhoc: true, status: 'active', updated_at: '2026-01-01T00:00:00Z', title: 'M' },
    ],
    'all',
    Date.parse('2026-01-03T00:00:00Z'),
  )
  assert.equal(items.length, 2)
  assert.equal(items[0].group, '群模板')
  assert.equal(items[1].group, '成员')
})
