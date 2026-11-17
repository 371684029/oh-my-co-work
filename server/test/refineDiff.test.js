import assert from 'node:assert/strict'
import test from 'node:test'
import { buildUnifiedDiff } from '../src/refineDiff.js'

test('buildUnifiedDiff emits git-style hunk headers', () => {
  const before = 'line1\nline2\nline3\n'
  const after = 'line1\nline2 changed\nline3\n'
  const d = buildUnifiedDiff(before, after, { filePath: '/tmp/tool.mjs' })
  assert.match(d, /^diff --git a\/tool\.mjs b\/tool\.mjs/m)
  assert.match(d, /@@ -\d+,\d+ \+\d+,\d+ @@/)
  assert.match(d, /^-line2$/m)
  assert.match(d, /^\+line2 changed$/m)
})

test('buildUnifiedDiff returns empty when texts match', () => {
  assert.equal(buildUnifiedDiff('a\n', 'a\n'), '')
})