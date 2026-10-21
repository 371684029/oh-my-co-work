import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-dryrun-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb } = await import('../src/db.js')
initDb()
const { createMember } = await import('../src/services.js')
const { dryRunMemberStep } = await import('../src/stepDryRun.js')
const { MEMBER_KIND } = await import('@acw/shared')

test('dryRunMemberStep succeeds for echo member', async () => {
  const member = createMember({
    name: `echo-dry-${Date.now()}`,
    displayName: 'Echo',
    kind: MEMBER_KIND.ECHO,
    workFolder: process.cwd(),
    config: { defaultText: 'hello dry' },
  })
  const r = await dryRunMemberStep(member, {
    group: { work_folder: process.cwd() },
    sessionContext: { primaryWorkFolder: process.cwd(), params: {} },
  })
  assert.equal(r.ok, true)
  assert.equal(r.data.dryRun, true)
  assert.ok(r.data.checklist.length >= 2)
})
