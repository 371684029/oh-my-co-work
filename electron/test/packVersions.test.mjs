import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))

test('acwPack pins exact runtime versions', () => {
  assert.match(pkg.acwPack.nodeVersion, /^\d+\.\d+\.\d+$/)
  assert.match(pkg.acwPack.electronVersion, /^\d+\.\d+\.\d+$/)
})

test('packed Electron matches the dev electron dependency (same major, not older)', () => {
  const dev = String(pkg.devDependencies.electron).replace(/^[\^~]/, '').split('.').map(Number)
  const packed = pkg.acwPack.electronVersion.split('.').map(Number)
  assert.equal(packed[0], dev[0], 'electron 大版本不一致：开发与桌面包行为会分叉')
  assert.ok(
    packed[1] > dev[1] || (packed[1] === dev[1] && packed[2] >= dev[2]),
    `acwPack.electronVersion ${pkg.acwPack.electronVersion} 低于 devDependencies ${pkg.devDependencies.electron}`,
  )
})
