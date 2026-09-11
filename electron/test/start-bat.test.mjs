import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { windowsStartBat } from '../../scripts/windowsStartBat.mjs'
import { splashDataUrl, splashHtml } from '../lib/splash.mjs'
import { electronExe, spawnElectron } from '../../scripts/desktop-launch.mjs'

test('start.bat 用包内 node 拉 Electron，不用 cmd start', () => {
  const bat = windowsStartBat()
  assert.equal(bat.includes('start "oh-my-co-work"'), false)
  assert.equal(bat.includes('/D "%~dp0"'), false)
  assert.equal(bat.includes('cd /d "%~dp0."'), true)
  assert.equal(bat.includes('desktop-launch.mjs'), true)
  assert.equal(bat.includes('runtime\\node.exe'), true)
  assert.equal(bat.includes('pause'), true)
})

test('splash 页立刻能显示启动中', () => {
  assert.match(splashHtml(), /正在启动本机服务/)
  assert.match(splashDataUrl(), /^data:text\/html/)
})

test('desktop-launch 把解压目录作为 Electron 的应用路径', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-launch-'))
  const calls = []
  spawnElectron(dir, (exe, args, opts) => {
    calls.push({ exe, args, opts })
    return { once() {}, unref() {} }
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].exe, electronExe(dir))
  assert.deepEqual(calls[0].args, [dir])
  assert.equal(calls[0].opts.cwd, dir)
  assert.equal(calls[0].opts.detached, true)
  assert.equal(calls[0].opts.windowsHide, false)
  assert.equal(typeof calls[0].opts.stdio[1], 'number')
  assert.equal(calls[0].opts.stdio[2], calls[0].opts.stdio[1])
})
