import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-refine-rt-'))
process.env.ACW_DATA_ROOT = dataRoot

const { applyRefineOnMemberSave } = await import('../src/refineSource.js')
const { restoreAdaptManifest, createAdaptBackup } = await import('../src/adaptBackup.js')
const { MEMBER_KIND } = await import('@acw/shared')

test('refine save then restore returns original bytes (CRLF)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-rt-'))
  const bat = path.join(dir, 'run.bat')
  const original = '@echo off\r\necho keep\r\n'
  fs.writeFileSync(bat, original, 'utf8')
  const member = {
    id: 'mem_rt',
    kind: MEMBER_KIND.SCRIPT,
    display_name: 'rt',
    config: {
      refine: { enabled: true },
      script: { mode: 'file', filePath: bat, scriptWorkDir: dir },
    },
  }
  const { nextConfig } = applyRefineOnMemberSave(member)
  assert.ok(nextConfig.refine.refineBackupManifest)
  assert.notEqual(fs.readFileSync(bat, 'utf8'), original)
  restoreAdaptManifest(nextConfig.refine.refineBackupManifest, { force: true })
  assert.equal(fs.readFileSync(bat, 'utf8'), original)
})

test('partial failure rolls back via backup manifest', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-roll-'))
  const a = path.join(dir, 'a.bat')
  const b = path.join(dir, 'b.bat')
  fs.writeFileSync(a, '@echo a\n')
  fs.writeFileSync(b, '@echo b\n')
  const backup = createAdaptBackup({ files: [{ path: a }, { path: b }], memberId: 'm1', kind: 'refine' })
  fs.writeFileSync(a, '@echo changed-a\n')
  restoreAdaptManifest(backup.manifestPath, { force: true })
  assert.equal(fs.readFileSync(a, 'utf8'), '@echo a\n')
  assert.equal(fs.readFileSync(b, 'utf8'), '@echo b\n')
})
