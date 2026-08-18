import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-adapt-'))
process.env.ACW_DATA_ROOT = dataRoot

const {
  collectAdaptSourcePaths,
  assessAdaptFiles,
  applyAdaptComment,
  prepareAdaptForMember,
  createAdaptBackup,
  ADAPT_MARK,
} = await import('../src/adaptBackup.js')
const { MEMBER_KIND } = await import('@acw/shared')

test('echo member has no source and falls back to step mark', () => {
  const prep = prepareAdaptForMember({
    id: 'mem_echo',
    kind: MEMBER_KIND.ECHO,
    config: { adapt: true, defaultText: 'ok' },
  })
  assert.equal(prep.fallback, true)
  assert.equal(prep.reason, 'no_source')
  assert.equal(prep.backup, null)
})

test('writable text script is zipped then comment-patched once', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-src-'))
  const file = path.join(dir, 'tool.mjs')
  fs.writeFileSync(file, 'export const n = 1\n', 'utf8')
  const member = {
    id: 'mem_script',
    kind: MEMBER_KIND.SCRIPT,
    config: {
      adapt: true,
      script: {
        mode: 'file',
        filePath: file,
        scriptWorkDir: dir,
        executionMode: 'terminal',
      },
    },
  }
  const prep = prepareAdaptForMember(member, { sessionId: 's1', nodeId: 'n1' })
  assert.equal(prep.fallback, false)
  assert.ok(prep.backup?.zipPath)
  assert.equal(fs.existsSync(prep.backup.zipPath), true)
  const zip = fs.readFileSync(prep.backup.zipPath)
  assert.equal(zip[0], 0x50)
  assert.equal(zip[1], 0x4b)
  const text = fs.readFileSync(file, 'utf8')
  assert.ok(text.includes(ADAPT_MARK))
  const again = applyAdaptComment(file)
  assert.equal(again.patched, false)
  assert.equal(again.reason, 'already')
})

test(
  'read-only file is not patched',
  { skip: typeof process.getuid === 'function' && process.getuid() === 0 ? 'root 下 444 仍可写' : false },
  () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-ro-'))
  const file = path.join(dir, 'lock.mjs')
  fs.writeFileSync(file, 'export const n = 1\n', 'utf8')
  fs.chmodSync(file, 0o444)
  const assessed = assessAdaptFiles([file])
  assert.equal(assessed.ok, false)
  assert.equal(assessed.reason, 'read_only')
  const original = fs.readFileSync(file, 'utf8')
  fs.chmodSync(file, 0o644)
  assert.equal(original.includes(ADAPT_MARK), false)
})

test('createAdaptBackup writes zip beside manifest under data/backups/adapt', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-bk-'))
  const file = path.join(dir, 'a.js')
  fs.writeFileSync(file, 'console.log(1)\n')
  const r = createAdaptBackup({ files: [{ path: file }], memberId: 'mem_x' })
  assert.ok(r.zipPath.includes(`${path.sep}backups${path.sep}adapt${path.sep}`))
  assert.equal(fs.existsSync(r.manifestPath), true)
  const man = JSON.parse(fs.readFileSync(r.manifestPath, 'utf8'))
  assert.equal(man.files[0].original, file)
})

test('collectAdaptSourcePaths resolves relative file against scriptWorkDir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-rel-'))
  fs.writeFileSync(path.join(dir, 'run.py'), 'print(1)\n')
  const paths = collectAdaptSourcePaths({
    config: { script: { filePath: 'run.py', scriptWorkDir: dir } },
  })
  assert.equal(paths[0], path.join(dir, 'run.py'))
})
