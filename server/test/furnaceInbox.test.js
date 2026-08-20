import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-furnace-inbox-'))
process.env.ACW_DATA_ROOT = dataRoot

const { buildFurnacePtyAttachText } = await import('@acw/shared')
const {
  safeUploadBasename,
  safeSessionFolder,
  writeFurnaceInboxFile,
  furnaceInboxDir,
} = await import('../src/uploads.js')

test('safe names strip traversal', () => {
  assert.equal(safeUploadBasename('../etc/passwd'), '__etc_passwd')
  assert.equal(safeSessionFolder('../x'), '__x')
  assert.equal(safeSessionFolder('sess_ok-1'), 'sess_ok-1')
})

test('inbox file lands under data/furnace/inbox and relPath is cwd-relative', () => {
  const meta = writeFurnaceInboxFile('s1', 'shot.png', Buffer.from('hello'), 'image/png')
  assert.equal(meta.name, 'shot.png')
  assert.ok(meta.relPath.startsWith('inbox/s1/'))
  assert.ok(meta.relPath.endsWith('_shot.png'))
  assert.ok(fs.existsSync(meta.absPath))
  assert.ok(meta.absPath.startsWith(furnaceInboxDir('s1')))
})

test('pty attach text lists relative paths', () => {
  const text = buildFurnacePtyAttachText('看图', [{ relPath: 'inbox/s1/a.png' }])
  assert.match(text, /^看图\n/)
  assert.match(text, /inbox\/s1\/a\.png/)
  assert.equal(buildFurnacePtyAttachText('  ', []), '')
})
