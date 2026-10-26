import assert from 'node:assert/strict'
import test from 'node:test'
import { createFlowRailRevertActions } from '../src/views/workbench/composables/flowRailRevertActions.js'

function fakeNotify() {
  const calls = { warning: [], success: [], error: [] }
  return {
    calls,
    warning: (...a) => calls.warning.push(a),
    success: (...a) => calls.success.push(a),
    error: (...a) => calls.error.push(a),
  }
}

test('createFlowRailRevertActions exposes revertStepChanges', () => {
  const { revertStepChanges } = createFlowRailRevertActions({
    activeId: { value: 's1' },
    revertLoadingId: { value: '' },
    api: { sessions: {} },
  })
  assert.equal(typeof revertStepChanges, 'function')
})

test('revertStepChanges stops on blocked preview without applying', async () => {
  let applied = false
  const revertLoadingId = { value: '' }
  const notify = fakeNotify()
  const { revertStepChanges } = createFlowRailRevertActions({
    activeId: { value: 's1' },
    revertLoadingId,
    notify,
    api: {
      sessions: {
        previewStepRevert: async () => ({ ok: false, message: 'blocked' }),
        applyStepRevert: async () => {
          applied = true
        },
      },
    },
  })
  await revertStepChanges({ id: 'n1' })
  assert.equal(applied, false)
  assert.equal(revertLoadingId.value, '')
  assert.equal(notify.calls.warning.length, 1)
})

test('revertStepChanges applies after confirm and clears loading', async () => {
  const applied = []
  const revertLoadingId = { value: '' }
  const notify = fakeNotify()
  const { revertStepChanges } = createFlowRailRevertActions({
    activeId: { value: 's1' },
    revertLoadingId,
    notify,
    messageBox: { confirm: async () => {} },
    api: {
      sessions: {
        previewStepRevert: async () => ({ ok: true, needsForce: false }),
        applyStepRevert: async (_sid, id, opts) => applied.push([id, opts]),
      },
    },
  })
  await revertStepChanges({ id: 'n1' })
  assert.deepEqual(applied, [['n1', { force: false }]])
  assert.equal(revertLoadingId.value, '')
  assert.equal(notify.calls.success.length, 1)
})

test('revertStepChanges no-ops without session or node', async () => {
  const { revertStepChanges } = createFlowRailRevertActions({
    activeId: { value: '' },
    revertLoadingId: { value: '' },
    notify: fakeNotify(),
    messageBox: { confirm: async () => {} },
    api: { sessions: {} },
  })
  await revertStepChanges({ id: 'n1' })
  const { revertStepChanges: revert2 } = createFlowRailRevertActions({
    activeId: { value: 's1' },
    revertLoadingId: { value: '' },
    notify: fakeNotify(),
    messageBox: { confirm: async () => {} },
    api: { sessions: {} },
  })
  await revert2(null)
})
