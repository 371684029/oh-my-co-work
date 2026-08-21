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
const { createSessionFromMember } = await import('../src/services.js')
const { ensureAdminMember } = await import('../src/slashCommands.js')
const { updateAppSettings } = await import('../src/appSettings.js')
const { closeFurnace, reopenFurnace } = await import('../src/furnaceLifecycle.js')

test('closeFurnace on a session with no grok process is still ok', () => {
  updateAppSettings({ grok: { command: 'grok', configured: true } })
  const member = ensureAdminMember()
  assert.equal(member.kind, MEMBER_KIND.SCRIPT)
  const session = createSessionFromMember(member.id)
  const r = closeFurnace(session.id)
  assert.equal(r.ok, true)
  assert.equal(r.closed, true)
  assert.equal(typeof r.killed, 'number')
})

test('reopenFurnace replaces the grok pty even if spawn fails', async () => {
  updateAppSettings({ grok: { command: 'grok-not-installed-acw', configured: true } })
  const member = ensureAdminMember()
  const session = createSessionFromMember(member.id)
  const r = await reopenFurnace(session.id)
  assert.equal(r.replaced, true)
  assert.equal(typeof r.ok, 'boolean')
  const closed = closeFurnace(session.id)
  assert.equal(closed.ok, true)
})
