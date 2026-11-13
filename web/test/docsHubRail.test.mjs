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
const tabsSrc = fs.readFileSync(
  path.join(root, 'src/views/workbench/components/FlowRailTabs.vue'),
  'utf8',
)
const workbenchSrc = fs.readFileSync(
  path.join(root, 'src/views/Workbench.vue'),
  'utf8',
)

test('右侧栏不再嵌入文档中心，仅流程与时间线', () => {
  assert.doesNotMatch(railSrc, /FlowRailDocsPane/)
  assert.doesNotMatch(railSrc, /isDocsHubTab/)
  assert.doesNotMatch(tabsSrc, /flowRailTabDocs/)
  assert.doesNotMatch(tabsSrc, /rightTab = 'docs'/)
})

test('会话顶栏提供文档中心入口', () => {
  assert.match(workbenchSrc, /openSessionDocsHub/)
  assert.match(workbenchSrc, /openDocsHub\(/)
})

test('inferFurnaceAgent 认 furnaceAgent 与 cursor-agent 命令', () => {
  assert.equal(inferFurnaceAgent({ furnaceAgent: 'cursor' }), 'cursor')
  assert.equal(inferFurnaceAgent({ command: 'cursor-agent' }), 'cursor')
  assert.equal(inferFurnaceAgent({ command: 'grok' }), 'grok')
})
