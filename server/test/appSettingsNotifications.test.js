import assert from 'node:assert/strict'
import test from 'node:test'
import {
  defaultNotificationSettings,
  defaultTerminalSettings,
  normalizeTerminal,
} from '../src/appSettings.js'

test('defaultNotificationSettings enables action/error by default', () => {
  const d = defaultNotificationSettings()
  assert.equal(d.enabled, true)
  assert.equal(d.levels.action, true)
  assert.equal(d.levels.error, true)
  assert.equal(d.levels.done, false)
})

test('allowActionButtons stays retired (NTF-18 choice b)', () => {
  const d = defaultNotificationSettings()
  assert.equal('allowActionButtons' in d, false)
  assert.deepEqual(Object.keys(d).sort(), [
    'enabled',
    'levels',
    'maxReminders',
    'onlyWhenUnfocused',
    'quietHours',
    'remindIntervalMs',
    'sound',
  ])
})

test('defaultTerminalSettings disables selectToCopy by default (CP-03)', () => {
  assert.equal(defaultTerminalSettings().selectToCopy, false)
})

test('normalizeTerminal coerces selectToCopy to boolean (CP-03)', () => {
  assert.equal(normalizeTerminal({ selectToCopy: true }).selectToCopy, true)
  assert.equal(normalizeTerminal({ selectToCopy: false }).selectToCopy, false)
  assert.equal(normalizeTerminal({ selectToCopy: 'true' }).selectToCopy, false)
  assert.equal(normalizeTerminal({ selectToCopy: 1 }).selectToCopy, false)
  assert.equal(normalizeTerminal({}).selectToCopy, false)
  assert.equal(normalizeTerminal(null).selectToCopy, false)
  assert.equal(normalizeTerminal('nope').selectToCopy, false)
})

test('terminal font stack puts Consolas before Microsoft YaHei UI and defaults letterSpacing to 0', () => {
  const d = defaultTerminalSettings()
  assert.ok(d.fontFamily.indexOf('Consolas') < d.fontFamily.indexOf('Microsoft YaHei UI'))
  assert.equal(d.letterSpacing, 0)
  // 旧配置迁移：曾把雅黑排在 Consolas 前、letterSpacing=0.2，自动升级为新默认
  const migrated = normalizeTerminal({
    fontFamily:
      "'Cascadia Code', 'JetBrains Mono', 'SFMono-Regular', 'Microsoft YaHei UI', Consolas, monospace",
    letterSpacing: 0.2,
  })
  assert.equal(migrated.fontFamily, d.fontFamily)
  assert.equal(migrated.letterSpacing, 0)
})
