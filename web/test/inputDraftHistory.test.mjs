import test from 'node:test'
import assert from 'node:assert/strict'

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
}
import {
  saveInputDraft,
  loadInputDraft,
  pushInputHistory,
  stepInputHistory,
  composerScopeKey,
} from '../src/composables/inputDraftHistory.js'

test('draft and history round-trip in localStorage', () => {
  const key = composerScopeKey(`test-session-${Date.now()}`)
  saveInputDraft(key, 'draft text')
  assert.equal(loadInputDraft(key), 'draft text')
  pushInputHistory(key, 'hello')
  pushInputHistory(key, 'world')
  const step = stepInputHistory(key, { index: -1, delta: -1 })
  assert.equal(step.text, 'world')
})
