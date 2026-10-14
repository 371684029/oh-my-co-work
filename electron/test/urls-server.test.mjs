import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { desktopUpdateResult, normalizeAppOrigin, workbenchUrl } from '../lib/urls.mjs'
import {
  resolveNodeBin,
  resolveServerEntry,
  readAppVersion,
  fetchHealth,
  spawnAppServer,
  stdioForChildLog,
  openAppendFd,
  waitHealth,
  stopChild,
} from '../lib/server.mjs'
import http from 'node:http'

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

test('readAppVersion 优先 about.json，回落到 package.json', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-ver-'))
  fs.mkdirSync(path.join(dir, 'server', 'config'), { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'server', 'config', 'about.json'),
    JSON.stringify({ version: '9.9.9' }),
  )
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: '1.0.0' }))
  assert.equal(readAppVersion(dir), '9.9.9')

  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-ver2-'))
  fs.writeFileSync(path.join(dir2, 'package.json'), JSON.stringify({ version: '2.3.4' }))
  assert.equal(readAppVersion(dir2), '2.3.4')

  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-ver3-'))
  assert.equal(readAppVersion(empty), '')
})

test('fetchHealth 解析 /api/health JSON 并在非 200 时拒绝', async () => {
  const ok = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, version: '5.1.0', instanceId: 'abc' }))
  })
  const bad = http.createServer((_req, res) => {
    res.writeHead(500)
    res.end('boom')
  })
  await new Promise((resolve) => ok.listen(0, '127.0.0.1', resolve))
  await new Promise((resolve) => bad.listen(0, '127.0.0.1', resolve))
  const okPort = ok.address().port
  const badPort = bad.address().port
  try {
    const health = await fetchHealth(okPort)
    assert.equal(health.version, '5.1.0')
    assert.equal(health.instanceId, 'abc')
    await assert.rejects(() => fetchHealth(badPort), /health status 500/)
  } finally {
    await new Promise((resolve) => ok.close(resolve))
    await new Promise((resolve) => bad.close(resolve))
  }
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

test('未打开的 WriteStream 不能当 spawn stdio（Windows 弹窗：stdio invalid fd null）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-(a)-stdio-'))
  const logPath = path.join(dir, 'desktop-server.log')
  const stream = fs.createWriteStream(logPath, { flags: 'a' })
  assert.equal(stream.fd, null)
  assert.throws(() => stdioForChildLog(stream), /尚未打开/)
  assert.throws(() => {
    spawn(process.execPath, ['-e', ''], { stdio: ['ignore', stream, stream] })
  }, /stdio|invalid/i)
  stream.destroy()
})

test('openSync fd 可以 spawn 子进程，带括号的路径也能写日志并健康检查', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-(a)-srv-'))
  const entry = path.join(dir, 'health.cjs')
  fs.writeFileSync(
    entry,
    [
      "const http = require('http')",
      'const port = Number(process.env.ACW_PORT)',
      "http.createServer((req, res) => {",
      "  if (req.url === '/api/health') { res.writeHead(200); res.end('ok'); return }",
      '  res.writeHead(404); res.end()',
      "}).listen(port, '127.0.0.1')",
      "process.stdout.write('server-up\\n')",
      '',
    ].join('\n'),
  )
  const port = await new Promise((resolve, reject) => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address()
      const p = typeof addr === 'object' && addr ? addr.port : 0
      s.close((err) => (err ? reject(err) : resolve(p)))
    })
    s.on('error', reject)
  })
  const logPath = path.join(dir, 'data', 'desktop-server.log')
  const logFd = openAppendFd(logPath)
  const child = spawnAppServer({
    appRoot: dir,
    port,
    nodeBin: process.execPath,
    entry,
    logFd,
  })
  fs.closeSync(logFd)
  try {
    await waitHealth(port, 8000)
    const log = fs.readFileSync(logPath, 'utf8')
    assert.match(log, /server-up/)
  } finally {
    stopChild(child)
    await new Promise((r) => setTimeout(r, 200))
  }
})

