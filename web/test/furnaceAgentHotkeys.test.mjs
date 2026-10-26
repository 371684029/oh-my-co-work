import assert from 'node:assert/strict'
import test from 'node:test'
import { createFurnaceAgentHotkeys } from '../src/components/terminal/composables/furnaceAgentHotkeys.js'

function fakeKeyEvent({ key, metaKey = false, ctrlKey = false, target }) {
  return {
    key,
    metaKey,
    ctrlKey,
    target,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true
    },
  }
}

function setup({ inRoot = true, targetTag = 'BUTTON' } = {}) {
  globalThis.window = globalThis.window || {}
  globalThis.document = globalThis.document || { activeElement: null }
  const root = {}
  const target = {
    closest: (sel) => (targetTag === 'xterm' && sel.includes('xterm') ? {} : null),
  }
  root.contains = (el) => inRoot && el === target
  const selected = []
  const workspaceRoot = { value: root }
  const { onKeyDown } = createFurnaceAgentHotkeys({
    workspaceRoot,
    setActiveAgent: (agent) => selected.push(agent),
  })
  return { onKeyDown, selected, target }
}

test('onKeyDown switches to grok/cursor on Ctrl/Cmd+1/2', () => {
  const { onKeyDown, selected, target } = setup()
  onKeyDown(fakeKeyEvent({ key: '1', metaKey: true, target }))
  onKeyDown(fakeKeyEvent({ key: '2', ctrlKey: true, target }))
  assert.deepEqual(selected, ['grok', 'cursor'])
})

test('onKeyDown ignores xterm targets, other keys and no-modifier', () => {
  const xterm = setup({ targetTag: 'xterm' })
  xterm.onKeyDown(fakeKeyEvent({ key: '1', metaKey: true, target: xterm.target }))
  const plain = setup()
  plain.onKeyDown(fakeKeyEvent({ key: '1', metaKey: true, target: null }))
  plain.onKeyDown(fakeKeyEvent({ key: '9', metaKey: true, target: plain.target }))
  plain.onKeyDown(fakeKeyEvent({ key: '1', target: plain.target }))
  assert.deepEqual(xterm.selected, [])
  assert.deepEqual(plain.selected, [])
})

test('onKeyDown prevents default on handled hotkey', () => {
  const { onKeyDown, target } = setup()
  const ev = fakeKeyEvent({ key: '2', metaKey: true, target })
  onKeyDown(ev)
  assert.equal(ev.defaultPrevented, true)
})
