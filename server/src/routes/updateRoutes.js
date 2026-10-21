import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { DATA_ROOT } from '../db.js'
import * as updateCheck from '../updateCheck.js'
import {
  createBackup,
  restoreBackup,
  listBackups,
  isGzipFile,
} from '../backup.js'

const router = Router()

router.get('/update/check', async (req, res) => {
  try {
    res.json(await updateCheck.checkForUpdates())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/update/backups', (req, res) => {
  try {
    res.json({ backups: listBackups() })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/update/backup', (req, res) => {
  try {
    res.json(createBackup())
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

const MAX_IMPORT_BYTES = 2 * 1024 * 1024 * 1024
let importInFlight = false

router.post('/backup/import', (req, res) => {
  if (importInFlight) {
    return res.status(409).json({ error: '已有备份导入进行中', code: 'RESTORE_BUSY' })
  }
  const dir = path.resolve(DATA_ROOT, 'backups')
  fs.mkdirSync(dir, { recursive: true })
  const name = `acw-backup-imported-${Date.now()}.tar.gz`
  const target = path.join(dir, name)
  let received = 0
  let settled = false

  const cleanup = () => {
    try {
      if (fs.existsSync(target)) fs.rmSync(target, { force: true })
    } catch {
      /* ignore */
    }
  }
  const fail = (status, body) => {
    if (settled) return
    settled = true
    importInFlight = false
    cleanup()
    if (!res.headersSent) res.status(status).json(body)
  }

  importInFlight = true
  const out = fs.createWriteStream(target)
  out.on('error', () => fail(500, { error: '写入备份文件失败' }))
  req.on('aborted', () => {
    out.destroy()
    fail(400, { error: '上传中断' })
  })
  req.on('error', () => fail(400, { error: '上传失败' }))
  req.on('data', (chunk) => {
    received += chunk.length
    if (received > MAX_IMPORT_BYTES) {
      req.unpipe(out)
      out.destroy()
      fail(413, { error: '备份包过大（上限 2GB）' })
    }
  })
  out.on('finish', () => {
    if (settled) return
    if (!isGzipFile(target)) {
      fail(400, { error: '请选择 .tar.gz 备份包' })
      return
    }
    try {
      const result = restoreBackup(name)
      settled = true
      importInFlight = false
      if (!res.headersSent) res.json(result)
    } catch (e) {
      settled = true
      importInFlight = false
      if (e.code !== 'RESTORE_BUSY') cleanup()
      if (!res.headersSent) {
        res.status(e.code === 'RESTORE_BUSY' ? 409 : 400).json({ error: e.message, code: e.code })
      }
    }
  })
  req.pipe(out)
})

router.post('/update/restore', (req, res) => {
  try {
    res.json(restoreBackup(String(req.body?.filename || '')))
  } catch (e) {
    const status = e.code === 'RESTORE_BUSY' ? 409 : 400
    res.status(status).json({
      error: e.message,
      code: e.code,
      rollbackError: e.rollbackError?.message || undefined,
      dbReopenFailed: e.dbReopenFailed || undefined,
    })
  }
})

export default router
