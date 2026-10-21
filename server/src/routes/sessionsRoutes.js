import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import {
  listMembers,
  listSessions,
  getSessionDetail,
  renameSession,
  pinSession,
  saveSessionNotes,
  deleteSession,
  archiveSession,
  unarchiveSession,
  handleGateAction,
  postUserMessage,
  refreshSessionAnnouncement,
  saveSessionAnnouncement,
  restartFromNode,
  searchMessages,
} from '../services.js'
import { DATA_ROOT, getDb } from '../db.js'
import {
  previewStepRevert,
  applyStepRevert,
  resolveWorkDirFromNode,
} from '../stepRevert.js'
import { buildSessionTimeline, filterTimelineEvents } from '../sessionTimeline.js'
import { buildSessionAuditMarkdown } from '../auditExport.js'
import { readJournalRelative, readSessionAnnouncement } from '../journal.js'
import { killSessionProcesses, listSessionProcesses } from '../processRegistry.js'
import { listOccupiedResources, releaseResources } from '../resources.js'
import {
  uploadMiddleware,
  furnaceUploadMiddleware,
  furnaceFilePublicMeta,
  clearFurnaceInbox,
  filePublicMeta,
  resolveStoredFile,
  MAX_SIZE,
  MAX_FILES,
} from '../uploads.js'
import { openLocalPath } from '../fsBrowser.js'
import {
  forgetSessionTerminals,
  getTerminal,
  killTerminal,
  listSessionTerminals,
  runTerminal,
  deleteTerminalLog,
  readTerminalLogPath,
  readTerminalLogPreview,
} from '../terminal/terminalService.js'
import { closeFurnace, reopenFurnace } from '../furnaceLifecycle.js'

const router = Router()

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

/** QA-01: CI browser PTY smoke only (ACW_E2E_SMOKE=1). */
router.post('/sessions/:id/e2e/spawn-terminal', async (req, res) => {
  if (process.env.ACW_E2E_SMOKE !== '1') {
    return res.status(404).json({ error: 'not found' })
  }
  const sessionId = req.params.id
  if (!getSessionDetail(sessionId)) {
    return res.status(404).json({ error: '会话不存在' })
  }
  try {
    const result = await runTerminal({
      launch: {
        cmd: process.env.SHELL || '/bin/sh',
        args: ['-lc', 'printf "ACW_E2E_READY\\n"; exec cat'],
        label: 'sh',
      },
      cwd: DATA_ROOT,
      env: { ...process.env },
      sessionId,
      memberId: `e2e-${sessionId}`,
      label: 'e2e-pty',
      successCodes: [0],
      keepAlive: true,
      cols: 80,
      rows: 24,
    })
    if (!result.ok) {
      return res.status(500).json(result)
    }
    const terminal = listSessionTerminals(sessionId).slice(-1)[0]
    res.json({ ok: true, terminalId: terminal?.id || null, result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
