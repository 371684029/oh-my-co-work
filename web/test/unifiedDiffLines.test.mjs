import assert from 'node:assert/strict'
import test from 'node:test'
import { parseUnifiedDiff } from '../src/composables/unifiedDiffLines.js'

test('parseUnifiedDiff：红绿行与行号', () => {
  const text = `--- a/file.mjs
+++ b/file.mjs
@@ -1,3 +1,4 @@
 const x = 1
-const old = 2
+const neu = 2
+const extra = 3
`
  const rows = parseUnifiedDiff(text)
  assert.ok(rows.some((r) => r.kind === 'del' && r.text.includes('old')))
  assert.ok(rows.some((r) => r.kind === 'add' && r.text.includes('neu')))
  const del = rows.find((r) => r.kind === 'del')
  assert.equal(typeof del.oldNo, 'number')
  const add = rows.find((r) => r.kind === 'add' && r.text.includes('neu'))
  assert.equal(typeof add.newNo, 'number')
})