import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-furnace-life-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb } = await import('../src/db.js')
initDb()

const { MEMBER_KIND } = await import('@acw/shared')
const { createMember, createSessionFromMember } = await import('../src/services.js')
const { ensureAdminMember } = await import('../src/slashCommands.js')
const { updateAppSettings } = await import('../src/appSettings.js')
const { closeFurnace, reopenFurnace, furnaceNodeId } = await import('../src/furnaceLifecycle.js')

test('closeFurnace on a session with no grok process is still ok', () => {
  updateAppSettings({ grok: { command: 'grok', configured: true } })
  const member = ensureAdminMember()
  assert.equal(member.kind, MEMBER_KIND.SCRIPT)
  const session = createSessionFromMember(member.id)
  const r = closeFurnace(session.id)
  assert.equal(r.ok, true)
  assert.equal(r.closed, true)
  assert.ok(r.killed >= 0)
})

test('reopenFurnace binds the furnace node, not the last step', async () => {
  updateAppSettings({ grok: { command: 'grok-not-installed-acw', configured: true } })
  const member = ensureAdminMember()
  const session = createSessionFromMember(member.id)
  const expected = furnaceNodeId(session.id, member.id)
  assert.ok(expected)
  const r = await reopenFurnace(session.id)
  assert.equal(r.nodeInstanceId, expected)
  assert.equal(r.replaced, true)
  const closed = closeFurnace(session.id)
  assert.equal(closed.ok, true)
})

test('reopenFurnace refuses a chat that has no furnace node', async () => {
  updateAppSettings({ grok: { command: 'grok-not-installed-acw', configured: true } })
  ensureAdminMember()
  const echo = createMember({
    name: `echo-no-furnace-${Date.now()}`,
    displayName: '没有熔炉节点',
    kind: MEMBER_KIND.ECHO,
    workFolder: process.cwd(),
    config: { defaultText: 'ok' },
  })
  const session = createSessionFromMember(echo.id)
  await assert.rejects(() => reopenFurnace(session.id), /熔炉节点/)
})
