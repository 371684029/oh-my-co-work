import assert from 'node:assert/strict'
import test from 'node:test'
import { ensureRefineArgvSyncInSource, nodeRefineArgvSyncSnippet } from '../src/refineArgvSync.js'

test('nodeRefineArgvSyncSnippet 含幂等标记', () => {
  assert.match(nodeRefineArgvSyncSnippet(), /acwSyncArgvFromEnv/)
  assert.match(nodeRefineArgvSyncSnippet(), /ACW_PARAMS_JSON/)
})

test('ensureRefineArgvSyncInSource 插入到炼化块后', () => {
  const src = [
    '#!/usr/bin/env node',
    '// ACW-REFINE: 契约',
    "if (!process.env.ACW_HUMAN_INPUT) process.env.ACW_HUMAN_INPUT = ''",
    'console.log("### title\\n")',
    "const x = process.argv[4]",
  ].join('\n')
  const r = ensureRefineArgvSyncInSource(src, '/tmp/index.mjs')
  assert.equal(r.ok, true)
  assert.match(r.next, /acwSyncArgvFromEnv/)
  assert.ok(r.next.indexOf('acwSyncArgvFromEnv') < r.next.indexOf('process.argv[4]'))
})
