import assert from 'node:assert/strict'
import test from 'node:test'
import { stripAnsi, stripAnsiTail, normalizeFurnaceSurface, FURNACE_SURFACE } from '@acw/shared'

test('stripAnsi drops CSI color and keeps text', () => {
  const raw = '\u001b[32mhello\u001b[0m world'
  assert.equal(stripAnsi(raw), 'hello world')
})

test('stripAnsiTail keeps only the end of a long dump', () => {
  const raw = `${'x'.repeat(20)}\n${'y'.repeat(50)}`
  const tail = stripAnsiTail(raw, { maxChars: 20, maxLines: 10 })
  assert.equal(tail.includes('x'), false)
  assert.ok(tail.includes('y'))
})

test('normalizeFurnaceSurface defaults to chat', () => {
  assert.equal(normalizeFurnaceSurface(''), FURNACE_SURFACE.CHAT)
  assert.equal(normalizeFurnaceSurface('tui'), FURNACE_SURFACE.TUI)
})
