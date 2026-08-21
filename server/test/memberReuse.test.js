import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-member-hash-'))
process.env.ACW_DATA_ROOT = dataRoot

const { parseProjectParams, appendProjectParams, MAX_PROJECT_PARAMS, MEMBER_KIND } =
  await import('@acw/shared')
const { initDb, getDb } = await import('../src/db.js')
initDb()
const { createMember, createSessionFromMember, getSessionDetail, deleteSession, listGroups } =
  await import('../src/services.js')

test('project params cap at #99', () => {
  const many = Array.from({ length: 120 }, (_, i) => `p${i + 1}`).join(' ')
  const parsed = parseProjectParams(many)
  assert.equal(parsed.list.length, MAX_PROJECT_PARAMS)
  assert.equal(parsed.map['#99'], 'p99')
  assert.equal(parsed.map['#100'], undefined)

  const first = appendProjectParams([], Array.from({ length: 80 }, (_, i) => `a${i}`).join(' '))
  assert.equal(first.list.length, 80)
  const next = appendProjectParams(first.list, Array.from({ length: 40 }, (_, i) => `b${i}`).join(' '))
  assert.equal(next.list.length, MAX_PROJECT_PARAMS)
})

test('opening a member chat reuses the same session and skips start gate', async () => {
  const member = createMember({
    name: `echo-reuse-${Date.now()}`,
    displayName: '复用成员',
    kind: MEMBER_KIND.ECHO,
    workFolder: process.cwd(),
    config: { defaultText: 'ok' },
  })
  const first = createSessionFromMember(member.id)
  assert.ok(first?.id)
  assert.equal(first.reused, undefined)
  const detail = getSessionDetail(first.id)
  assert.equal(detail.session.context?.pendingStart, undefined)
  assert.equal(
    detail.messages.some((m) => m.content?.mode === 'session_start'),
    false,
  )

  const second = createSessionFromMember(member.id)
  assert.equal(second.id, first.id)
  assert.equal(second.reused, true)
})

test('deleteSession actually removes the chat; missing id is not success', () => {
  const member = createMember({
    name: `echo-delete-${Date.now()}`,
    displayName: '删除成员',
    kind: MEMBER_KIND.ECHO,
    workFolder: process.cwd(),
    config: { defaultText: 'ok' },
  })
  const first = createSessionFromMember(member.id)
  assert.ok(first?.id)
  const gone = deleteSession(first.id)
  assert.equal(gone.deleted, true)
  assert.equal(getSessionDetail(first.id), null)
  assert.equal(deleteSession(first.id).deleted, false)
  const leftover = listGroups({ includeAdhoc: true, includeDemo: true }).filter(
    (g) => g.config?.fromMemberId === member.id,
  )
  assert.equal(leftover.length, 0)

  const again = createSessionFromMember(member.id)
  assert.ok(again?.id)
  assert.notEqual(again.id, first.id)
  assert.equal(again.reused, undefined)
})

test('deleteSession also drops terminal_sessions rows', () => {
  const member = createMember({
    name: `echo-term-${Date.now()}`,
    displayName: '终端行',
    kind: MEMBER_KIND.ECHO,
    workFolder: process.cwd(),
    config: { defaultText: 'ok' },
  })
  const session = createSessionFromMember(member.id)
  getDb()
    .prepare(
      `INSERT INTO terminal_sessions (id, session_id, status, started_at)
       VALUES (?, ?, 'exited', datetime('now'))`,
    )
    .run(`term_${session.id}`, session.id)
  assert.equal(deleteSession(session.id).deleted, true)
  const left = getDb()
    .prepare('SELECT COUNT(*) AS c FROM terminal_sessions WHERE session_id = ?')
    .get(session.id)
  assert.equal(left.c, 0)
})
