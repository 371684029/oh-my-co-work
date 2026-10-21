import assert from 'node:assert/strict'
import test from 'node:test'

const { clampZoom, stepUiZoom } = await import('../src/composables/uiZoom.js')

test('clampZoom bounds', () => {
  assert.equal(clampZoom(0.1), 0.6)
  assert.equal(clampZoom(9), 1.6)
  assert.equal(clampZoom(1.05), 1.05)
})

test('stepUiZoom', () => {
  assert.equal(stepUiZoom(1, 1), 1.1)
  assert.equal(stepUiZoom(0.6, -1), 0.6)
})
