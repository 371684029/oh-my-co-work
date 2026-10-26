import assert from 'node:assert/strict'
import test from 'node:test'
import {
  flowRailNodeChangeSummary,
  flowRailNodeChangePatch,
} from '../src/views/workbench/composables/flowRailNodeChange.js'

test('flowRailNodeChangeSummary formats git change snapshots', () => {
  assert.equal(
    flowRailNodeChangeSummary({
      output: { changeSnapshot: { mode: 'git', filesChanged: 2, insertions: 5, deletions: 1 } },
    }),
    '2 个文件 +5 −1',
  )
  assert.equal(flowRailNodeChangeSummary(undefined), '')
  assert.equal(flowRailNodeChangeSummary({ output: {} }), '')
})

test('flowRailNodeChangePatch returns patch and appends truncated suffix', () => {
  assert.equal(flowRailNodeChangePatch({ output: { changeSnapshot: {} } }), '')
  assert.equal(flowRailNodeChangePatch({}), '')
  assert.equal(
    flowRailNodeChangePatch({ output: { changeSnapshot: { patch: '@@ a' } } }),
    '@@ a',
  )
  const truncated = flowRailNodeChangePatch({
    output: { changeSnapshot: { patch: '@@ a', patchTruncated: true } },
  })
  assert.ok(truncated.startsWith('@@ a'))
  assert.ok(truncated.length > '@@ a'.length)
})
