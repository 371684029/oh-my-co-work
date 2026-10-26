import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

// NTF-06: notification_inbox 持久化路由。隔离数据根（对齐 backupRoutes.test.js 套路）。
test('notification inbox routes persist, filter, read and clear with isolated data', async (t) => {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-notification-inbox-'))
  process.env.ACW_DATA_ROOT = dataRoot
  process.env.ACW_API_TOKEN = 'notification-inbox-test-token'
  const { initDb, closeDb, getDb } = await import('../src/db.js')
  const { requireLocalAccess } = await import('../src/localAccess.js')
  const routes = (await import('../src/routes.js')).default
  const { handleNotificationIntent } = await import('../src/notificationIntents.js')
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
  const headers = { 'X-ACW-Token': 'notification-inbox-test-token' }

  // table exists via initDb migration
  const table = getDb()
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'notification_inbox'`)
    .get()
  assert.equal(table?.name, 'notification_inbox')

  // empty list
  const empty = await fetch(`${base}/api/notification/inbox`, { headers })
  assert.equal(empty.status, 200)
  assert.deepEqual((await empty.json()).items, [])

  // write-through record
  const created = await fetch(`${base}/api/notification/inbox`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'gate:s1:1',
      eventId: 'gate:s1:1',
      level: 'action',
      sessionId: 's1',
      title: '等你确认',
      body: '流程需要你处理',
      deepLink: 'session:s1',
      createdAt: 1000,
    }),
  })
  assert.equal(created.status, 201)
  const createdBody = await created.json()
  assert.equal(createdBody.item.id, 'gate:s1:1')
  assert.equal(createdBody.item.read, false)

  // upsert by id does not duplicate and keeps read state
  await fetch(`${base}/api/notification/inbox`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'gate:s1:1', title: '等你确认', body: '已更新', read: true }),
  })
  const afterUpsert = await fetch(`${base}/api/notification/inbox`, { headers })
  const upsertItems = (await afterUpsert.json()).items
  assert.equal(upsertItems.length, 1)
  assert.equal(upsertItems[0].read, false)

  // second row + unread filter
  await fetch(`${base}/api/notification/inbox`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'done:session:s2:archived',
      level: 'done',
      sessionId: 's2',
      title: '「演示」已归档',
      body: '流程已结束并归档',
      deepLink: 'session:s2',
      createdAt: 2000,
    }),
  })
  const unread = await fetch(`${base}/api/notification/inbox?unread=1`, { headers })
  assert.equal((await unread.json()).items.length, 2)

  // mark one read
  const readOne = await fetch(`${base}/api/notification/inbox/read`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: ['done:session:s2:archived'] }),
  })
  assert.equal(readOne.status, 200)
  assert.equal((await readOne.json()).changed, 1)
  const unreadAfter = await fetch(`${base}/api/notification/inbox?unread=1`, { headers })
  const unreadIds = (await unreadAfter.json()).items.map((it) => it.id)
  assert.deepEqual(unreadIds, ['gate:s1:1'])

  // mark all read
  await fetch(`${base}/api/notification/inbox/read`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ all: true }),
  })
  const unreadAll = await fetch(`${base}/api/notification/inbox?unread=1`, { headers })
  assert.deepEqual((await unreadAll.json()).items, [])

  // invalid read request
  const badRead = await fetch(`${base}/api/notification/inbox/read`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  assert.equal(badRead.status, 400)

  // server-side intent layer (NTF-02): terminal session state → done row
  const intent = handleNotificationIntent({
    type: 'session.status',
    payload: { sessionId: 's1', status: 'archived' },
  })
  assert.equal(intent?.level, 'done')
  assert.equal(intent?.id, 'done:session:s1:archived')
  const afterIntent = await fetch(`${base}/api/notification/inbox`, { headers })
  const intentRow = (await afterIntent.json()).items.find((it) => it.id === 'done:session:s1:archived')
  assert.equal(intentRow?.level, 'done')
  assert.equal(intentRow?.deepLink, 'session:s1')

  // same event re-records idempotently (stable eventId)
  handleNotificationIntent({ type: 'session.archived', payload: { sessionId: 's1' } })
  const all = await fetch(`${base}/api/notification/inbox`, { headers })
  const rows = (await all.json()).items
  assert.equal(rows.filter((it) => it.id === 'done:session:s1:archived').length, 1)

  // non-terminal events produce no intent
  assert.equal(
    handleNotificationIntent({ type: 'gate.request', payload: { sessionId: 's1' } }),
    null,
  )

  // clear
  const cleared = await fetch(`${base}/api/notification/inbox/clear`, {
    method: 'POST',
    headers,
    body: '{}',
  })
  assert.equal(cleared.status, 200)
  const afterClear = await fetch(`${base}/api/notification/inbox`, { headers })
  assert.deepEqual((await afterClear.json()).items, [])
})
