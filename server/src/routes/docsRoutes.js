import { Router } from 'express'
import fs from 'node:fs'
import * as docsHub from '../docsHub.js'
import { appendAgentRefine, buildRefineSkillPrompt } from '../agentRefine.js'

const router = Router()

router.get('/docs/list', (req, res) => {
  try {
    res.json(docsHub.listDocs({ sort: req.query.sort === 'time' ? 'time' : 'group' }))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/docs/sessions/:sessionId', (req, res) => {
  try {
    const summary = docsHub.getSessionDocsSummary(req.params.sessionId)
    if (!summary) return res.status(404).json({ error: '该会话暂无文档' })
    res.json(summary)
  } catch (e) {
    const code = e.code === 'BAD_SESSION' || e.code === 'NO_SESSION' ? 404 : 400
    res.status(code).json({ error: e.message })
  }
})

router.get('/docs/file', (req, res) => {
  try {
    res.json(
      docsHub.readDoc(String(req.query.sessionId || ''), String(req.query.name || '')),
    )
  } catch (e) {
    const code = e.code === 'NOT_WHITELISTED' || e.code === 'BAD_SESSION' ? 400 : 404
    res.status(code).json({ error: e.message })
  }
})

router.get('/docs/asset', (req, res) => {
  try {
    const sessionId = String(req.query.sessionId || '')
    const href = String(req.query.href || '')
    const doc = String(req.query.doc || '')
    const out = docsHub.openSessionAsset(sessionId, href, doc)
    res.setHeader('Content-Type', out.mime)
    res.setHeader('Cache-Control', 'private, max-age=120')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    fs.createReadStream(out.abs).pipe(res)
  } catch (e) {
    const code = e.code === 'BAD_SESSION' || e.code === 'BAD_ASSET' ? 400 : 404
    res.status(code).json({ error: e.message })
  }
})

router.post('/docs/announcement', (req, res) => {
  try {
    const { sessionId, markdown } = req.body || {}
    res.json(docsHub.saveAnnouncement(sessionId, markdown))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

router.get('/docs/refine-prompt', (req, res) => {
  res.json({ prompt: buildRefineSkillPrompt({ sessionId: req.query.sessionId }) })
})

router.post('/docs/refine', (req, res) => {
  try {
    const { sessionId, input, output, conclusion, source, requestId } = req.body || {}
    res.json(appendAgentRefine({ sessionId, input, output, conclusion, source, requestId }))
  } catch (e) {
    const status =
      e.code === 'RATE_LIMIT' ? 429 : e.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400
    res.status(status).json({ error: e.message, code: e.code })
  }
})

router.post('/docs/open-path', (req, res) => {
  try {
    docsHub
      .openDocsPath(req.body?.path)
      .then((r) => res.json(r))
      .catch((e) => res.status(400).json({ error: e.message }))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

router.get('/docs/search', (req, res) => {
  try {
    res.json(docsHub.searchDocs(String(req.query.q || '')))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/docs/export', (req, res) => {
  let tmp = null
  let cleaned = false
  const cleanup = () => {
    if (tmp && !cleaned) {
      cleaned = true
      try {
        fs.rmSync(tmp, { force: true })
      } catch {
        /* ignore */
      }
    }
  }
  try {
    const out = docsHub.exportGroupZip(String(req.query.groupId || ''))
    tmp = out.path
    const downloadName = String(out.filename || `${out.slug || 'docs'}.zip`).replace(/["\r\n\\]/g, '')
    res.setHeader('Content-Type', 'application/zip')
    res.on('finish', cleanup)
    res.on('close', cleanup)
    res.download(out.path, downloadName, () => {
      cleanup()
    })
  } catch (e) {
    cleanup()
    res.status(400).json({ error: e.message })
  }
})

router.get('/docs/export-all', (_req, res) => {
  let tmp = null
  let cleaned = false
  const cleanup = () => {
    if (tmp && !cleaned) {
      cleaned = true
      try {
        fs.rmSync(tmp, { force: true })
      } catch {
        /* ignore */
      }
    }
  }
  try {
    const out = docsHub.exportAllDocsZip()
    tmp = out.path
    const downloadName = String(out.filename || 'oh-my-co-work-all-docs.zip').replace(/["\r\n\\]/g, '')
    res.setHeader('Content-Type', 'application/zip')
    res.on('finish', cleanup)
    res.on('close', cleanup)
    res.download(out.path, downloadName, () => {
      cleanup()
    })
  } catch (e) {
    cleanup()
    res.status(400).json({ error: e.message })
  }
})

export default router
