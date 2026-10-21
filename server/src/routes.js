import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  listMembers,
  getMember,
  createMember,
  cloneMember,
  updateMember,
  deleteMember,
  listGroups,
  getGroup,
  createGroup,
  cloneGroup,
  updateGroup,
  deleteGroup,
  createSessionFromGroup,
  createSessionFromMember,
} from './services.js'
import { ROOT, DATA_ROOT, getDbDriver } from './db.js'
import { runIntegrityCheck } from './backup.js'
import { restoreMemberRefine } from './refineRestore.js'
import { collectDiagnostics } from './diagnostics.js'
import { collectUsageStats } from './usageStats.js'
import { listAgentDefinitions } from './agentRegistry.js'
import {
  listParseProfiles,
  listParseSamples,
  recordParseSample,
} from './parseProfiles.js'
import {
  getDataDirStatus,
  migrateLegacyDataToCurrent,
} from './dataDirMigration.js'
import { listBundledSkills, installSkillPack } from './skillPack.js'
import { tickLocalScheduler } from './localScheduler.js'
import { listBuiltinTemplates, BUILTIN_TEMPLATES } from './builtinTemplates.js'
import {
  exportMemberTemplate,
  exportGroupTemplate,
  importTemplatePack,
} from './templatePack.js'
import { planRefineOnMemberSave } from './refineSource.js'
import {
  touchHeartbeat,
  notifyClientGone,
  requestShutdown,
  getLifecycleStatus,
  isAutoExitEnabled,
} from './lifecycle.js'
import {
  listSlashCommands,
  saveSlashCommands,
  runSlashCommand,
} from './slashCommands.js'
import { getAppSettings } from './appSettings.js'
import {
  createBackupAsync,
  listBackups,
  BACKUP_DOWNLOAD_RE,
} from './backup.js'
import { emitAll } from './bus.js'
import { assertNotifyRateLimit, validateNotifyPayload } from './externalNotify.js'
import { listRoots, listDir, pathExists } from './fsBrowser.js'
import docsRoutes from './routes/docsRoutes.js'
import updateRoutes from './routes/updateRoutes.js'
import settingsRoutes from './routes/settingsRoutes.js'
import sessionsRoutes from './routes/sessionsRoutes.js'

const router = Router()

// DESK-02: stable per-process identity so the desktop shell can tell "our"
// server apart from a foreign process that happens to occupy the port.
const INSTANCE_ID = process.env.ACW_INSTANCE_ID || randomUUID()

router.post('/notify', (req, res) => {
  try {
    const payload = validateNotifyPayload(req.body || {})
    assertNotifyRateLimit(payload.source)
    const id = `ext:${payload.source}:${Date.now()}`
    emitAll({
      type: 'external.notify',
      payload: { ...payload, id },
    })
    res.json({ ok: true, id })
  } catch (e) {
    const status = e.code === 'RATE_LIMIT' ? 429 : 400
    res.status(status).json({ error: e.message, code: e.code })
  }
})

router.get('/health', (_req, res) => {
  let version = '0.4.0'
  try {
    const aboutPath = path.join(ROOT, 'server/config/about.json')
    const about = JSON.parse(fs.readFileSync(aboutPath, 'utf8'))
    if (about?.version) version = String(about.version)
  } catch {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
      if (pkg?.version) version = String(pkg.version)
    } catch {
      /* keep default */
    }
  }
  let integrity = { ok: true, detail: 'skipped' }
  try {
    integrity = runIntegrityCheck()
  } catch (e) {
    integrity = { ok: false, detail: e.message }
  }
  res.json({
    ok: true,
    version,
    instanceId: INSTANCE_ID,
    pid: process.pid,
    dataRoot: DATA_ROOT,
    integrity,
    autoExit: isAutoExitEnabled(),
    lifecycle: getLifecycleStatus(),
    sqliteDriver: getDbDriver(),
    time: new Date().toISOString(),
  })
})

/** 浏览器心跳：压缩包/一键启动模式下保持进程存活 */
router.post('/heartbeat', (_req, res) => {
  res.json(touchHeartbeat())
})

/** 浏览器关闭/离开：短宽限后退出（刷新可续命） */
router.post('/client-gone', (_req, res) => {
  res.json(notifyClientGone())
})

/** 显式请求退出服务 */
router.post('/shutdown', (_req, res) => {
  res.json({ ok: true, shuttingDown: true })
  setTimeout(() => requestShutdown('api /shutdown'), 200)
})

router.get('/runtime', (_req, res) => {
  res.json({
    autoExit: isAutoExitEnabled(),
    lifecycle: getLifecycleStatus(),
  })
})

/** M01：一键备份（也可 npm run backup） */
router.post('/backup', async (_req, res) => {
  try {
    const result = await createBackupAsync({ includeUploads: true })
    res.status(201).json(result)
  } catch (e) {
    res.status(400).json({ error: e.message, code: e.code, detail: e.detail })
  }
})

/** 下载已生成的备份压缩包（安全限制在 DATA_ROOT/backups） */
router.get('/backup/download', (req, res) => {
  try {
    const requested = req.query.filename ? String(req.query.filename).trim() : ''
    let filename = ''
    if (requested) {
      filename = path.basename(requested)
    } else {
      const backups = listBackups().filter((b) => b.format !== 'dir' && b.filename.endsWith('.tar.gz'))
      if (!backups.length) {
        return res.status(404).json({ error: '暂无可下载的压缩包备份文件' })
      }
      filename = backups[0].filename
    }
    if (!filename || !BACKUP_DOWNLOAD_RE.test(filename)) {
      return res.status(400).json({ error: '非法备份文件名' })
    }
    const backupDir = path.resolve(DATA_ROOT, 'backups')
    const target = path.resolve(backupDir, filename)
    if (!target.startsWith(backupDir + path.sep)) {
      return res.status(400).json({ error: '非法备份路径' })
    }
    if (!fs.existsSync(target)) {
      return res.status(404).json({ error: '备份文件不存在' })
    }
    const lstat = fs.lstatSync(target)
    if (lstat.isSymbolicLink()) {
      return res.status(400).json({ error: '拒绝下载符号链接' })
    }
    if (!lstat.isFile()) {
      return res.status(400).json({ error: '该备份为目录格式，请使用 tar.gz 压缩包格式进行下载' })
    }
    const contentType = filename.endsWith('.tar.gz') || filename.endsWith('.gz')
      ? 'application/gzip'
      : (filename.endsWith('.zip') ? 'application/zip' : 'application/octet-stream')
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.download(target, filename)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// 本机路径浏览（工作文件夹 / 脚本文件选择）
router.get('/fs/roots', (_req, res) => {
  try {
    res.json({ roots: listRoots() })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
router.get('/fs/list', (req, res) => {
  try {
    const dir = String(req.query.path || '')
    const mode = String(req.query.mode || 'all')
    const extRaw = String(req.query.ext || '')
    const extensions = extRaw
      ? extRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : []
    res.json(listDir(dir, { mode, extensions }))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
router.get('/fs/stat', (req, res) => {
  try {
    res.json(pathExists(String(req.query.path || '')))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// Members
router.get('/members', (_req, res) => res.json(listMembers()))
router.get('/members/:id', (req, res) => {
  const m = getMember(req.params.id)
  if (!m) return res.status(404).json({ error: 'not found' })
  res.json(m)
})
router.post('/members', (req, res) => {
  try {
    res.status(201).json(createMember(req.body || {}))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
router.post('/members/:id/clone', (req, res) => {
  try {
    res.status(201).json(cloneMember(req.params.id, req.body || {}))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
router.get('/members/:id/export-template', (req, res) => {
  try {
    res.json(exportMemberTemplate(req.params.id))
  } catch (e) {
    res.status(e.message === '成员不存在' ? 404 : 400).json({ error: e.message })
  }
})
router.patch('/members/:id', (req, res) => {
  try {
    res.json(updateMember(req.params.id, req.body || {}))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
router.post('/members/refine/plan', (req, res) => {
  try {
    const body = req.body || {}
    let member
    if (body.memberId) {
      const src = getMember(body.memberId)
      if (!src) return res.status(404).json({ error: '成员不存在' })
      member = {
        ...src,
        display_name: body.displayName || body.display_name || src.display_name,
        kind: body.kind || src.kind,
        config: body.config !== undefined ? body.config : src.config,
      }
    } else {
      member = {
        id: 'plan',
        kind: body.kind,
        display_name: body.displayName || body.display_name || '成员',
        config: body.config || {},
      }
    }
    if (!member.config?.refine?.enabled) {
      return res.json({ ok: false, reason: 'refine_disabled', files: [] })
    }
    res.json(planRefineOnMemberSave(member))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
router.post('/members/:id/refine/restore', (req, res) => {
  try {
    const force = !!(req.body && req.body.force)
    res.json(restoreMemberRefine(req.params.id, { force }))
  } catch (e) {
    const status =
      e.code === 'NOT_FOUND'
        ? 404
        : e.code === 'RESTORE_CONFLICT'
          ? 409
          : 400
    res.status(status).json({
      error: e.message,
      code: e.code,
      conflicts: e.conflicts,
    })
  }
})
router.delete('/members/:id', (req, res) => {
  try {
    deleteMember(req.params.id)
    res.status(204).end()
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
router.post('/members/:id/sessions', (req, res) => {
  try {
    const s = createSessionFromMember(req.params.id, req.body || {})
    res.status(201).json(s)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// Groups
router.get('/groups', (_req, res) => res.json(listGroups()))
router.get('/groups/:id', (req, res) => {
  const g = getGroup(req.params.id)
  if (!g) return res.status(404).json({ error: 'not found' })
  res.json(g)
})
router.post('/groups', (req, res) => {
  try {
    res.status(201).json(createGroup(req.body || {}))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
router.post('/groups/:id/clone', (req, res) => {
  try {
    res.status(201).json(cloneGroup(req.params.id, req.body || {}))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
router.get('/groups/:id/export-template', (req, res) => {
  try {
    res.json(exportGroupTemplate(req.params.id))
  } catch (e) {
    res.status(e.message === '群模板不存在' ? 404 : 400).json({ error: e.message })
  }
})
router.post('/templates/import', (req, res) => {
  try {
    const body = req.body || {}
    const onConflict = body.onConflict || 'rename'
    const pack = body.pack ?? body
    const vars = body.vars && typeof body.vars === 'object' ? body.vars : null
    res.status(201).json(importTemplatePack(pack, { onConflict, vars }))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
router.patch('/groups/:id', (req, res) => {
  try {
    res.json(updateGroup(req.params.id, req.body || {}))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
router.delete('/groups/:id', (req, res) => {
  try {
    deleteGroup(req.params.id)
    res.status(204).end()
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
router.post('/groups/:id/sessions', (req, res) => {
  try {
    const s = createSessionFromGroup(req.params.id, req.body || {})
    res.status(201).json(s)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

router.use(sessionsRoutes)

// Support
router.get('/support', (_req, res) => {
  const p = path.join(ROOT, 'server/config/support.json')
  const fallback = path.join(ROOT, 'docs/author-contact.example.json')
  let data = {}
  try {
    data = JSON.parse(fs.readFileSync(fs.existsSync(p) ? p : fallback, 'utf8'))
  } catch {
    data = {
      phone: '17312678391',
      wechat: '17312678391',
      note: '欢迎技术交流与问题反馈。顺手点个赞，比什么都暖。',
      sponsorTitle: '点赞支持',
      sponsorHint: '完全自愿，不影响任何功能。',
      sponsorSubHint: '若你愿意，期待一点点小惊喜 ✨',
      sponsorQrPaths: [],
    }
  }
  res.json(data)
})

// 快捷指令 /slash commands（本机可配，N 条）
router.get('/slash-commands', (_req, res) => {
  res.json({ commands: listSlashCommands() })
})
router.put('/slash-commands', (req, res) => {
  try {
    const commands = req.body?.commands ?? req.body
    res.json({ commands: saveSlashCommands(commands) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
router.post('/slash-commands/:id/run', async (req, res) => {
  try {
    const result = await runSlashCommand(req.params.id, {
      sessionId: req.body?.sessionId,
      url: req.body?.url,
      args: req.body?.args,
    })
    res.json(result)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

router.use(settingsRoutes)
router.use(docsRoutes)
router.use(updateRoutes)

export default router
