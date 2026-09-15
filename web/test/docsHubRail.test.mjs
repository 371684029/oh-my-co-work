import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { inferFurnaceAgent } from '../../shared/index.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const railSrc = fs.readFileSync(
  path.join(root, 'src/views/workbench/components/FlowRail.vue'),
  'utf8',
)

test('右侧栏群报告并进文档中心，不再单独占一个 Tab', () => {
  assert.match(railSrc, /isDocsHubTab/)
  assert.match(railSrc, /文档中心/)
  assert.doesNotMatch(railSrc, />\s*群报告\s*<\/button>/)
  assert.doesNotMatch(railSrc, /announce-pane/)
  assert.doesNotMatch(railSrc, /announce-title/)
  assert.match(railSrc, /v-show="isDocsHubTab"/)
  assert.match(railSrc, /white-space:\s*normal/)
  assert.match(railSrc, /writing-mode:\s*horizontal-tb/)
})

test('inferFurnaceAgent 认 furnaceAgent 与 cursor-agent 命令', () => {
  assert.equal(inferFurnaceAgent({ furnaceAgent: 'cursor' }), 'cursor')
  assert.equal(inferFurnaceAgent({ command: 'cursor-agent' }), 'cursor')
  assert.equal(inferFurnaceAgent({ command: 'grok' }), 'grok')
})
