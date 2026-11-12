import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSessionTimeline, filterTimelineEvents } from '../src/sessionTimeline.js'

test('buildSessionTimeline merges nodes gates and terminals by time', () => {
  const events = buildSessionTimeline({
    nodes: [
      {
        id: 'n1',
        step_index: 0,
        title: 'Echo',
        status: 'succeeded',
        step_type: 'member',
        started_at: '2026-01-01T10:00:00.000Z',
        finished_at: '2026-01-01T10:05:00.000Z',
        output: { changeSnapshot: { filesChanged: 2 } },
      },
    ],
    messages: [
      {
        id: 'm1',
        created_at: '2026-01-01T10:02:00.000Z',
        type: 'gate.request',
        node_instance_id: 'n1',
        content: { text: '等你确认' },
      },
    ],
    terminals: [
      {
        id: 't1',
        started_at: '2026-01-01T10:01:00.000Z',
        finished_at: '2026-01-01T10:04:00.000Z',
        command_label: 'bash',
        exit_code: 0,
      },
    ],
  })
  assert.ok(events.length >= 4)
  assert.equal(events[0].kind, 'node.start')
  assert.ok(events.some((e) => e.kind === 'gate.request'))
  assert.ok(events.some((e) => e.kind === 'terminal.start'))
})

test('buildSessionTimeline captures verify status messages', () => {
  const events = buildSessionTimeline({
    messages: [
      {
        id: 'mv',
        created_at: '2026-01-01T11:00:00.000Z',
        type: 'status',
        content: { text: '已写入项目参数；炼化试跑验证通过' },
      },
    ],
  })
  const v = events.find((e) => e.category === 'verify')
  assert.ok(v)
  assert.equal(filterTimelineEvents(events, 'verify').length, 1)
})

test('filterTimelineEvents by category', () => {
  const events = [
    { category: 'node', at: '1' },
    { category: 'gate', at: '2' },
  ]
  assert.equal(filterTimelineEvents(events, 'gate').length, 1)
})
