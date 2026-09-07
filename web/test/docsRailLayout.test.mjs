import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vueSrc = fs.readFileSync(
  path.join(root, 'src/views/workbench/components/FlowRail.vue'),
  'utf8',
)

test('第三栏文档中心工具栏窄宽时换行，标题不竖排', () => {
  assert.match(vueSrc, /\.docs-rail-toolbar \{[^}]*flex-wrap:\s*wrap/)
  assert.match(vueSrc, /\.docs-rail-title \{[^}]*white-space:\s*nowrap/)
  assert.match(vueSrc, /\.docs-rail-title-wrap \{[^}]*min-width:\s*max-content/)
  assert.match(vueSrc, /\.docs-rail-actions \{[^}]*flex-wrap:\s*wrap/)
  assert.doesNotMatch(vueSrc, /\.docs-rail-actions \{[^}]*flex-shrink:\s*0/)
})
