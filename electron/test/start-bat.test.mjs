import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { windowsStartBat } from '../../scripts/windowsStartBat.mjs'
import { splashDataUrl, splashHtml } from '../lib/splash.mjs'
import { applyDesktopOpenState } from '../lib/windowState.mjs'
import { electronExe, electronSandboxArgs, spawnElectron } from '../../scripts/desktop-launch.mjs'

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

test('desktop-launch 优先带图标的 oh-my-co-work.exe（win32）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-launch-'))
  fs.mkdirSync(path.join(dir, 'desktop'))
  fs.writeFileSync(path.join(dir, 'desktop', 'oh-my-co-work.exe'), '')
  fs.writeFileSync(path.join(dir, 'desktop', 'electron.exe'), '')
  assert.equal(electronExe(dir, 'win32'), path.join(dir, 'desktop', 'oh-my-co-work.exe'))
  // 兼容历史布局：只有 electron.exe 时也能解析
  fs.rmSync(path.join(dir, 'desktop', 'oh-my-co-work.exe'))
  assert.equal(electronExe(dir, 'win32'), path.join(dir, 'desktop', 'electron.exe'))
})

test('desktop-launch linux 解析 desktop/oh-my-co-work（兜底 electron）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-launch-'))
  fs.mkdirSync(path.join(dir, 'desktop'))
  fs.writeFileSync(path.join(dir, 'desktop', 'oh-my-co-work'), '')
  fs.writeFileSync(path.join(dir, 'desktop', 'electron'), '')
  assert.equal(electronExe(dir, 'linux'), path.join(dir, 'desktop', 'oh-my-co-work'))
  fs.rmSync(path.join(dir, 'desktop', 'oh-my-co-work'))
  assert.equal(electronExe(dir, 'linux'), path.join(dir, 'desktop', 'electron'))
})

test('desktop-launch darwin 解析 Electron.app 内二进制（保留 .app 包结构）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-launch-'))
  fs.mkdirSync(path.join(dir, 'desktop', 'Electron.app', 'Contents', 'MacOS'), { recursive: true })
  assert.equal(
    electronExe(dir, 'darwin'),
    path.join(dir, 'desktop', 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  )
  // 若未来改名 oh-my-co-work.app 也兼容
  fs.mkdirSync(path.join(dir, 'desktop', 'oh-my-co-work.app', 'Contents', 'MacOS'), {
    recursive: true,
  })
  fs.writeFileSync(path.join(dir, 'desktop', 'oh-my-co-work.app', 'Contents', 'MacOS', 'Electron'), '')
  assert.equal(
    electronExe(dir, 'darwin'),
    path.join(dir, 'desktop', 'oh-my-co-work.app', 'Contents', 'MacOS', 'Electron'),
  )
})

test('splash 页立刻能显示启动中', () => {
  assert.match(splashHtml(), /正在启动本机服务/)
  assert.match(splashHtml(), /data:image\/png;base64,/)
  assert.match(splashDataUrl(), /^data:text\/html/)
})

test('desktop-launch 把解压目录作为 Electron 的应用路径', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-launch-'))
  const calls = []
  spawnElectron(
    dir,
    (exe, args, opts) => {
      calls.push({ exe, args, opts })
      return { once() {}, unref() {} }
    },
    { extraArgs: [] },
  )
  assert.equal(calls.length, 1)
  assert.equal(calls[0].exe, electronExe(dir))
  assert.deepEqual(calls[0].args, [dir])
  assert.equal(calls[0].opts.cwd, dir)
  assert.equal(calls[0].opts.detached, true)
  assert.equal(calls[0].opts.windowsHide, false)
  assert.equal(typeof calls[0].opts.stdio[1], 'number')
  assert.equal(calls[0].opts.stdio[2], calls[0].opts.stdio[1])
})

test('linux 沙箱：SUID helper 与 userns 都不可用时才加 --no-sandbox', () => {
  const args = (probe, extra = {}) =>
    electronSandboxArgs('/x', { platform: 'linux', env: {}, probe: () => probe, ...extra })
  assert.deepEqual(args({ suidHelper: false, usernsBlocked: true }), ['--no-sandbox'])
  assert.deepEqual(args({ suidHelper: true, usernsBlocked: true }), [])
  assert.deepEqual(args({ suidHelper: false, usernsBlocked: false }), [])
  assert.deepEqual(
    args({ suidHelper: true, usernsBlocked: false }, { env: { ACW_ELECTRON_NO_SANDBOX: '1' } }),
    ['--no-sandbox'],
  )
  assert.deepEqual(
    electronSandboxArgs('/x', { platform: 'win32', probe: () => ({ suidHelper: false, usernsBlocked: true }) }),
    [],
  )
})

test('spawnElectron 把沙箱参数放在应用路径之前', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-launch-'))
  const calls = []
  spawnElectron(dir, (exe, args) => (calls.push(args), { once() {}, unref() {} }), {
    extraArgs: ['--no-sandbox'],
  })
  assert.deepEqual(calls[0], ['--no-sandbox', dir])
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
