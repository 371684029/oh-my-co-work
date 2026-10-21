import assert from 'node:assert/strict'
import test from 'node:test'

const classes = new Set()
globalThis.document = {
  documentElement: {
    classList: {
      toggle: (name, on) => {
        if (on) classes.add(name)
        else classes.delete(name)
      },
      contains: (name) => classes.has(name),
    },
    dataset: {},
  },
}

const {
  normalizeColorScheme,
  applyColorScheme,
  resolveEffectiveScheme,
} = await import('../src/composables/uiColorScheme.js')

test('normalizeColorScheme', () => {
  assert.equal(normalizeColorScheme('dark'), 'dark')
  assert.equal(normalizeColorScheme('nope'), 'system')
})

test('applyColorScheme toggles class', () => {
  applyColorScheme('dark')
  assert.ok(document.documentElement.classList.contains('ecw-theme-dark'))
  applyColorScheme('light')
  assert.equal(document.documentElement.classList.contains('ecw-theme-dark'), false)
})

test('resolveEffectiveScheme respects preference', () => {
  assert.equal(resolveEffectiveScheme('light'), 'light')
})
