import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
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
  getSessionResources,
} from './services.js'
import { ROOT, DATA_ROOT, getDbDriver } from './db.js'
import { createBackup, runIntegrityCheck } from './backup.js'
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
import { killSessionProcesses, listSessionProcesses } from './processRegistry.js'
import {
  getAppSettings,
  updateAppSettings,
  purgeDemoData,
  resolveGlobalAdminMember,
  resolveGroupAdmin,
} from './appSettings.js'
import { readJournalRelative, readSessionAnnouncement } from './journal.js'
import {
  uploadMiddleware,
  filePublicMeta,
  resolveStoredFile,
  MAX_SIZE,
  MAX_FILES,
} from './uploads.js'
import { listRoots, listDir, pathExists, openLocalPath } from './fsBrowser.js'

const router = Router()

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
router.patch('/members/:id', (req, res) => {
  try {
    res.json(updateMember(req.params.id, req.body || {}))
  } catch (e) {
    res.status(400).json({ error: e.message })
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
  deleteSession(req.params.id)
  res.status(204).end()
})
router.post('/sessions/:id/archive', (req, res) => {
  archiveSession(req.params.id, req.body?.reason || 'manual')
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
 * body: { runId?: string, includeDetach?: boolean }
 */
router.post('/sessions/:id/kill-processes', (req, res) => {
  try {
    const runId = req.body?.runId
    const includeDetach = req.body?.includeDetach !== false
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
/** 会话资源：进程 + 工作目录占用提示 */
router.get('/sessions/:id/resources', (req, res) => {
  try {
    res.json(getSessionResources(req.params.id))
  } catch (e) {
    res.status(404).json({ error: e.message })
  }
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
router.patch('/settings/app', (req, res) => {
  try {
    const s = updateAppSettings(req.body || {})
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

export default router
