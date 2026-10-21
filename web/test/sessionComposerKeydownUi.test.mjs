import assert from 'node:assert/strict'
import test from 'node:test'
import { handleComposerPickerListKeydown } from '../src/views/workbench/composables/sessionComposerKeydownUi.js'

function keyEvent(key, opts = {}) {
  return {
    key,
    shiftKey: !!opts.shiftKey,
    preventDefault() {
      this.defaultPrevented = true
    },
    stopPropagation() {
      this.propagationStopped = true
    },
    defaultPrevented: false,
    propagationStopped: false,
  }
}

test('handleComposerPickerListKeydown cycles with arrows', () => {
  let index = 0
  const e = keyEvent('ArrowDown')
  const handled = handleComposerPickerListKeydown(e, {
    listLength: 3,
    index,
    setIndex: (i) => {
      index = i
    },
    onPick: () => {},
    onClose: () => {},
  })
  assert.equal(handled, true)
  assert.equal(index, 1)
  assert.equal(e.defaultPrevented, true)
})

test('slash enter requires prefix when configured', () => {
  const e = keyEvent('Enter')
  const handled = handleComposerPickerListKeydown(e, {
    listLength: 2,
    index: 0,
    setIndex: () => {},
    onPick: () => {},
    onClose: () => {},
    selectOnTab: false,
    enterRequiresSlashPrefix: true,
    readSenderText: () => 'hello',
  })
  assert.equal(handled, false)
})
