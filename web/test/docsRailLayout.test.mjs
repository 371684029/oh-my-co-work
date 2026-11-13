import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workbenchSrc = fs.readFileSync(path.join(root, 'src/views/Workbench.vue'), 'utf8')

test('会话顶栏提供文档中心入口且单行紧凑', () => {
  assert.match(workbenchSrc, /openSessionDocsHub/)
  assert.match(workbenchSrc, /header-action-compact/)
  assert.match(workbenchSrc, /workbenchOpenDocsLabel/)
  assert.doesNotMatch(workbenchSrc, /focusSessionDocsRail/)
})
