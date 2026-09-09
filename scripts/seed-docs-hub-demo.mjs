/**
 * 为 README 截图准备一份可看的文档中心数据（演示流会话 + 群报告/台账）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)

const { initDb, DATA_ROOT, getDb } = await import('../server/src/db.js')
const { listGroups, createSessionFromGroup, listSessions } = await import('../server/src/services.js')

initDb()

const groups = listGroups()
const demo = groups.find((g) => g.title === '演示流') || groups[0]
if (!demo) {
  console.error('没有群模板，请先 npm run seed')
  process.exit(1)
}

let session = listSessions({}).find((s) => s.group_id === demo.id)
if (!session) {
  session = createSessionFromGroup(demo.id)
}

const dir = path.join(DATA_ROOT, 'journals', 'sessions', session.id)
const nodes = path.join(dir, 'nodes')
fs.mkdirSync(nodes, { recursive: true })

const announcement = `# 演示流 · 群报告

> 自动汇总会话参数与节点入出，可在文档中心直接编辑。

## 项目参数

- **#1** 前端验收页改版
- **#2** \`/workspace/demo-app\`

## 节点产出

### 1. 输入项目信息

- 目标：把验收清单收进同一条群聊 Workflow

### 2. 示例回声

### 回声产出台账

hello from echo

### 3. 跑一段命令

\`\`\`
ECW-OK #1
\`\`\`

本地路径：\`/workspace/demo-app/out\`
互链：[节点台账](./step-01-echo.md)
外链：[项目仓库](https://github.com/371684029/oh-my-co-work)
`

fs.writeFileSync(path.join(dir, 'ANNOUNCEMENT.md'), announcement)
fs.writeFileSync(
  path.join(dir, 'README.md'),
  `# 会话文档索引

- [群报告](./ANNOUNCEMENT.md)
- [节点台账](./nodes/step-01-echo.md)
`,
)
fs.writeFileSync(
  path.join(nodes, 'step-01-echo.md'),
  `---
session_id: "${session.id}"
title: "示例回声"
status: "succeeded"
---

# 2. 示例回声

## 输入

目标：前端验收页改版

## 输出

### 回声产出台账

hello from echo
`,
)

getDb()
  .prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?')
  .run('前端验收页改版 · 演示', new Date().toISOString(), session.id)

console.log(JSON.stringify({ sessionId: session.id, title: '前端验收页改版 · 演示', dir }, null, 2))
