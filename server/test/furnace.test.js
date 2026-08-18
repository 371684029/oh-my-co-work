import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-furnace-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb } = await import('../src/db.js')
initDb()

const {
  isFurnaceMember,
  FURNACE_DISPLAY_NAME,
  FURNACE_MEMBER_KEY,
  MEMBER_KIND,
} = await import('@acw/shared')
const { createMember, listMembers, updateMember } = await import('../src/services.js')
const { ensureAdminMember } = await import('../src/slashCommands.js')
const { getAppSettings } = await import('../src/appSettings.js')

test('isFurnaceMember matches key and old/new display names', () => {
  assert.equal(isFurnaceMember({ name: FURNACE_MEMBER_KEY }), true)
  assert.equal(isFurnaceMember({ display_name: FURNACE_DISPLAY_NAME }), true)
  assert.equal(isFurnaceMember({ display_name: '统一管理员' }), true)
  assert.equal(isFurnaceMember({ name: 'echo', display_name: '示例回声' }), false)
})

test('getAppSettings exposes grok defaults without requiring configured', () => {
  const s = getAppSettings()
  assert.equal(typeof s.grok.command, 'string')
  assert.ok(s.grok.command.length > 0)
  assert.equal(typeof s.grok.configured, 'boolean')
})

test('ensureAdminMember seeds 熔炉 with stable unified_admin key', () => {
  const m = ensureAdminMember()
  assert.equal(m.name, FURNACE_MEMBER_KEY)
  assert.equal(m.display_name, FURNACE_DISPLAY_NAME)
  assert.equal(m.kind, MEMBER_KIND.ECHO)
  const again = ensureAdminMember()
  assert.equal(again.id, m.id)
  assert.equal(again.display_name, FURNACE_DISPLAY_NAME)
})

test('ensureAdminMember renames legacy 统一管理员 display name', () => {
  const leftover = listMembers().find((x) => x.name === FURNACE_MEMBER_KEY)
  if (leftover) {
    updateMember(leftover.id, {
      displayName: '统一管理员',
      config: { ...(leftover.config || {}), defaultText: '【统一管理员】收到。' },
    })
  } else {
    createMember({
      name: FURNACE_MEMBER_KEY,
      displayName: '统一管理员',
      kind: MEMBER_KIND.ECHO,
      config: { role: 'admin', defaultText: '【统一管理员】收到。' },
    })
  }
  const m = ensureAdminMember()
  assert.equal(m.display_name, FURNACE_DISPLAY_NAME)
  assert.equal(m.name, FURNACE_MEMBER_KEY)
  assert.ok(!String(m.config?.defaultText || '').includes('统一管理员'))
})
