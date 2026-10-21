import test from 'node:test'
import assert from 'node:assert/strict'
import {
  stripTrailingHashTrigger,
  textToChatNode,
} from '../src/views/workbench/composables/sessionComposerInput.js'

test('stripTrailingHashTrigger removes trailing hash segment', () => {
  assert.equal(stripTrailingHashTrigger('hello #foo'), 'hello')
  assert.equal(stripTrailingHashTrigger('keep'), 'keep')
})

test('textToChatNode splits lines into Write nodes', () => {
  const node = textToChatNode('a\nb')
  assert.equal(node.length, 2)
  assert.equal(node[0][0].text, 'a')
})
