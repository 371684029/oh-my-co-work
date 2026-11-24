import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-app-refine-'))
process.env.ACW_DATA_ROOT = dataRoot
process.env.ACW_APP_SETTINGS_PATH = path.join(dataRoot, 'app-settings.json')

const { getAppSettings, updateAppSettings, refineSourceBackupEnabled } = await import(
  '../src/appSettings.js'
)

test('refine.backup is persisted; adapt legacy still reads', () => {
  updateAppSettings({ refine: { backup: false }, adapt: { backup: true } })
  const s = getAppSettings()
  assert.equal(s.refine.backup, false)
  assert.equal(refineSourceBackupEnabled(), false)
  updateAppSettings({ refine: { backup: true } })
  assert.equal(refineSourceBackupEnabled(), true)
})