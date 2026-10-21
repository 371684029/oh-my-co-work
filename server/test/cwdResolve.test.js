import assert from 'node:assert/strict'
import test from 'node:test'
import { extractScriptPathFromCommand } from '../src/runners/cwdResolve.js'

test('extractScriptPathFromCommand finds script extension', () => {
  assert.equal(extractScriptPathFromCommand('node ./src/index.mjs --watch'), './src/index.mjs')
  assert.equal(extractScriptPathFromCommand('echo hi'), null)
})
