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
  listSessions,
  getSessionDetail,
  renameSession,
  pinSession,
  saveSessionNotes,
  deleteSession,
  createSessionFromGroup,
  createSessionFromMember,
  archiveSession,
  unarchiveSession,
  handleGateAction,
  postUserMessage,
  refreshSessionAnnouncement,
  saveSessionAnnouncement,
  restartFromNode,
  searchMessages,
} from './services.js'
import { ROOT, DATA_ROOT, getDb, getDbDriver } from './db.js'
import { runIntegrityCheck } from './backup.js'
import { restoreMemberRefine } from './refineRestore.js'
import {
  previewStepRevert,
  applyStepRevert,
  resolveWorkDirFromNode,
} from './stepRevert.js'
import { buildSessionTimeline, filterTimelineEvents } from './sessionTimeline.js'
import { collectDiagnostics } from './diagnostics.js'
import { collectUsageStats } from './usageStats.js'
import { buildSessionAuditMarkdown } from './auditExport.js'
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
  ensureAdminMember,
} from './slashCommands.js'
import { killSessionProcesses, listSessionProcesses } from './processRegistry.js'
import { listOccupiedResources, releaseResources } from './resources.js'
import { getAppSettings,
  updateAppSettings,
  purgeDemoData,
  resolveGlobalAdminMember,
} from './appSettings.js'
import { probeGrokStatusAsync, probeCursorStatusAsync, loadGrokExampleConfig } from './grokStatus.js'
import { prepareFurnaceGrokLaunch } from './furnaceSituation.js'
import {
  createBackup,
  listBackups,
  BACKUP_DOWNLOAD_RE,
} from './backup.js'
import { readJournalRelative, readSessionAnnouncement } from './journal.js'
import { emitAll } from './bus.js'
import { assertNotifyRateLimit, validateNotifyPayload } from './externalNotify.js'
import {
  uploadMiddleware,
  furnaceUploadMiddleware,
  furnaceFilePublicMeta,
  clearFurnaceInbox,
  filePublicMeta,
  resolveStoredFile,
  MAX_SIZE,
  MAX_FILES,
} from './uploads.js'
import { listRoots, listDir, pathExists, openLocalPath } from './fsBrowser.js'
import {
  forgetSessionTerminals,
  getTerminal,
  killTerminal,
  listSessionTerminals,
  deleteTerminalLog,
  readTerminalLogPath,
  readTerminalLogPreview,
} from './terminal/terminalService.js'
import { closeFurnace, reopenFurnace } from './furnaceLifecycle.js'
import docsRoutes from './routes/docsRoutes.js'
import updateRoutes from './routes/updateRoutes.js'

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
router.post('/backup', (_req, res) => {
  try {
    const result = createBackup({ includeUploads: true })
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

// Sessions
router.get('/sessions', (req, res) => {
  res.json(listSessions({ status: req.query.status }))
})
router.get('/sessions/:id', (req, res) => {
  const d = getSessionDetail(req.params.id)
  if (!d) return res.status(404).json({ error: 'not found' })
  res.json(d)
})
/** 读取节点台账 Markdown（相对 dataRoot） */
router.get('/sessions/:id/nodes/:nodeId/journal', (req, res) => {
  const d = getSessionDetail(req.params.id)
  if (!d) return res.status(404).json({ error: 'not found' })
  const node = d.nodes.find((n) => n.id === req.params.nodeId)
  if (!node) return res.status(404).json({ error: 'node not found' })
  const md = node.journalPath ? readJournalRelative(node.journalPath) : null
  res.json({
    nodeId: node.id,
    journalPath: node.journalPath,
    markdown: md,
    input: node.input,
    output: node.output,
  })
})

router.get('/sessions/:id/nodes/:nodeId/step-revert/preview', (req, res) => {
  const d = getSessionDetail(req.params.id)
  if (!d) return res.status(404).json({ error: 'not found' })
  const node = d.nodes.find((n) => n.id === req.params.nodeId)
  if (!node) return res.status(404).json({ error: 'node not found' })
  const cs = node.output?.changeSnapshot
  const workDir = resolveWorkDirFromNode(node, d.group)
  res.json(previewStepRevert(cs, workDir))
})

router.post('/sessions/:id/nodes/:nodeId/step-revert', (req, res) => {
  try {
    const d = getSessionDetail(req.params.id)
    if (!d) return res.status(404).json({ error: 'not found' })
    const node = d.nodes.find((n) => n.id === req.params.nodeId)
    if (!node) return res.status(404).json({ error: 'node not found' })
    const cs = node.output?.changeSnapshot
    const workDir = resolveWorkDirFromNode(node, d.group)
    const force = !!req.body?.force
    const result = applyStepRevert(cs, workDir, { force })
    res.json(result)
  } catch (e) {
    if (e.code === 'CONFLICT') {
      return res.status(409).json({
        error: e.message,
        code: e.code,
        preview: e.preview,
      })
    }
    if (e.code) return res.status(400).json({ error: e.message, code: e.code })
    res.status(400).json({ error: e.message || String(e) })
  }
})

router.get('/diagnostics', (_req, res) => {
  res.json(collectDiagnostics())
})

router.get('/usage-stats', (_req, res) => {
  res.json(collectUsageStats())
})

router.get('/agent-registry', (_req, res) => {
  res.json({ agents: listAgentDefinitions() })
})
router.get('/agent-registry/parse-profiles', (_req, res) => {
  res.json({ profiles: listParseProfiles() })
})
router.get('/agent-registry/parse-samples', (req, res) => {
  const agentId = req.query.agentId || 'generic-cli'
  res.json({ agentId, samples: listParseSamples(agentId) })
})
router.post('/agent-registry/parse-samples', (req, res) => {
  try {
    const body = req.body || {}
    const entry = recordParseSample(body)
    res.status(201).json(entry)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

router.get('/system/data-dir', (_req, res) => {
  res.json(getDataDirStatus())
})
router.post('/system/migrate-data-dir', (_req, res) => {
  try {
    res.json(migrateLegacyDataToCurrent())
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

router.get('/skills/bundled', (_req, res) => {
  res.json({ skills: listBundledSkills() })
})
router.post('/skills/install', (req, res) => {
  try {
    res.status(201).json(installSkillPack(req.body || {}))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

router.get('/scheduler/tick', (_req, res) => {
  res.json({ started: tickLocalScheduler() })
})

router.get('/mcp/connections', (_req, res) => {
  res.json({ connections: getAppSettings().mcpConnections || [] })
})

router.get('/templates/builtin', (_req, res) => {
  res.json({ templates: listBuiltinTemplates() })
})

router.post('/templates/builtin/:id/apply', (req, res) => {
  try {
    const tpl = BUILTIN_TEMPLATES.find((t) => t.id === req.params.id)
    if (!tpl) return res.status(404).json({ error: '模板不存在' })
    let memberId = String(req.body?.memberId || '').trim()
    if (!memberId) {
      const pick = listMembers().find((m) => m.kind === 'script' && m.enabled) ||
        listMembers().find((m) => m.kind === 'echo' && m.enabled)
      memberId = pick?.id || ''
    }
    if (!memberId) {
      return res.status(400).json({ error: '请先创建至少一个成员，或指定 memberId' })
    }
    const steps = tpl.steps.map((s) => {
      if (s.type !== 'member') return { ...s }
      return { ...s, memberId }
    })
    const row = createGroup({
      title: tpl.title,
      description: tpl.description,
      steps,
      config: { builtinTemplate: tpl.id, demo: false },
    })
    res.status(201).json(row)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

router.get('/sessions/:id/audit-export', (req, res) => {
  const md = buildSessionAuditMarkdown(req.params.id)
  if (!md) return res.status(404).json({ error: 'not found' })
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="audit-${req.params.id}.md"`,
  )
  res.send(md)
})

router.get('/sessions/:id/timeline', (req, res) => {
  const d = getSessionDetail(req.params.id)
  if (!d) return res.status(404).json({ error: 'not found' })
  const terminals = getDb()
    .prepare('SELECT * FROM terminal_sessions WHERE session_id = ? ORDER BY started_at ASC')
    .all(req.params.id)
  const events = buildSessionTimeline({
    nodes: d.nodes,
    messages: d.messages,
    terminals,
  })
  const category = String(req.query.category || 'all')
  res.json({ events: filterTimelineEvents(events, category), total: events.length })
})

router.get('/restore-center', (req, res) => {
  const members = listMembers().map((m) => {
    const cfg = m.config || {}
    const refine = cfg.refine || {}
    return {
      id: m.id,
      name: m.display_name,
      refineBackup: refine.refineBackup || null,
      refineBackupManifest: refine.refineBackupManifest || null,
      refineEnabled: !!refine.enabled,
    }
  })
  const sessions = listSessions({ status: 'active' })
    .slice(0, 30)
    .map((s) => {
      const d = getSessionDetail(s.id)
      const nodes = (d?.nodes || [])
        .filter((n) => n.output?.changeSnapshot?.filesChanged)
        .map((n) => ({
          id: n.id,
          title: n.title,
          stepIndex: n.step_index,
          summary: n.output.changeSnapshot.stat || '',
          filesChanged: n.output.changeSnapshot.filesChanged,
        }))
      return nodes.length
        ? { sessionId: s.id, title: s.title, nodes }
        : null
    })
    .filter(Boolean)
  res.json({ members, sessions })
})
/** 群报告台账（后台 MD；界面：# 参数 + 节点入出 + 备注） */
router.get('/sessions/:id/announcement', (req, res) => {
  const d = getSessionDetail(req.params.id)
  if (!d) return res.status(404).json({ error: 'not found' })
  const ann = readSessionAnnouncement(req.params.id)
  res.json({
    path: ann?.rel || d.announcement?.path || null,
    markdown: ann?.markdown || d.announcement?.markdown || '',
    updatedAt: d.session?.context?.announcementUpdatedAt || null,
    modes: d.session?.context?.announcementModes || null,
    manual: !!d.session?.context?.announcementManual,
  })
})
/** 会话备注（context.notes，与群报告分离，不手改 MD） */
router.put('/sessions/:id/notes', (req, res) => {
  try {
    const id = req.params.id
    if (!getSessionDetail(id)?.session) {
      return res.status(404).json({ error: '会话不存在' })
    }
    res.json(saveSessionNotes(id, req.body?.notes ?? ''))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

/**
 * 人工保存群报告 Markdown（保留 API，界面暂不开放）
 * body: { markdown: string }
 */
router.put('/sessions/:id/announcement', (req, res) => {
  try {
    if (!getSessionDetail(req.params.id)) {
      return res.status(404).json({ error: 'not found' })
    }
    if (req.body?.markdown == null) {
      return res.status(400).json({ error: '缺少 markdown' })
    }
    const r = saveSessionAnnouncement(req.params.id, req.body.markdown)
    res.json({
      ok: true,
      path: r.rel,
      markdown: r.markdown,
      manual: true,
    })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

/**
 * 强制重写群报告台账文件（后台 MD；界面跟 # 参数 / 节点入出走）
 * body: { modes?: ('io'|'concise'|'detail')[] } 默认 io（群报告：#参数 + 节点入出）
 */
router.post('/sessions/:id/announcement/refresh', (req, res) => {
  try {
    if (!getSessionDetail(req.params.id)) {
      return res.status(404).json({ error: 'not found' })
    }
    const modes = Array.isArray(req.body?.modes) ? req.body.modes : undefined
    const r = refreshSessionAnnouncement(req.params.id, { modes, force: true })
    res.json({
      ok: true,
      path: r?.rel || null,
      markdown: r?.markdown || '',
      modes: r?.modes || null,
      manual: false,
    })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

/**
 * 用系统默认程序打开群报告 MD（journals/sessions/{id}/ANNOUNCEMENT.md）
 * 若不存在则先刷新生成再打开。
 */
router.post('/sessions/:id/announcement/open', async (req, res) => {
  try {
    const id = req.params.id
    if (!getSessionDetail(id)) {
      return res.status(404).json({ error: '会话不存在' })
    }
    let ann = readSessionAnnouncement(id)
    if (!ann) {
      refreshSessionAnnouncement(id, { modes: ['io'], force: true })
      ann = readSessionAnnouncement(id)
    }
    if (!ann?.rel) {
      return res.status(404).json({ error: '群报告文件不存在' })
    }
    const abs = path.resolve(DATA_ROOT, ann.rel)
    const root = path.resolve(DATA_ROOT)
    if (!abs.startsWith(root + path.sep) && abs !== root) {
      return res.status(400).json({ error: '非法路径' })
    }
    await openLocalPath(abs)
    res.json({ ok: true, path: ann.rel, absolutePath: abs })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
router.patch('/sessions/:id', (req, res) => {
  try {
    const body = req.body || {}
    if (typeof body.pinned === 'boolean') {
      res.json(pinSession(req.params.id, body.pinned))
      return
    }
    if (body.title) {
      res.json(renameSession(req.params.id, body.title))
      return
    }
    res.status(400).json({ error: 'nothing to update' })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
router.post('/sessions/:id/pin', (req, res) => {
  try {
    const pinned = req.body?.pinned !== false
    res.json(pinSession(req.params.id, pinned))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
router.delete('/sessions/:id', (req, res) => {
  try {
    const result = deleteSession(req.params.id)
    if (!result?.deleted) {
      res.status(404).json({ error: '会话不存在' })
      return
    }
    clearFurnaceInbox(req.params.id)
    forgetSessionTerminals(req.params.id)
    res.status(204).end()
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
router.post('/sessions/:id/archive', (req, res) => {
  archiveSession(req.params.id, req.body?.reason || 'manual')
  clearFurnaceInbox(req.params.id)
  res.json(getSessionDetail(req.params.id)?.session)
})
/** 解档：同一会话继续，不新建群聊 */
router.post('/sessions/:id/unarchive', (req, res) => {
  try {
    unarchiveSession(req.params.id, { reason: req.body?.reason || 'manual' })
    res.json(getSessionDetail(req.params.id)?.session)
  } catch (e) {
    res.status(400).json({ error: e.message, code: e.code })
  }
})
/**
 * 从指定节点继续（归档前/后均可）
 * - 往前跳未完成原轨节点：直达不克隆
 * - 往回/再跑：线性追加克隆
 * body: { nodeInstanceId?: string, stepIndex?: number }
 */
router.post('/sessions/:id/restart-from-node', async (req, res) => {
  try {
    const r = await restartFromNode(req.params.id, {
      nodeInstanceId: req.body?.nodeInstanceId,
      stepIndex: req.body?.stepIndex,
    })
    res.json({
      ...r,
      detail: getSessionDetail(req.params.id),
    })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
/**
 * 释放资源：杀掉本会话（或指定 runId）进程，不改变会话状态
 * body: { runId?: string, includeDetach?: boolean } 默认不杀常驻/detach 进程
 */
router.post('/sessions/:id/kill-processes', (req, res) => {
  try {
    const runId = req.body?.runId
    const includeDetach = req.body?.includeDetach === true
    const before = listSessionProcesses(req.params.id)
    const result = killSessionProcesses(
      req.params.id,
      runId ? { runId, includeDetach } : { includeDetach },
    )
    res.json({
      ok: true,
      ...result,
      before,
      after: listSessionProcesses(req.params.id),
      note: '已请求结束进程；外部窗口若仍在，请手动关闭。',
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
router.get('/sessions/:id/processes', (req, res) => {
  try {
    res.json({ processes: listSessionProcesses(req.params.id) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
router.get('/resources', (_req, res) => {
  try {
    res.json({ items: listOccupiedResources() })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
router.post('/resources/release', (req, res) => {
  try {
    const sessionIds = req.body?.sessionIds ?? req.body?.sessionId
    const ids = Array.isArray(sessionIds)
      ? sessionIds
      : sessionIds
        ? [sessionIds]
        : []
    res.json(releaseResources({ sessionIds: ids }))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
router.get('/sessions/:id/terminals', (req, res) => {
  if (!getSessionDetail(req.params.id)) return res.status(404).json({ error: '会话不存在' })
  res.json({ terminals: listSessionTerminals(req.params.id) })
})
router.post('/sessions/:id/terminals/:terminalId/kill', (req, res) => {
  const terminal = getTerminal(req.params.terminalId)
  if (!terminal || terminal.sessionId !== req.params.id) {
    return res.status(404).json({ error: '终端不存在' })
  }
  res.json({ ok: killTerminal(req.params.terminalId, 'user') })
})
router.post('/sessions/:id/furnace/close', (req, res) => {
  try {
    res.json(closeFurnace(req.params.id))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
router.post('/sessions/:id/furnace/reopen', async (req, res) => {
  try {
    res.json(await reopenFurnace(req.params.id, { agent: req.body?.agent }))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
router.get('/sessions/:id/terminals/:terminalId/log', (req, res) => {
  if (req.query.format === 'json') {
    const preview = readTerminalLogPreview(req.params.id, req.params.terminalId)
    if (!preview) return res.status(404).json({ error: '日志不存在' })
    return res.json(preview)
  }
  const file = readTerminalLogPath(req.params.id, req.params.terminalId)
  if (!file) return res.status(404).json({ error: '日志不存在' })
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${path.basename(file)}"`,
  )
  fs.createReadStream(file).pipe(res)
})
router.delete('/sessions/:id/terminals/:terminalId/log', (req, res) => {
  if (!deleteTerminalLog(req.params.id, req.params.terminalId)) {
    return res.status(404).json({ error: '日志不存在' })
  }
  res.json({ ok: true })
})
router.post('/sessions/:id/messages', async (req, res) => {
  try {
    const text = req.body?.text ?? req.body?.content?.text ?? ''
    const attachments = req.body?.attachments ?? req.body?.content?.attachments ?? []
    const result = await postUserMessage(req.params.id, text, attachments)
    res.json(result)
  } catch (e) {
    const code = e.code === 'ARCHIVED' ? 409 : 400
    res.status(code).json({ error: e.message, code: e.code })
  }
})

/** 4.6 聊天消息模糊搜索（跨会话）。?q=关键词 &sessionId=可选限定某会话。 */
router.get('/messages/search', (req, res) => {
  try {
    const q = String(req.query.q || '')
    const sessionId = req.query.sessionId ? String(req.query.sessionId) : undefined
    res.json(searchMessages(q, { sessionId }))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** 上传附件（支持多文件；前端粘贴/选择后先上传再发消息） */
router.post('/sessions/:id/files', (req, res) => {
  uploadMiddleware(req, res, (err) => {
    if (err) {
      const msg =
        err.code === 'LIMIT_FILE_SIZE'
          ? `单文件不能超过 ${Math.round(MAX_SIZE / 1024 / 1024)}MB`
          : err.code === 'LIMIT_FILE_COUNT'
            ? `一次最多 ${MAX_FILES} 个文件`
            : err.message || '上传失败'
      return res.status(400).json({ error: msg })
    }
    const files = req.files || []
    if (!files.length) return res.status(400).json({ error: '未选择文件' })
    const list = files.map((f) => filePublicMeta(req.params.id, f))
    res.status(201).json({ files: list })
  })
})

/** 熔炉 GUI 附件：落到 data/furnace/inbox/<session>/；响应不含 absPath */
router.post('/sessions/:id/furnace-files', (req, res) => {
  if (!getSessionDetail(req.params.id)) {
    return res.status(404).json({ error: '会话不存在' })
  }
  furnaceUploadMiddleware(req, res, (err) => {
    if (err) {
      const msg =
        err.code === 'LIMIT_FILE_SIZE'
          ? `单文件不能超过 ${Math.round(MAX_SIZE / 1024 / 1024)}MB`
          : err.code === 'LIMIT_FILE_COUNT'
            ? `一次最多 ${MAX_FILES} 个文件`
            : err.message || '上传失败'
      return res.status(400).json({ error: msg })
    }
    const files = req.files || []
    if (!files.length) return res.status(400).json({ error: '未选择文件' })
    const list = files.map((f) => furnaceFilePublicMeta(req.params.id, f))
    res.status(201).json({ files: list })
  })
})

/** 下载/预览会话附件 */
router.get('/files/:sessionId/:name', (req, res) => {
  const full = resolveStoredFile(req.params.sessionId, decodeURIComponent(req.params.name))
  if (!full) return res.status(404).json({ error: 'file not found' })
  res.sendFile(full)
})
router.post('/sessions/:id/gate', async (req, res) => {
  try {
    const gateResult = await handleGateAction(req.params.id, req.body || {})
    const detail = getSessionDetail(req.params.id)
    res.json({ ...(detail || {}), gateResult: gateResult || { ok: true } })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

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

// 应用设置（演示数据开关、全局管理员默认等）
router.get('/settings/app', (_req, res) => {
  const s = getAppSettings()
  res.json({
    ...s,
    resolvedAdmin: resolveGlobalAdminMember(),
  })
})
router.get('/grok/status', async (_req, res) => {
  const command = getAppSettings().grok?.command || 'grok'
  const cursorCommand = getAppSettings().grok?.cursorCommand || 'cursor-agent'
  try {
    res.json({
      ...(await probeGrokStatusAsync({ command })),
      cursor: await probeCursorStatusAsync({ command: cursorCommand }),
      exampleToml: loadGrokExampleConfig(),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
router.post('/furnace/prepare', (req, res) => {
  try {
    if (req.body?.acknowledge) {
      updateAppSettings({ grok: { rulesAcknowledged: true } })
    }
    res.json(prepareFurnaceGrokLaunch({ sessionId: req.body?.sessionId || null }))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
router.patch('/settings/app', (req, res) => {
  try {
    const s = updateAppSettings(req.body || {})
    if (req.body?.grok !== undefined) {
      try {
        ensureAdminMember()
      } catch (e) {
        console.warn('[acw] sync furnace member after grok settings', e?.message || e)
      }
    }
    res.json({
      ...s,
      resolvedAdmin: resolveGlobalAdminMember(),
    })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
router.post('/settings/purge-demo', (_req, res) => {
  try {
    res.json(purgeDemoData())
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// About & updates（完全本地；文案来自 config，版本可回落到 package.json）
router.get('/about', (_req, res) => {
  const aboutPath = path.join(ROOT, 'server/config/about.json')
  const pkgPath = path.join(ROOT, 'package.json')
  let pkgVersion = '0.1.0'
  try {
    pkgVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || pkgVersion
  } catch {
    /* ignore */
  }
  let data = {}
  try {
    data = JSON.parse(fs.readFileSync(aboutPath, 'utf8'))
  } catch {
    data = {}
  }
  res.json({
    productName: data.productName || 'oh-my-co-work',
    tagline: data.tagline || '人机协同 · 万物归元 · 皆可 Workflow',
    livingLine:
      data.livingLine ||
      '节点是死的，人是活的 — 流动的 Workflow，人可绕行、插队、场外办事再回来。',
    version: data.version || pkgVersion,
    updateUrl: data.updateUrl || '',
    updateHint: data.updateHint || '更新包发布后在此填写地址。',
    localNote:
      data.localNote ||
      '本项目完全本地运行，不夹带任何后台服务。',
    extraNotes: Array.isArray(data.extraNotes) ? data.extraNotes : [],
    changelog: Array.isArray(data.changelog) ? data.changelog : [],
  })
})

router.use(docsRoutes)
router.use(updateRoutes)

export default router
