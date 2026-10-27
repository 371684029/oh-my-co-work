import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-settings-path-'))
process.env.ACW_DATA_ROOT = dataRoot
delete process.env.ACW_APP_SETTINGS_PATH

const appSettings = await import('../src/appSettings.js')

test('app settings live under ACW_DATA_ROOT, not the install dir', () => {
  assert.equal(appSettings.APP_SETTINGS_PATH, path.join(dataRoot, 'app-settings.json'))
  assert.notEqual(appSettings.APP_SETTINGS_PATH, appSettings.LEGACY_APP_SETTINGS_PATH)
})

test('first run seeds data-root settings from the legacy install-dir file and never writes it back', () => {
  const legacyBefore = fs.readFileSync(appSettings.LEGACY_APP_SETTINGS_PATH, 'utf8')
  const legacy = JSON.parse(legacyBefore)
  const s = appSettings.getAppSettings()
  assert.ok(fs.existsSync(appSettings.APP_SETTINGS_PATH))
  assert.equal(s.showDemo, legacy.showDemo !== false)

  appSettings.updateAppSettings({ showDemo: !s.showDemo })
  assert.equal(appSettings.getAppSettings().showDemo, !s.showDemo)
  assert.equal(fs.readFileSync(appSettings.LEGACY_APP_SETTINGS_PATH, 'utf8'), legacyBefore)
})

test('slash commands are seeded into the data root and edits do not touch the install dir', async () => {
  const slash = await import('../src/slashCommands.js')
  const legacyPath = path.resolve(path.dirname(appSettings.LEGACY_APP_SETTINGS_PATH), 'slash-commands.json')
  const legacyBefore = fs.readFileSync(legacyPath, 'utf8')
  assert.equal(slash.SLASH_COMMANDS_PATH, path.join(dataRoot, 'slash-commands.json'))
  const list = slash.listSlashCommands()
  assert.ok(Array.isArray(list) && list.length > 0)
  assert.ok(fs.existsSync(slash.SLASH_COMMANDS_PATH))
  assert.equal(fs.readFileSync(legacyPath, 'utf8'), legacyBefore)
})
