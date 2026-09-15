import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pngToIco } from '../../scripts/app-icons.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

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
