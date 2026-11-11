import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-adapt-plan-'))
process.env.ACW_DATA_ROOT = dataRoot

const { planAdaptForMember, prepareAdaptForMember, ADAPT_MARK } = await import('../src/adaptBackup.js')
const { restoreMemberAdapt } = await import('../src/refineRestore.js')
const { initDb } = await import('../src/db.js')
initDb()
const { createMember, getMember } = await import('../src/services.js')
const { MEMBER_KIND } = await import('@acw/shared')

test('planAdaptForMember lists files without writing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-adapt-plan-f-'))
  const file = path.join(dir, 'a.mjs')
  fs.writeFileSync(file, 'console.log(1)\n', 'utf8')
  const plan = planAdaptForMember({
    kind: 'script',
    config: {
      adapt: true,
      script: {
        mode: 'file',
        filePath: file,
        scriptWorkDir: dir,
        executionMode: 'terminal',
      },
    },
  })
  assert.equal(plan.ok, true)
  assert.equal(plan.fileCount, 1)
  assert.match(plan.files[0].snippet, /ACW-ADAPT/)
})

test('adapt restore roundtrip via prepareAdaptForMember', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-adapt-rt-'))
  const file = path.join(dir, 'run.mjs')
  fs.writeFileSync(file, 'console.log("v1")\n', 'utf8')
  const m = createMember({
    name: `adapt_${Date.now()}`,
    displayName: '适配测',
    kind: MEMBER_KIND.SCRIPT,
    config: {
      adapt: true,
      script: {
        mode: 'file',
        filePath: file,
        scriptWorkDir: dir,
        command: `node ${path.basename(file)}`,
        executionMode: 'pipe',
      },
    },
  })
  const prep = prepareAdaptForMember(getMember(m.id), { sessionId: 's1', nodeId: 'n1' })
  assert.equal(prep.fallback, false)
  assert.ok(fs.readFileSync(file, 'utf8').includes(ADAPT_MARK))
  const hist = restoreMemberAdapt(m.id, { force: true })
  assert.ok(hist.restored.includes(file))
  assert.equal(fs.readFileSync(file, 'utf8'), 'console.log("v1")\n')
})
