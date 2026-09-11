import test from 'node:test'
import assert from 'node:assert/strict'
import { windowsStartBat } from '../../scripts/windowsStartBat.mjs'
import { splashDataUrl, splashHtml } from '../lib/splash.mjs'

test('start.bat 不用 /D "%~dp0" 这种会被反斜杠吃掉引号的写法', () => {
  const bat = windowsStartBat()
  assert.equal(bat.includes('/D "%~dp0"'), false)
  assert.equal(bat.includes('cd /d "%~dp0"'), false)
  assert.equal(bat.includes('/D "%~dp0."'), true)
  assert.equal(bat.includes('cd /d "%~dp0."'), true)
  assert.equal(bat.includes('desktop\\electron.exe'), true)
  assert.equal(bat.includes('"%~dp0desktop\\electron.exe"'), true)
})

test('splash 页立刻能显示启动中', () => {
  assert.match(splashHtml(), /正在启动本机服务/)
  assert.match(splashDataUrl(), /^data:text\/html/)
})
