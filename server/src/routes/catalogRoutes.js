import { Router } from 'express'
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
} from '../services.js'
import { restoreMemberRefine } from '../refineRestore.js'
import { exportMemberTemplate, exportGroupTemplate, importTemplatePack } from '../templatePack.js'
import { planRefineOnMemberSave } from '../refineSource.js'

const router = Router()

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

export default router
