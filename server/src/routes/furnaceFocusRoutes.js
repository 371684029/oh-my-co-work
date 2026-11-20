import { Router } from 'express'
import { applyFurnaceFocus, publicFurnaceFocus } from '../furnaceFocus.js'

const router = Router()

router.get('/furnace/focus', (_req, res) => {
  res.json(publicFurnaceFocus())
})

router.post('/furnace/focus', async (req, res) => {
  try {
    res.json(await applyFurnaceFocus(req.body || {}))
  } catch (e) {
    const status = e.code === 'NOT_FOUND' ? 404 : 400
    res.status(status).json({ ok: false, error: e.message, code: e.code || 'FOCUS' })
  }
})

export default router
