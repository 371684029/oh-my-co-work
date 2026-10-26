import assert from 'node:assert/strict'
import test from 'node:test'
import {
  flowRailNodeDocFile,
  flowRailOpenNodeJournal,
} from '../src/views/workbench/composables/flowRailNodeDoc.js'

test('flowRailNodeDocFile maps journal paths to doc names', () => {
  assert.equal(
    flowRailNodeDocFile({ journalPath: 'journals/sessions/s1/nodes/step-01-build.md' }),
    'nodes/step-01-build.md',
  )
  assert.equal(flowRailNodeDocFile({ journalPath: 'ANNOUNCEMENT.md' }), 'ANNOUNCEMENT.md')
  assert.equal(flowRailNodeDocFile({ journalPath: 'other.txt' }), null)
  assert.equal(flowRailNodeDocFile({}), null)
})

test('flowRailOpenNodeJournal opens resolved file only', () => {
  const opened = []
  flowRailOpenNodeJournal(
    { journalPath: 'journals/sessions/s1/ANNOUNCEMENT.md' },
    { openDocsHub: (opts) => opened.push(opts) },
  )
  assert.deepEqual(opened, [{ file: 'ANNOUNCEMENT.md' }])
  flowRailOpenNodeJournal({}, { openDocsHub: (opts) => opened.push(opts) })
  assert.equal(opened.length, 1)
})
