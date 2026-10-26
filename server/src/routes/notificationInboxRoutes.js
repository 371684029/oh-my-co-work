/**
 * Notification inbox HTTP routes (5.4.0 NTF-06): read/write-through for the
 * renderer inbox so notifications survive restarts (not localStorage-only).
 */
import { Router } from 'express'
import {
  upsertInboxItem,
  listInboxItems,
  markInboxRead,
  clearInboxItems,
} from '../notificationInbox.js'

const router = Router()

/** GET /api/notification/inbox?unread=1&limit=200 */
router.get('/notification/inbox', (req, res) => {
  try {
    const unread = String(req.query.unread || '') === '1'
    const limit = Number(req.query.limit) || 200
    res.json({ ok: true, items: listInboxItems({ unread, limit }) })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

/** POST /api/notification/inbox — write-through one record (upsert by id). */
router.post('/notification/inbox', (req, res) => {
  try {
    const item = upsertInboxItem(req.body || {})
    res.status(201).json({ ok: true, item })
  } catch (e) {
    res.status(e.code === 'BAD_ITEM' ? 400 : 500).json({ ok: false, error: e.message, code: e.code })
  }
})

/** POST /api/notification/inbox/read { ids: [...] } | { all: true } */
router.post('/notification/inbox/read', (req, res) => {
  try {
    const changed = markInboxRead(req.body || {})
    res.json({ ok: true, changed })
  } catch (e) {
    res.status(e.code === 'BAD_IDS' ? 400 : 500).json({ ok: false, error: e.message, code: e.code })
  }
})

/** POST /api/notification/inbox/clear */
router.post('/notification/inbox/clear', (_req, res) => {
  try {
    const changed = clearInboxItems()
    res.json({ ok: true, changed })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

export default router
