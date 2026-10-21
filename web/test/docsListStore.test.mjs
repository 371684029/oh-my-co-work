import assert from 'node:assert/strict'
import test from 'node:test'

const { patchSessionIntoListData } = await import('../src/views/docs/docsListPatch.js')

test('patchSessionIntoListData updates group session files', () => {
  const data = {
    sort: 'group',
    groups: [
      {
        groupId: 'g1',
        sessions: [{ sessionId: 's1', sessionTitle: 'A', files: [{ name: 'ANNOUNCEMENT.md', mtimeMs: 1 }] }],
      },
    ],
  }
  const summary = {
    sessionId: 's1',
    groupId: 'g1',
    sessionTitle: 'A',
    files: [{ name: 'ANNOUNCEMENT.md', mtimeMs: 99 }, { name: 'README.md', mtimeMs: 2 }],
  }
  const next = patchSessionIntoListData(data, summary)
  const s = next.groups[0].sessions[0]
  assert.equal(s.files.length, 2)
  assert.equal(s.files[0].mtimeMs, 99)
})
