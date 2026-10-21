import test from 'node:test'
import assert from 'node:assert/strict'
import { copyVisibleTerminalText } from '../src/composables/terminalBufferUtils.js'

test('copyVisibleTerminalText joins wrapped lines', () => {
  const xterm = {
    rows: 2,
    buffer: {
      active: {
        viewportY: 0,
        getLine: (y) => {
          if (y === 0) return { translateToString: () => 'hello ', isWrapped: false }
          if (y === 1) return { translateToString: () => 'world', isWrapped: true }
          return null
        },
      },
    },
  }
  assert.equal(copyVisibleTerminalText(xterm), 'hello world')
})
