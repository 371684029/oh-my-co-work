import express from 'express'
import cors from 'cors'
import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import { WebSocketServer } from 'ws'
import { initDb, getDb, DATA_ROOT, ROOT } from './db.js'
import routes from './routes.js'
import { subscribe, unsubscribe } from './bus.js'
import { listMembers, listGroups, createMember, createGroup } from './services.js'
import { MEMBER_KIND } from '@acw/shared'
import { ensureAdminMember } from './slashCommands.js'
import { processDueArchives } from './engine.js'

const PORT = Number(process.env.ACW_PORT || process.env.ECW_PORT || 3780)

initDb()

// 始终确保「统一管理员」Agent 存在（快捷指令首位默认）
ensureAdminMember()

// auto seed if empty（除管理员外无其它成员时补演示数据）
const nonAdmin = listMembers({ includeDemo: true }).filter((m) => m.name !== 'unified_admin')
if (nonAdmin.length === 0) {
  console.log('[acw] empty DB, seeding demo…')
  const echo = createMember({
    name: 'echo',
    displayName: '示例回声',
    kind: MEMBER_KIND.ECHO,
    config: {
      demo: true,
      // 演示：回显 #1（来自首步项目信息）
      defaultText: '收到项目参数 #1',
    },
  })
  const scriptCmd = createMember({
    name: 'script_cmd',
    displayName: '示例命令',
    kind: MEMBER_KIND.SCRIPT,
    workFolder: process.cwd(),
    config: {
      demo: true,
      script: {
        mode: 'command',
        // 演示：命令里可用 #1 #2 与 {folder}
        command:
          process.platform === 'win32'
            ? 'echo ECW-OK #1'
            : 'echo ECW-OK #1',
        timeoutMs: 600_000,
      },
    },
  })
  const groupCount = getDb().prepare('SELECT COUNT(*) AS c FROM groups').get()?.c || 0
  if (groupCount === 0) {
    createGroup({
      title: '演示流',
      description: 'MVP 演示',
      workFolder: process.cwd(),
      steps: [
        { title: '输入项目信息', type: 'human', captureParams: true },
        { title: '示例回声', type: 'member', memberId: echo.id, gate: true },
        { title: '跑一段命令', type: 'member', memberId: scriptCmd.id, gate: true },
      ],
    })
  }
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.use('/api', routes)

// serve web dist if present
const webDist = path.join(ROOT, 'web/dist')
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next()
    res.sendFile(path.join(webDist, 'index.html'))
  })
}

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`)
  const sessionId = url.searchParams.get('sessionId')
  if (sessionId) subscribe(sessionId, ws)
  ws.on('close', () => unsubscribe(ws))
  ws.send(JSON.stringify({ type: 'hello', payload: { ok: true } }))
})

server.listen(PORT, () => {
  console.log(`[acw] API  http://127.0.0.1:${PORT}/api/health`)
  console.log(`[acw] data ${DATA_ROOT}`)
  console.log(`[acw] groups ${listGroups({ includeDemo: true }).length}, members ${listMembers({ includeDemo: true }).length}`)
})

// 超时未确认归档 → 自动归档（默认 24h，设置可改）
const ARCHIVE_TICK_MS = 60 * 1000
setInterval(() => {
  try {
    const r = processDueArchives()
    if (r.archived?.length) {
      console.log(`[acw] auto-archived ${r.archived.length} session(s):`, r.archived.join(', '))
    }
  } catch (e) {
    console.warn('[acw] processDueArchives error', e.message)
  }
}, ARCHIVE_TICK_MS)
setTimeout(() => {
  try {
    processDueArchives()
  } catch {
    /* ignore */
  }
}, 3000)
