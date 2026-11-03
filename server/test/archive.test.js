import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import zlib from 'node:zlib'
import { execFileSync } from 'node:child_process'
import {
  archiveLooksValid,
  createZip,
  extractTarGz,
  extractZip,
  listZip,
  readZipEntry,
} from '../../scripts/lib/archive.mjs'

const hasCmd = (cmd) =>
  [['--version'], ['-v']].some((args) => {
    try {
      execFileSync(cmd, args, { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  })

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'acw-archive-'))
}

function makeTree(root) {
  fs.mkdirSync(path.join(root, 'runtime'), { recursive: true })
  fs.mkdirSync(path.join(root, 'empty'), { recursive: true })
  fs.writeFileSync(path.join(root, 'runtime', 'node'), Buffer.alloc(4096, 7))
  fs.chmodSync(path.join(root, 'runtime', 'node'), 0o755)
  fs.writeFileSync(path.join(root, '中文.txt'), 'hello 世界\n'.repeat(100))
  if (process.platform !== 'win32') fs.symlinkSync('runtime/node', path.join(root, 'link'))
}

test('createZip → extractZip 往返：内容、顶层目录、可执行位、符号链接都保留', () => {
  const dir = tmpdir()
  const src = path.join(dir, 'app')
  makeTree(src)
  const zip = path.join(dir, 'app.zip')
  createZip(src, zip, { prefix: 'app' })

  const names = listZip(zip).map((e) => e.name)
  assert.ok(names.includes('app/'))
  assert.ok(names.includes('app/runtime/node'))
  assert.ok(names.includes('app/empty/'))
  assert.equal(readZipEntry(zip, 'app/中文.txt').toString('utf8'), 'hello 世界\n'.repeat(100))

  const out = path.join(dir, 'out')
  extractZip(zip, out)
  assert.deepEqual(fs.readFileSync(path.join(out, 'app/runtime/node')), Buffer.alloc(4096, 7))
  if (process.platform !== 'win32') {
    assert.ok(fs.statSync(path.join(out, 'app/runtime/node')).mode & 0o100)
    assert.equal(fs.readlinkSync(path.join(out, 'app/link')), 'runtime/node')
    assert.ok(listZip(zip).find((e) => e.name === 'app/link').isSymlink)
  }
})

test('executables 清单在 Windows 宿主上也能标记可执行位', () => {
  const dir = tmpdir()
  const src = path.join(dir, 'app')
  makeTree(src)
  fs.chmodSync(path.join(src, 'runtime', 'node'), 0o644)
  const zip = path.join(dir, 'app.zip')
  createZip(src, zip, { prefix: 'app', executables: ['runtime/node'] })
  const entry = listZip(zip).find((e) => e.name === 'app/runtime/node')
  assert.ok(entry.mode & 0o111)
})

test('与系统 unzip 互通（CI 与用户解压工具能读）', { skip: !hasCmd('unzip') }, () => {
  const dir = tmpdir()
  const src = path.join(dir, 'app')
  makeTree(src)
  const zip = path.join(dir, 'app.zip')
  createZip(src, zip, { prefix: 'app' })
  execFileSync('unzip', ['-tq', zip])
  const out = path.join(dir, 'u')
  execFileSync('unzip', ['-q', zip, '-d', out])
  assert.equal(fs.readFileSync(path.join(out, 'app/中文.txt'), 'utf8'), 'hello 世界\n'.repeat(100))
})

test('能读系统 zip -y 产出的包（Electron 官方 zip 同类）', { skip: !hasCmd('zip') || process.platform === 'win32' }, () => {
  const dir = tmpdir()
  makeTree(path.join(dir, 'app'))
  const zip = path.join(dir, 'sys.zip')
  execFileSync('zip', ['-r', '-q', '-y', zip, 'app'], { cwd: dir })
  const out = path.join(dir, 'out')
  extractZip(zip, out)
  assert.equal(fs.readlinkSync(path.join(out, 'app/link')), 'runtime/node')
  assert.ok(fs.statSync(path.join(out, 'app/runtime/node')).mode & 0o100)
})

test('截断 / 损坏的 zip 被识别（下载缓存不再「坏了就一直坏」）', () => {
  const dir = tmpdir()
  const src = path.join(dir, 'app')
  makeTree(src)
  const zip = path.join(dir, 'app.zip')
  createZip(src, zip, { prefix: 'app' })
  assert.equal(archiveLooksValid(zip), true)
  const cut = path.join(dir, 'cut.zip')
  const whole = fs.readFileSync(zip)
  fs.writeFileSync(cut, whole.subarray(0, Math.floor(whole.length / 2)))
  assert.equal(archiveLooksValid(cut), false)
  const bad = path.join(dir, 'bad.zip')
  const buf = Buffer.from(fs.readFileSync(zip))
  const entry = listZip(zip).find((e) => e.name === 'app/中文.txt')
  buf[entry.localOffset + 30 + Buffer.byteLength('app/中文.txt') + 2] ^= 0xff
  fs.writeFileSync(bad, buf)
  assert.throws(() => extractZip(bad, path.join(dir, 'x')), /校验失败|invalid|incorrect/i)
})

test('zip 条目路径越界被拒绝', () => {
  const dir = tmpdir()
  const src = path.join(dir, 'app')
  fs.mkdirSync(src)
  fs.writeFileSync(path.join(src, 'a.txt'), 'x')
  const zip = path.join(dir, 'evil.zip')
  createZip(src, zip, { prefix: '..' })
  assert.throws(() => extractZip(zip, path.join(dir, 'out')), /越界/)
})

test('extractTarGz 读系统 tar 产物，支持 filter', { skip: !hasCmd('tar') || process.platform === 'win32' }, () => {
  const dir = tmpdir()
  makeTree(path.join(dir, 'node-v1'))
  const tgz = path.join(dir, 'n.tar.gz')
  execFileSync('tar', ['-czf', tgz, 'node-v1'], { cwd: dir })
  assert.equal(archiveLooksValid(tgz), true)
  const out = path.join(dir, 'out')
  const n = extractTarGz(tgz, out, { filter: (name) => name.endsWith('runtime/node') })
  assert.equal(n, 1)
  assert.ok(fs.existsSync(path.join(out, 'node-v1/runtime/node')))
  assert.ok(!fs.existsSync(path.join(out, 'node-v1/中文.txt')))
  assert.ok(fs.statSync(path.join(out, 'node-v1/runtime/node')).mode & 0o100)
})

test('截断的 tar.gz 判为无效', () => {
  const dir = tmpdir()
  const tgz = path.join(dir, 'x.tar.gz')
  const gz = zlib.gzipSync(crypto.randomBytes(64 * 1024))
  fs.writeFileSync(tgz, gz.subarray(0, Math.floor(gz.length / 2)))
  assert.equal(archiveLooksValid(tgz), false)
})
