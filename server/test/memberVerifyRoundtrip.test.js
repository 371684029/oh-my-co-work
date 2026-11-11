import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-verify-rt-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb } = await import('../src/db.js')
initDb()
const { createMember, getMember, verifyMemberById } = await import('../src/services.js')
const { restoreMemberRefine } = await import('../src/refineRestore.js')
const { MEMBER_KIND } = await import('@acw/shared')

test('refine save → verify ok → break script → verify fail → restore → verify ok', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-vrt-'))
  const file = path.join(dir, 'ok.mjs')
  const origBytes = 'console.log("warmup")\n'
  fs.writeFileSync(file, origBytes, 'utf8')

  const saved = createMember({
    name: `vrt_${Date.now()}`,
    displayName: '验证往返',
    kind: MEMBER_KIND.SCRIPT,
    config: {
      refine: { enabled: true },
      script: {
        mode: 'file',
        filePath: file,
        scriptWorkDir: dir,
        command: `node ${path.basename(file)} #1`,
        executionMode: 'pipe',
      },
    },
  })
  assert.equal(saved.verifyResult?.ok, true, JSON.stringify(saved.verifyResult))

  fs.writeFileSync(file, 'syntax {{{\n', 'utf8')
  const bad = verifyMemberById(saved.id)
  assert.equal(bad.ok, false)

  restoreMemberRefine(saved.id, { force: true })
  const after = verifyMemberById(saved.id)
  assert.equal(after.ok, true, JSON.stringify(after))
  assert.equal(fs.readFileSync(file, 'utf8'), origBytes)
})
