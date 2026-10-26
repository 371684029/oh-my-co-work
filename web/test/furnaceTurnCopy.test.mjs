import assert from 'node:assert/strict'
import test from 'node:test'
import { createFurnaceTurnCopyActions } from '../src/components/terminal/composables/furnaceTurnCopy.js'

function fakeNotify() {
  const calls = { warning: [], success: [], error: [] }
  return {
    calls,
    warning: (...a) => calls.warning.push(a),
    success: (...a) => calls.success.push(a),
    error: (...a) => calls.error.push(a),
  }
}

test('createFurnaceTurnCopyActions exposes copyTurn', () => {
  const { copyTurn } = createFurnaceTurnCopyActions({
    writeClipboardText: async () => {},
  })
  assert.equal(typeof copyTurn, 'function')
})

test('copyTurn writes plain turn text and toasts success', async () => {
  const written = []
  const notify = fakeNotify()
  const { copyTurn } = createFurnaceTurnCopyActions({
    writeClipboardText: async (text) => written.push(text),
    notify,
  })
  await copyTurn({ role: 'user', text: 'hello' })
  assert.deepEqual(written, ['hello'])
  assert.equal(notify.calls.success.length, 1)
})

test('copyTurn warns without writing when text is empty', async () => {
  const written = []
  const notify = fakeNotify()
  const { copyTurn } = createFurnaceTurnCopyActions({
    writeClipboardText: async (text) => written.push(text),
    notify,
  })
  await copyTurn({ role: 'assistant', text: '' })
  await copyTurn(null)
  assert.deepEqual(written, [])
  assert.equal(notify.calls.warning.length, 2)
})

test('copyTurn warns when clipboard write fails', async () => {
  const notify = fakeNotify()
  const { copyTurn } = createFurnaceTurnCopyActions({
    writeClipboardText: async () => {
      throw new Error('denied')
    },
    notify,
  })
  await copyTurn({ role: 'user', text: 'hello' })
  assert.equal(notify.calls.warning.length, 1)
  assert.equal(notify.calls.success.length, 0)
})
