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
  furnaceInboxAllowed,
  furnaceFilePublicMeta,
  clearFurnaceInbox,
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

test('public meta omits absPath', () => {
  const meta = writeFurnaceInboxFile('s1', 'note.txt', Buffer.from('hi'), 'text/plain')
  const pub = furnaceFilePublicMeta('s1', {
    originalname: meta.name,
    filename: meta.storedName,
    size: meta.size,
    mimetype: meta.mime,
  })
  assert.equal(pub.relPath, meta.relPath)
  assert.equal(pub.absPath, undefined)
})

test('blocks executables and allows images', () => {
  assert.equal(furnaceInboxAllowed({ originalname: 'a.exe', mimetype: 'application/octet-stream' }), false)
  assert.equal(furnaceInboxAllowed({ originalname: 'shot.png', mimetype: 'image/png' }), true)
  assert.throws(
    () => writeFurnaceInboxFile('s1', 'run.bat', Buffer.from('echo'), 'application/octet-stream'),
    /仅支持/,
  )
})

test('pty attach text is one line with relative paths', () => {
  const text = buildFurnacePtyAttachText('看图', [{ relPath: 'inbox/s1/a.png' }])
  assert.equal(text, '看图 请阅读工作目录文件 inbox/s1/a.png')
  assert.equal(text.includes('\n'), false)
  assert.equal(
    buildFurnacePtyAttachText('', [{ relPath: 'inbox/s1/a.png' }, { relPath: 'inbox/s1/b.md' }]),
    '请阅读工作目录文件 inbox/s1/a.png inbox/s1/b.md',
  )
  assert.equal(buildFurnacePtyAttachText('  ', []), '')
})

test('clearFurnaceInbox removes session files', () => {
  const meta = writeFurnaceInboxFile('s-clean', 'a.png', Buffer.from('x'), 'image/png')
  assert.ok(fs.existsSync(meta.absPath))
  const { removed } = clearFurnaceInbox('s-clean')
  assert.ok(removed >= 1)
  assert.equal(fs.existsSync(meta.absPath), false)
})
