import assert from 'node:assert/strict'
import test from 'node:test'
import { createFlowRailDocsRailActions } from '../src/views/workbench/composables/flowRailDocsRailActions.js'

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
    detail: { value: { session: { title: 'S', group_id: 'g1' } } },
    api: {
      docs: {
        file: async () => ({ content: '# doc' }),
        downloadDocsExport: async () => {},
      },
    },
    getDocsList: async () => ({
      groups: [{ sessions: [{ sessionId: 's1', files: [{ name: 'README.md', title: 'Readme' }] }] }],
    }),
    recordDocsOpen: () => {},
    railDocFiles: { value: [] },
    railDocsLoading: { value: false },
    selectedDocName: { value: '' },
    selectedDocContent: { value: '' },
    selectedDocLoading: { value: false },
    exportingRailDocs: { value: false },
    notify: fakeNotify(),
    ...overrides,
  }
}

test('createFlowRailDocsRailActions exposes docs actions', () => {
  const actions = createFlowRailDocsRailActions(createDeps())
  assert.equal(typeof actions.loadRailDocs, 'function')
  assert.equal(typeof actions.onSelectRailDoc, 'function')
  assert.equal(typeof actions.onExportRailGroupDocs, 'function')
})

test('loadRailDocs finds session files and auto-selects first', async () => {
  const deps = createDeps()
  const { loadRailDocs } = createFlowRailDocsRailActions(deps)
  await loadRailDocs()
  assert.deepEqual(deps.railDocFiles.value.map((f) => f.name), ['README.md'])
  assert.equal(deps.selectedDocName.value, 'README.md')
  assert.equal(deps.selectedDocContent.value, '# doc')
  assert.equal(deps.railDocsLoading.value, false)
})

test('loadRailDocs clears docs when no session', async () => {
  const deps = createDeps({ activeId: { value: '' } })
  const { loadRailDocs } = createFlowRailDocsRailActions(deps)
  await loadRailDocs()
  assert.deepEqual(deps.railDocFiles.value, [])
  assert.equal(deps.selectedDocName.value, '')
  assert.equal(deps.selectedDocContent.value, '')
})

test('onSelectRailDoc loads content and records open', async () => {
  const opened = []
  const deps = createDeps({
    recordDocsOpen: (info) => opened.push(info),
  })
  deps.railDocFiles.value = [{ name: 'README.md', title: 'Readme' }]
  const { onSelectRailDoc } = createFlowRailDocsRailActions(deps)
  await onSelectRailDoc('README.md')
  assert.equal(deps.selectedDocContent.value, '# doc')
  assert.deepEqual(
    opened.map((o) => [o.sessionId, o.name, o.label]),
    [['s1', 'README.md', 'Readme']],
  )
})

test('onExportRailGroupDocs warns without group and exports with group', async () => {
  let exported = 0
  const notify = fakeNotify()
  const deps = createDeps({
    detail: { value: { session: {} } },
    notify,
    api: { docs: { downloadDocsExport: async () => (exported += 1) } },
  })
  const { onExportRailGroupDocs } = createFlowRailDocsRailActions(deps)
  await onExportRailGroupDocs()
  assert.equal(exported, 0)
  assert.equal(notify.calls.warning.length, 1)
  deps.detail.value = { session: { group_id: 'g1' } }
  await onExportRailGroupDocs()
  assert.equal(exported, 1)
  assert.equal(deps.exportingRailDocs.value, false)
  assert.equal(notify.calls.success.length, 1)
})
