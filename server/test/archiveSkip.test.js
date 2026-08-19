import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-archive-skip-'))
process.env.ACW_DATA_ROOT = dataRoot

const { enrichScriptConfig } = await import('../src/runners.js')
const { initDb, getDb } = await import('../src/db.js')
initDb()
const { createMember, createGroup, createSessionFromGroup, createSessionFromMember, getSessionDetail, handleGateAction } = await import(
  '../src/services.js'
)
const { requestArchiveConsent, processDueArchives, dismissPendingArchiveIfAny } = await import(
  '../src/engine.js'
)
const { listOccupiedResources, releaseResources } = await import('../src/resources.js')
const { MEMBER_KIND, SESSION_STATUS } = await import('@acw/shared')

test('enrichScriptConfig drops retired timeoutMs', () => {
  const next = enrichScriptConfig({
    command: 'echo',
    timeoutMs: 600_000,
    executionMode: 'pipe',
  })
  assert.equal(next.timeoutMs, undefined)
  assert.equal(next.command, 'echo')
  assert.equal(next.executionMode, 'pipe')
})

function makeSession() {
  const member = createMember({
    name: `echo-${Date.now()}-${Math.random()}`,
    displayName: '测试回声',
    kind: MEMBER_KIND.ECHO,
    workFolder: process.cwd(),
    config: { defaultText: 'ok' },
  })
  const group = createGroup({
    title: `组 ${member.id}`,
    description: 'archive skip test',
    workFolder: process.cwd(),
    steps: [{ title: '回声', type: 'member', memberId: member.id, gate: false }],
  })
  return createSessionFromGroup(group.id)
}

test('finishing a flow does not open archive consent or kill via pendingArchive', () => {
  const session = makeSession()
  const before = getSessionDetail(session.id)
  assert.ok(before)
  assert.equal(
    (before.nodes || []).some((n) => n.step_type === 'archive'),
    false,
  )

  const r = requestArchiveConsent(session.id, 'completed')
  assert.equal(r, null)
  const after = getSessionDetail(session.id)
  assert.equal(after.session.context?.pendingArchive, undefined)
  assert.notEqual(after.session.status, SESSION_STATUS.ARCHIVED)
  assert.equal(
    after.messages.some((m) => m.content?.mode === 'archive_confirm'),
    false,
  )
})

test('processDueArchives dismisses stale pendingArchive without archiving', () => {
  const session = makeSession()
  const db = getDb()
  const dueAt = new Date(Date.now() - 3600 * 1000).toISOString()
  db.prepare(`UPDATE sessions SET status = ?, context_json = ? WHERE id = ?`).run(
    SESSION_STATUS.WAITING_HUMAN,
    JSON.stringify({
      pendingArchive: { reason: 'completed', dueAt, hours: 3, nodeInstanceId: 'x' },
    }),
    session.id,
  )
  db.prepare(
    `INSERT INTO node_instances (id, session_id, step_index, step_id, title, step_type, member_id, status, gate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run('arch-test-node', session.id, 99, 'archive_tail', '归档', 'archive', null, 'waiting_human', 1)

  const out = processDueArchives()
  assert.equal(out.archived.length, 0)
  assert.ok(out.dismissed.includes(session.id))
  const after = getSessionDetail(session.id)
  assert.notEqual(after.session.status, SESSION_STATUS.ARCHIVED)
  assert.equal(after.session.context?.pendingArchive, undefined)
  const arch = after.nodes.find((n) => n.step_type === 'archive')
  assert.equal(arch?.status, 'skipped')
})

test('dismissPendingArchiveIfAny is a no-op when there is no archive gate', () => {
  const session = makeSession()
  assert.equal(dismissPendingArchiveIfAny(session.id), null)
  assert.equal(getSessionDetail(session.id).session.status, SESSION_STATUS.WAITING_HUMAN)
})

test('resource release listing is empty without live processes', () => {
  assert.deepEqual(listOccupiedResources(), [])
  const r = releaseResources({ sessionIds: [] })
  assert.equal(r.ok, true)
  assert.equal(r.released, 0)
})

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

test('approving the last group node archives the session', async () => {
  const member = createMember({
    name: `echo-last-${Date.now()}`,
    displayName: '末步回声',
    kind: MEMBER_KIND.ECHO,
    workFolder: process.cwd(),
    config: { defaultText: 'ok' },
  })
  const group = createGroup({
    title: '末步归档',
    workFolder: process.cwd(),
    steps: [
      {
        title: '回声',
        type: 'member',
        memberId: member.id,
        flow: { admin: false, auto: false, human: false },
      },
    ],
  })
  const session = createSessionFromGroup(group.id)
  await handleGateAction(session.id, { action: 'approve_start', text: '开始' })
  let detail
  for (let i = 0; i < 40; i++) {
    await wait(25)
    detail = getSessionDetail(session.id)
    if (detail.session.status === SESSION_STATUS.ARCHIVED) break
  }
  assert.equal(detail.nodes[0].status, 'succeeded')
  assert.equal(detail.session.status, SESSION_STATUS.ARCHIVED)
  assert.equal(detail.session.archive_reason, 'completed')
})

test('adhoc member chat does not auto-archive when its only node finishes', async () => {
  const member = createMember({
    name: `echo-adhoc-${Date.now()}`,
    displayName: '单聊回声',
    kind: MEMBER_KIND.ECHO,
    workFolder: process.cwd(),
    config: { defaultText: 'ok' },
  })
  const session = createSessionFromMember(member.id)
  let detail
  for (let i = 0; i < 40; i++) {
    await wait(25)
    detail = getSessionDetail(session.id)
    if (detail.nodes?.[0]?.status === 'waiting_human' || detail.nodes?.[0]?.status === 'succeeded') break
  }
  const node = detail.nodes[0]
  if (node.status === 'waiting_human') {
    await handleGateAction(session.id, { action: 'approve', nodeInstanceId: node.id })
    for (let i = 0; i < 40; i++) {
      await wait(25)
      detail = getSessionDetail(session.id)
      if (detail.nodes[0].status === 'succeeded') break
    }
  }
  assert.equal(detail.nodes[0].status, 'succeeded')
  assert.notEqual(detail.session.status, SESSION_STATUS.ARCHIVED)
})
