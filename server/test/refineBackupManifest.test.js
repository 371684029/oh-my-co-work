import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-refine-manifest-'))
process.env.ACW_DATA_ROOT = dataRoot

const {
  createAdaptBackup,
  stampManifestAfterPatch,
  checkRestoreConflicts,
  restoreAdaptManifest,
  pruneMemberBackups,
  readScriptSource,
  writeScriptSource,
  sha256File,
} = await import('../src/adaptBackup.js')
const { applyRefineOnMemberSave } = await import('../src/refineSource.js')
const { initDb } = await import('../src/db.js')
const { createMember, updateMember, getMember } = await import('../src/services.js')
const { MEMBER_KIND } = await import('@acw/shared')

initDb()

test('createAdaptBackup records sha256 in manifest', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-sha-'))
  const file = path.join(dir, 'a.bat')
  fs.writeFileSync(file, '@echo off\n')
  const r = createAdaptBackup({ files: [{ path: file }], memberId: 'mem_sha', kind: 'refine' })
  const man = JSON.parse(fs.readFileSync(r.manifestPath, 'utf8'))
  assert.equal(man.files[0].sha256, sha256File(file))
  assert.equal(man.manifestVersion, 2)
})

test('restore conflicts when file edited after refine patch', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-conf-'))
  const file = path.join(dir, 'b.bat')
  fs.writeFileSync(file, '@echo off\n')
  const r = createAdaptBackup({ files: [{ path: file }], memberId: 'mem_c', kind: 'refine' })
  stampManifestAfterPatch(r.manifestPath, [file])
  fs.appendFileSync(file, 'echo changed\n')
  const conflicts = checkRestoreConflicts(r.manifestPath)
  assert.equal(conflicts.length, 1)
  assert.throws(() => restoreAdaptManifest(r.manifestPath), (e) => e.code === 'RESTORE_CONFLICT')
  restoreAdaptManifest(r.manifestPath, { force: true })
  assert.match(fs.readFileSync(file, 'utf8'), /@echo off/)
})

test('readScriptSource preserves BOM on write', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-bom-'))
  const file = path.join(dir, 'c.ps1')
  const raw = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('Write-Output 1\r\n')])
  fs.writeFileSync(file, raw)
  const src = readScriptSource(fs.readFileSync(file))
  assert.equal(src.ok, true)
  assert.equal(src.hasBom, true)
  writeScriptSource(file, `${src.text}// added`, { hasBom: true })
  const again = fs.readFileSync(file)
  assert.equal(again[0], 0xef)
})

test('applyRefineOnMemberSave stamps manifest after patch', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-ref-save-'))
  const bat = path.join(dir, 'run.bat')
  fs.writeFileSync(bat, '@echo off\necho hi\n', 'utf8')
  const member = createMember({
    name: `ref_${Date.now()}`,
    displayName: '炼化测',
    kind: MEMBER_KIND.SCRIPT,
    config: {
      refine: { enabled: true },
      script: { filePath: bat, scriptWorkDir: dir, mode: 'file' },
    },
  })
  const { nextConfig } = applyRefineOnMemberSave(member)
  updateMember(member.id, { config: nextConfig })
  const saved = getMember(member.id)
  const manifestPath = saved.config.refine.refineBackupManifest
  assert.ok(manifestPath)
  const man = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  assert.ok(man.files[0].sha256AfterPatch)
})

test('pruneMemberBackups keeps newest pairs only', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-prune-'))
  const file = path.join(dir, 'x.js')
  fs.writeFileSync(file, '1\n')
  for (let i = 0; i < 7; i++) {
    createAdaptBackup({ files: [{ path: file }], memberId: 'mem_prune', kind: 'refine' })
  }
  const folder = path.join(dataRoot, 'backups', 'refine', 'mem_prune')
  const jsonCount = fs.readdirSync(folder).filter((f) => f.endsWith('.json')).length
  assert.ok(jsonCount <= 5)
})
