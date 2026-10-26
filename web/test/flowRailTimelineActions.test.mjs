import assert from 'node:assert/strict'
import test from 'node:test'
import { createFlowRailTimelineActions } from '../src/views/workbench/composables/flowRailTimelineActions.js'

function fakeNotify() {
  const calls = { warning: [], success: [], error: [] }
  return {
    calls,
    warning: (...a) => calls.warning.push(a),
    success: (...a) => calls.success.push(a),
    error: (...a) => calls.error.push(a),
  }
}

function createDeps(overrides = {}) {
  return {
    activeId: { value: 's1' },
    detail: { value: { nodes: [{ id: 'n1', title: 'build' }] } },
    timelineEvents: { value: [] },
    timelineFilter: { value: 'all' },
    timelineLoading: { value: false },
    terminalReplayOpen: { value: false },
    terminalReplayText: { value: '' },
    terminalReplayMeta: { value: null },
    flowStore: { rightTab: 'timeline' },
    toggleNodeExpand: () => {},
    openNodeJournal: () => {},
    notify: fakeNotify(),
    api: {
      sessions: {
        timeline: async () => ({ events: [{ id: 'e1' }] }),
        downloadAudit: async () => {},
        terminalLogPreview: async () => ({ text: 'log', bytes: 3 }),
      },
    },
    ...overrides,
  }
}

test('createFlowRailTimelineActions exposes timeline actions', () => {
  const actions = createFlowRailTimelineActions(createDeps())
  assert.equal(typeof actions.loadSessionTimeline, 'function')
  assert.equal(typeof actions.downloadSessionAudit, 'function')
  assert.equal(typeof actions.openTerminalReplay, 'function')
  assert.equal(typeof actions.onTimelineEvent, 'function')
})

test('loadSessionTimeline fills events and clears without session', async () => {
  const deps = createDeps()
  const actions = createFlowRailTimelineActions(deps)
  await actions.loadSessionTimeline()
  assert.deepEqual(deps.timelineEvents.value, [{ id: 'e1' }])
  assert.equal(deps.timelineLoading.value, false)
  deps.activeId.value = ''
  await actions.loadSessionTimeline()
  assert.deepEqual(deps.timelineEvents.value, [])
})

test('openTerminalReplay loads preview into replay state', async () => {
  const deps = createDeps()
  const actions = createFlowRailTimelineActions(deps)
  await actions.openTerminalReplay('t1')
  assert.equal(deps.terminalReplayOpen.value, true)
  assert.equal(deps.terminalReplayText.value, 'log')
  assert.deepEqual(deps.terminalReplayMeta.value, { text: 'log', bytes: 3 })
})

test('onTimelineEvent routes node events back to flow tab', () => {
  let expanded = null
  const deps = createDeps({ toggleNodeExpand: (n) => (expanded = n) })
  const actions = createFlowRailTimelineActions(deps)
  actions.onTimelineEvent({ nodeId: 'n1' })
  assert.equal(deps.flowStore.rightTab, 'flow')
  assert.equal(expanded?.id, 'n1')
  actions.onTimelineEvent(null)
  assert.equal(expanded?.id, 'n1')
})
