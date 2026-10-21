import test from 'node:test'
import assert from 'node:assert/strict'
import { pathsToTerminalPaste, quotePathForTerminal } from '../src/composables/terminalFilePaste.js'

test('quotePathForTerminal quotes paths with spaces', () => {
  assert.equal(quotePathForTerminal('C:\\a b\\c'), '"C:\\\\a b\\\\c"')
})

test('pathsToTerminalPaste uses @ prefix in furnace mode', () => {
  assert.equal(pathsToTerminalPaste(['inbox/s1/x.png'], { asAtRef: true }), '@inbox/s1/x.png')
})
