import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { pngToIco } from '../../scripts/app-icons.mjs'
import { stampWinExeIcon } from '../../scripts/win-exe-icon.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = path.resolve(root, '..')

test('electron 图标是首页 Logo 而不是纯色方块', () => {
  const png = fs.readFileSync(path.join(root, 'icon.png'))
  const ico = fs.readFileSync(path.join(root, 'icon.ico'))
  assert.equal(png[0], 0x89)
  assert.ok(png.length > 8000, 'icon.png 应是完整 Logo 栅格')
  assert.equal(ico.readUInt16LE(0), 0)
  assert.equal(ico.readUInt16LE(2), 1)
  assert.ok(ico.readUInt16LE(4) >= 1)
})

test('pngToIco 写出合法 ICO 头', () => {
  const png = fs.readFileSync(path.join(root, 'icon.png'))
  const ico = pngToIco([png])
  assert.equal(ico.readUInt16LE(2), 1)
  assert.equal(ico.readUInt16LE(4), 1)
})

test('stampWinExeIcon 能把大于原资源的 Logo ICO 写入 electron.exe', (t) => {
  const zip = path.join(repo, 'release/cache/electron-v32.3.3-win32-x64.zip')
  if (!fs.existsSync(zip)) {
    t.skip('无 Electron zip 缓存（仅打包机/本机打过 desktop 后跑）')
    return
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-exe-icon-'))
  try {
    execFileSync('unzip', ['-q', '-o', zip, 'electron.exe', '-d', dir])
    const exe = path.join(dir, 'electron.exe')
    const before = fs.statSync(exe).size
    stampWinExeIcon(exe, path.join(root, 'icon.ico'))
    assert.ok(fs.statSync(exe).size >= before)
    const buf = fs.readFileSync(exe)
    assert.equal(buf[0], 0x4d)
    assert.equal(buf[1], 0x5a)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
