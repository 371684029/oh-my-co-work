import assert from 'node:assert/strict'
import test from 'node:test'
import { t as tZh } from '../src/i18n/zh-CN.js'
import { t as tEn } from '../src/i18n/en-US.js'
import { getLocale, setLocale, t } from '../src/i18n/index.js'

test('i18n t() resolves a11y keys in zh-CN and en-US', () => {
  assert.match(tZh('a11y.skipToMain'), /主内容/)
  assert.match(tEn('a11y.skipToMain'), /Skip to main/i)
  assert.match(tZh('a11y.flowRail'), /侧栏/)
  assert.match(tEn('a11y.flowRail'), /sidebar/i)
})

test('i18n index setLocale switches active t()', () => {
  const prev = getLocale()
  setLocale('en-US')
  assert.match(t('a11y.workbenchMain'), /main area/i)
  setLocale('zh-CN')
  assert.match(t('a11y.workbenchMain'), /主区域/)
  setLocale(prev)
})
