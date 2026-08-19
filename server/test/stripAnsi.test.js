import assert from 'node:assert/strict'
import test from 'node:test'
import { stripAnsi, normalizeFurnaceSurface, FURNACE_SURFACE } from '@acw/shared'

test('stripAnsi drops CSI color and keeps text', () => {
  const raw = '\u001b[32mhello\u001b[0m world'
  assert.equal(stripAnsi(raw), 'hello world')
})

test('normalizeFurnaceSurface defaults to chat', () => {
  assert.equal(normalizeFurnaceSurface(''), FURNACE_SURFACE.CHAT)
  assert.equal(normalizeFurnaceSurface('tui'), FURNACE_SURFACE.TUI)
})
