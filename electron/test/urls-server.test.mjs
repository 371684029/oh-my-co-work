import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { desktopUpdateResult, normalizeAppOrigin, workbenchUrl } from '../lib/urls.mjs'
import { resolveNodeBin, resolveServerEntry } from '../lib/server.mjs'

test('workbenchUrl 使用 history 路径而不是 hash 或 query', () => {
  assert.equal(workbenchUrl('http://127.0.0.1:3780', 's1'), 'http://127.0.0.1:3780/workbench/s1')
  assert.equal(workbenchUrl('http://127.0.0.1:3780/', ''), 'http://127.0.0.1:3780/workbench')
  assert.equal(workbenchUrl('http://127.0.0.1:3780/workbench', 'a b'), 'http://127.0.0.1:3780/workbench/a%20b')
})

test('normalizeAppOrigin 拒绝非 http(s)', () => {
  assert.equal(normalizeAppOrigin('file:///tmp/index.html'), 'http://127.0.0.1:3780')
  assert.equal(normalizeAppOrigin('http://127.0.0.1:3799/foo'), 'http://127.0.0.1:3799')
})

test('desktopUpdateResult 从不报告成功', () => {
  assert.deepEqual(desktopUpdateResult(null), { ok: false, reason: 'invalid-manifest' })
  assert.deepEqual(desktopUpdateResult({ version: '5.0.0' }), { ok: false, reason: 'not-implemented' })
})

test('resolveNodeBin 优先 runtime 内的 node', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-node-'))
  const runtime = path.join(dir, 'runtime')
  fs.mkdirSync(runtime)
  const exe = path.join(runtime, 'node.exe')
  fs.writeFileSync(exe, '')
  assert.equal(resolveNodeBin(dir, 'win32'), exe)
  assert.equal(resolveNodeBin(dir + '-missing', 'win32'), 'node.exe')
  assert.equal(resolveNodeBin(dir + '-missing', 'linux'), 'node')
})

test('resolveServerEntry 优先打包入口', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-entry-'))
  const packed = path.join(dir, 'server', 'dist', 'index.cjs')
  fs.mkdirSync(path.dirname(packed), { recursive: true })
  fs.writeFileSync(packed, 'module.exports={}')
  assert.equal(resolveServerEntry(dir), packed)

  const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-src-'))
  const src = path.join(srcDir, 'server', 'src', 'index.js')
  fs.mkdirSync(path.dirname(src), { recursive: true })
  fs.writeFileSync(src, 'export {}')
  assert.equal(resolveServerEntry(srcDir), src)

  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-empty-'))
  assert.throws(() => resolveServerEntry(empty), /找不到服务入口/)
})
