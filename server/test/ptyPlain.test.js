import assert from 'node:assert/strict'
import test from 'node:test'
import { renderPtyPlainText } from '@acw/shared'

test('carriage return overwrites the same line', () => {
  assert.equal(renderPtyPlainText('hello\rworld', { cols: 40, rows: 10 }), 'world')
})

test('CSI EL clears the rest of the line before redraw', () => {
  const text = renderPtyPlainText('hello\u001b[1G\u001b[K你好', { cols: 40, rows: 10 })
  assert.equal(text, '你好')
})

test('colors do not leak into GUI text', () => {
  assert.equal(renderPtyPlainText('\u001b[32mhello\u001b[0m 世界', { cols: 40, rows: 10 }), 'hello 世界')
})

test('cursor home plus wipe does not concatenate TUI frames', () => {
  const raw = 'old frame ||||| leftover\u001b[H\u001b[2J新画面\n第二行'
  const text = renderPtyPlainText(raw, { cols: 40, rows: 10 })
  assert.equal(text.includes('old frame'), false)
  assert.equal(text.includes('|||||'), false)
  assert.match(text, /新画面/)
  assert.match(text, /第二行/)
})
