import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveTerminalTheme } from '../src/components/terminal/terminalPrefs.js'

test('resolveTerminalTheme maps the three terminal themes', () => {
  assert.equal(resolveTerminalTheme('project-dark').background, '#17191f')
  assert.equal(resolveTerminalTheme('native').background, '#000000')
  assert.equal(resolveTerminalTheme('high-contrast').foreground, '#ffffff')
  assert.equal(resolveTerminalTheme('missing').background, '#17191f')
})
