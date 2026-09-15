import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('设置页藏桌宠，抽屉挂到 body，避免挡住炼化/内嵌终端', () => {
  const app = fs.readFileSync(path.join(root, 'src/App.vue'), 'utf8')
  const members = fs.readFileSync(path.join(root, 'src/views/settings/Members.vue'), 'utf8')
  const groups = fs.readFileSync(path.join(root, 'src/views/settings/Groups.vue'), 'utf8')
  assert.match(app, /nav !== 'settings'/)
  assert.match(members, /append-to-body/)
  assert.match(groups, /append-to-body/)
  assert.match(members, /row\.config\?\.refine\?\.enabled/)
  assert.match(members, /ACW 输入环境变量/)
  assert.match(members, /马上改源文件/)
})
