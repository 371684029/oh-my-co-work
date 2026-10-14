import assert from 'node:assert/strict'
import test from 'node:test'

const { pickWindowsMatch, guessKind, resolveCommand, resolveCommandSync, invalidateCommandCache } =
  await import('../src/commandResolver.js')

test('pickWindowsMatch prefers .exe/.com, then .cmd/.bat, and skips extensionless shims', () => {
  const stdout = 'C:\\tools\\grok\r\nC:\\npm\\grok.cmd\r\nC:\\bin\\grok.exe\r\n'
  const picked = pickWindowsMatch(stdout)
  assert.equal(picked.path, 'C:\\bin\\grok.exe')
  assert.equal(picked.kind, 'exe')
})

test('pickWindowsMatch picks .cmd when no exe is present', () => {
  const stdout = 'C:\\tools\\grok\r\nC:\\npm\\grok.cmd\r\nC:\\npm\\grok.ps1\r\n'
  const picked = pickWindowsMatch(stdout)
  assert.equal(picked.path, 'C:\\npm\\grok.cmd')
  assert.equal(picked.kind, 'cmd')
})

test('pickWindowsMatch falls back to the first line when nothing matches PATHEXT', () => {
  const picked = pickWindowsMatch('C:\\weird\\thing\r\nC:\\other\\thing\r\n', '.EXE;.CMD')
  assert.equal(picked.path, 'C:\\weird\\thing')
})

test('pickWindowsMatch handles empty output', () => {
  assert.deepEqual(pickWindowsMatch(''), { path: null, kind: null })
  assert.deepEqual(pickWindowsMatch('  \r\n  '), { path: null, kind: null })
})

test('guessKind maps extensions', () => {
  assert.equal(guessKind('a.exe'), 'exe')
  assert.equal(guessKind('a.CMD'), 'cmd')
  assert.equal(guessKind('a.bat'), 'bat')
  assert.equal(guessKind('a.ps1'), 'ps1')
  assert.equal(guessKind('a'), 'bin')
})

test('resolveCommand short-circuits a literal existing path', async () => {
  const r = await resolveCommand(process.execPath)
  assert.equal(r.source, 'literal')
  assert.equal(r.path, process.execPath)
})

test('resolveCommand returns none for a missing literal path', async () => {
  const r = await resolveCommand('/definitely/not/here/acw-xyz')
  assert.equal(r.source, 'none')
  assert.equal(r.path, null)
})

test('resolveCommand locates a real posix command and caches it', async () => {
  invalidateCommandCache()
  const r = await resolveCommand('sh', { platform: 'linux' })
  assert.equal(r.source, 'path')
  assert.ok(r.path)
  const again = await resolveCommand('sh', { platform: 'linux' })
  assert.deepEqual(again, r)
})

test('resolveCommand returns none for an unknown command', async () => {
  invalidateCommandCache()
  const r = await resolveCommand('definitely-not-a-binary-acw-xyz', { platform: 'linux', timeoutMs: 500 })
  assert.equal(r.source, 'none')
  assert.equal(r.path, null)
})

test('resolveCommandSync mirrors the async shape', () => {
  const r = resolveCommandSync(process.execPath)
  assert.equal(r.source, 'literal')
  const missing = resolveCommandSync('/definitely/not/here/acw-xyz')
  assert.equal(missing.source, 'none')
})

test('invalidateCommandCache is callable', () => {
  assert.equal(invalidateCommandCache(), undefined)
})
