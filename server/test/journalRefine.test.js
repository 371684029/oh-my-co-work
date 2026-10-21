import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-journal-refine-'))
process.env.ACW_DATA_ROOT = dataRoot

const { writeNodeJournal } = await import('../src/journal.js')

test('writeNodeJournal embeds refine provenance when member refined', () => {
  const rel = writeNodeJournal({
    sessionId: 'ses_j1',
    sessionTitle: '测试会话',
    node: {
      id: 'node_1',
      step_index: 0,
      step_id: 's0',
      title: '跑脚本',
      step_type: 'member',
      status: 'done',
      started_at: '2026-01-01T00:00:00.000Z',
      finished_at: '2026-01-01T00:01:00.000Z',
    },
    input: { refine: { source: 'spec', refined: true }, refineFormatted: '## 产出\n\n正文' },
    output: { ok: true },
    memberName: '台账员',
    member: {
      id: 'mem_j1',
      display_name: '台账员',
      config: {
        refine: {
          enabled: true,
          format: { title: '台账员 产出台账' },
          refinedAt: '2026-01-01T00:00:00.000Z',
          refineBackup: '/tmp/backup.zip',
          refineBackupManifest: '/tmp/backup.json',
        },
      },
    },
  })
  const abs = path.join(dataRoot, rel)
  const text = fs.readFileSync(abs, 'utf8')
  assert.match(text, /refine_source: "spec"/)
  assert.match(text, /refine_backup:/)
  assert.match(text, /炼化追溯/)
  assert.match(text, /还原到炼化前/)
})
