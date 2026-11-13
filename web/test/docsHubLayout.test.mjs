import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('DocsHub 为双栏：资源管理器 + 正文', () => {
  const hub = fs.readFileSync(path.join(root, 'src/views/docs/DocsHub.vue'), 'utf8')
  assert.match(hub, /DocsHubSidebar/)
  assert.match(hub, /DocsHubContentColumn/)
  assert.doesNotMatch(hub, /DocsHubGroupsColumn/)
  assert.doesNotMatch(hub, /DocsHubSessionsColumn/)
})

test('资源管理器采用等高树形行', () => {
  const sidebar = fs.readFileSync(path.join(root, 'src/views/docs/DocsHubSidebar.vue'), 'utf8')
  assert.match(sidebar, /dh-tree-row/)
  assert.match(sidebar, /min-height:\s*26px/)
  assert.match(sidebar, /height:\s*26px/)
})
