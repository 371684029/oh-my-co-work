import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-furnace-arch-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb } = await import('../src/db.js')
initDb()

const { createSessionFromMember } = await import('../src/services.js')
const { ensureAdminMember } = await import('../src/slashCommands.js')
const { archiveFurnaceReplay } = await import('../src/furnaceArchive.js')
const docsHub = await import('../src/docsHub.js')

test('archiveFurnaceReplay writes furnace markdown and lists in docs hub', () => {
  const member = ensureAdminMember()
  const session = createSessionFromMember(member.id)
  const r = archiveFurnaceReplay(session.id, {
    replay: 'User: hi\r\nAssistant: hello back\r\n',
    agent: 'grok',
    label: 'furnace test',
  })
  assert.ok(r?.rel)
  assert.ok(fs.existsSync(path.join(dataRoot, 'journals', 'sessions', session.id, r.name)))
  docsHub.invalidateDocsCache()
  const summary = docsHub.getSessionDocsSummary(session.id)
  assert.ok(summary.files.some((f) => f.kind === 'furnace'))
})
