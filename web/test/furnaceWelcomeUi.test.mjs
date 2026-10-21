import assert from 'node:assert/strict'
import test from 'node:test'
import {
  furnaceFailHeading,
  furnaceWelcomeKicker,
  furnaceWelcomeTitle,
} from '../src/composables/furnaceWelcomeUi.js'
import { setLocale } from '../src/i18n/index.js'

test('furnaceWelcomeUi', () => {
  setLocale('zh-CN')
  assert.match(furnaceWelcomeTitle('grok'), /Grok/)
  assert.match(
    furnaceWelcomeKicker({
      connectionStatus: 'open',
      terminalStatus: 'running',
      isRunning: true,
      agentBrand: 'Grok',
      agentKind: 'grok',
    }),
    /就绪/,
  )
  assert.match(furnaceFailHeading('Grok CLI'), /没在跑/)
  setLocale('en-US')
  assert.match(furnaceWelcomeTitle('cursor'), /Cursor/i)
})
