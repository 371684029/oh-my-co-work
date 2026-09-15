import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { windowsStartBat } from '../../scripts/windowsStartBat.mjs'
import { splashDataUrl, splashHtml } from '../lib/splash.mjs'
import { applyDesktopOpenState } from '../lib/windowState.mjs'
import { electronExe, spawnElectron } from '../../scripts/desktop-launch.mjs'

test('start.bat 用包内 node 拉 Electron，不用 cmd start', () => {
  const bat = windowsStartBat()
  assert.equal(bat.includes('start "oh-my-co-work"'), false)
  assert.equal(bat.includes('/D "%~dp0"'), false)
  assert.equal(bat.includes('cd /d "%~dp0."'), true)
  assert.equal(bat.includes('oh-my-co-work.exe'), true)
  assert.equal(bat.includes('desktop-launch.mjs'), true)
  assert.equal(bat.includes('runtime\\node.exe'), true)
  assert.equal(bat.includes('pause'), true)
})

test('desktop-launch 优先带图标的 oh-my-co-work.exe', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-launch-'))
  fs.mkdirSync(path.join(dir, 'desktop'))
  fs.writeFileSync(path.join(dir, 'desktop', 'oh-my-co-work.exe'), '')
  fs.writeFileSync(path.join(dir, 'desktop', 'electron.exe'), '')
  assert.equal(electronExe(dir), path.join(dir, 'desktop', 'oh-my-co-work.exe'))
})

test('splash 页立刻能显示启动中', () => {
  assert.match(splashHtml(), /正在启动本机服务/)
  assert.match(splashHtml(), /data:image\/png;base64,/)
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

test('桌面窗口打开时最大化并进入系统全屏', () => {
  const calls = []
  const win = {
    maximize: () => calls.push('maximize'),
    setFullScreen: (v) => calls.push(`fullscreen:${v}`),
  }
  assert.equal(applyDesktopOpenState(win), true)
  assert.deepEqual(calls, ['maximize', 'fullscreen:true'])
})
