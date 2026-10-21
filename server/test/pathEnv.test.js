import test from 'node:test'
import assert from 'node:assert/strict'
import { augmentPathForGuiLaunch } from '../src/pathEnv.js'
import os from 'node:os'
import path from 'node:path'

test('augmentPathForGuiLaunch adds home bin dirs', () => {
  const env = augmentPathForGuiLaunch({ PATH: '/usr/bin' })
  assert.ok(env.PATH.includes('/usr/bin'))
  assert.ok(env.PATH.includes(path.join(os.homedir(), '.local', 'bin')))
})
