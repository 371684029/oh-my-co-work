import express from 'express'
import cors from 'cors'
import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import { WebSocketServer } from 'ws'
import { initDb, getDb, DATA_ROOT, ROOT } from './db.js'
import routes from './routes.js'
import { subscribe, unsubscribe } from './bus.js'
import { handleTerminalClientMessage } from './terminal/terminalService.js'
import { listMembers, listGroups, createMember, createGroup } from './services.js'
import { MEMBER_KIND } from '@acw/shared'
import { ensureAdminMember } from './slashCommands.js'
import { repairDemoKeepAliveMembers } from './demoRepair.js'
import { processDueArchives, markInterruptedOnBoot } from './engine.js'
import { updateAppSettings } from './appSettings.js'
import {
  startLifecycleWatch,
  setExitHandler,
  getLifecycleStatus,
} from './lifecycle.js'
import { killSessionProcesses } from './processRegistry.js'
import {
  bootstrapLocalAccess,
  hasValidAccessToken,
  isTrustedOrigin,
  rejectUntrustedOrigin,
  requireLocalAccess,
} from './localAccess.js'

const PORT = Number(process.env.ACW_PORT || process.env.ECW_PORT || 3780)

initDb()

// R02：未归档进行中会话 → interrupted，等人选择继续/归档/放弃
try {
  markInterruptedOnBoot()
} catch (e) {
  console.warn('[acw] markInterruptedOnBoot failed', e?.message || e)
}

// 始终确保「统一管理员」Agent 存在（快捷指令首位默认）
ensureAdminMember()

/**
 * 老库修复：早期演示成员留了保活 shell 却没声明 waitForExit:false，节点会一直等到超时。
 * 详见 demoRepair.js（幂等，只动演示成员）。
 */
try {
  const repaired = repairDemoKeepAliveMembers()
  for (const id of repaired) {
    console.log(`[acw] repaired demo member ${id}: waitForExit=false（保活终端不再判超时）`)
  }
} catch (e) {
  console.warn('[acw] repairDemoKeepAliveMembers failed', e?.message || e)
}

// auto seed if empty（除管理员外无其它成员时补演示数据）
const nonAdmin = listMembers({ includeDemo: true }).filter((m) => m.name !== 'unified_admin')
if (nonAdmin.length === 0) {
  console.log('[acw] empty DB, seeding demo…')
  // 首次空库：默认打开演示，避免开箱看不到「演示流」
  try {
    updateAppSettings({ showDemo: true })
  } catch (e) {
    console.warn('[acw] enable showDemo on seed failed', e?.message || e)
  }
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
        scriptWorkDir: process.cwd(),
        scriptDir: process.cwd(),
        // 演示：命令里可用 #1 #2 与 {folder}
        command:
          process.platform === 'win32'
            ? 'echo ECW-OK #1 & cmd'
            : 'echo ECW-OK #1; exec bash',
        // 演示命令末尾留了一个交互式 shell，方便直接在内嵌终端里敲命令。
        // 因此必须声明「不等待退出」，否则节点会一直等到 timeoutMs 被判超时。
        waitForExit: false,
        timeoutMs: 0,
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
app.use(rejectUntrustedOrigin)
app.use(
  cors({
    origin(origin, callback) {
      callback(null, origin && isTrustedOrigin(origin) ? origin : false)
    },
    allowedHeaders: ['Content-Type', 'Authorization', 'X-ACW-Token'],
  }),
)
app.use(express.json({ limit: '2mb' }))
app.get('/api/bootstrap', bootstrapLocalAccess)
app.use('/api', requireLocalAccess)
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
const wss = new WebSocketServer({
  server,
  path: '/ws',
  verifyClient(info, done) {
    const trustedOrigin = isTrustedOrigin(info.origin || info.req.headers.origin)
    const authorized = hasValidAccessToken(info.req)
    done(trustedOrigin && authorized, trustedOrigin ? 401 : 403, 'Local access denied')
  },
})

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`)
  const sessionId = url.searchParams.get('sessionId')
  if (sessionId) subscribe(sessionId, ws)
  ws.on('message', (data) => {
    if (sessionId) handleTerminalClientMessage(ws, sessionId, data)
  })
  ws.on('close', () => unsubscribe(ws))
  ws.send(JSON.stringify({ type: 'hello', payload: { ok: true } }))
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[acw] API  http://127.0.0.1:${PORT}/api/health`)
  if (fs.existsSync(webDist)) {
    console.log(`[acw] Web  http://127.0.0.1:${PORT}/`)
  }
  console.log(`[acw] data ${DATA_ROOT}`)
  console.log(`[acw] groups ${listGroups({ includeDemo: true }).length}, members ${listMembers({ includeDemo: true }).length}`)
  console.log(`[acw] lifecycle ${JSON.stringify(getLifecycleStatus())}`)
  startLifecycleWatch()
})

setExitHandler((reason) => {
  console.log('[acw] shutting down…', reason || '')
  try {
    // 尽力结束仍在跑的会话进程
    const rows = getDb()
      .prepare(`SELECT id FROM sessions WHERE status NOT IN ('archived')`)
      .all()
    for (const r of rows) {
      try {
        killSessionProcesses(r.id)
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  try {
    server.close(() => process.exit(0))
  } catch {
    process.exit(0)
  }
  setTimeout(() => process.exit(0), 1500)
})

// 清掉旧的待确认归档闸门（不再按超时自动归档）
const ARCHIVE_TICK_MS = 60 * 1000
setInterval(() => {
  try {
    const r = processDueArchives()
    if (r.dismissed?.length) {
      console.log(`[acw] dismissed stale archive gates:`, r.dismissed.join(', '))
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
