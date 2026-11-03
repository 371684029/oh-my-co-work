import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

test('HTTP backup list, download and restore work with isolated data', async (t) => {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-backup-http-'))
  process.env.ACW_DATA_ROOT = dataRoot
  process.env.ACW_API_TOKEN = 'backup-route-test-token'
  const { initDb, closeDb } = await import('../src/db.js')
  const { requireLocalAccess } = await import('../src/localAccess.js')
  const routes = (await import('../src/routes.js')).default
  const express = (await import('express')).default
  initDb()
  const app = express()
  app.use(express.json())
  app.use('/api', requireLocalAccess, routes)
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    closeDb()
    fs.rmSync(dataRoot, { recursive: true, force: true })
  })
  const base = `http://127.0.0.1:${server.address().port}`
  const headers = { 'X-ACW-Token': 'backup-route-test-token' }

  const denied = await fetch(`${base}/api/update/backups`)
  assert.equal(denied.status, 401)
  const empty = await fetch(`${base}/api/update/backups`, { headers })
  assert.deepEqual((await empty.json()).backups, [])

  const created = await fetch(`${base}/api/update/backup`, { method: 'POST', headers })
  assert.equal(created.status, 200)
  const backup = await created.json()
  assert.equal(backup.ok, true)
  const filename = path.basename(backup.path)
  const listed = await fetch(`${base}/api/update/backups`, { headers })
  assert.ok((await listed.json()).backups.some((item) => item.filename === filename))

  const download = await fetch(`${base}/api/backup/download?filename=${filename}`, { headers })
  assert.equal(download.status, 200)
  const archive = Buffer.from(await download.arrayBuffer())
  assert.deepEqual([...archive.subarray(0, 2)], [0x1f, 0x8b])
  const latest = await fetch(`${base}/api/backup/download`, { headers })
  assert.equal(latest.status, 200)
  assert.deepEqual([...Buffer.from(await latest.arrayBuffer()).subarray(0, 2)], [0x1f, 0x8b])

  const invalid = await fetch(`${base}/api/update/restore`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: 'not-a-backup.tar.gz' }),
  })
  assert.equal(invalid.status, 400)
  // ZIP 格式：导出备份包 → 下载 → 一键导入恢复（与设置页一致）
  const zipCreated = await fetch(`${base}/api/backup?format=zip`, { method: 'POST', headers })
  assert.equal(zipCreated.status, 201)
  const zipBackup = await zipCreated.json()
  assert.equal(zipBackup.format, 'zip')
  const zipFilename = path.basename(zipBackup.path)
  assert.match(zipFilename, /\.zip$/)
  const zipDownload = await fetch(`${base}/api/backup/download?filename=${zipFilename}`, { headers })
  assert.equal(zipDownload.status, 200)
  const zipBytes = Buffer.from(await zipDownload.arrayBuffer())
  assert.deepEqual([...zipBytes.subarray(0, 4)], [0x50, 0x4b, 3, 4])
  const imported = await fetch(`${base}/api/backup/import`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/octet-stream' },
    body: zipBytes,
  })
  assert.equal(imported.status, 200)
  assert.match((await imported.json()).restoredFrom, /\.zip$/)

  const restored = await fetch(`${base}/api/update/restore`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  })
  assert.equal(restored.status, 200)
  assert.equal((await restored.json()).restoredFrom, filename)
})
