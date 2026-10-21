import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from '../db.js'
import {
  getAppSettings,
  updateAppSettings,
  purgeDemoData,
  resolveGlobalAdminMember,
} from '../appSettings.js'
import { probeGrokStatusAsync, probeCursorStatusAsync, loadGrokExampleConfig } from '../grokStatus.js'
import { prepareFurnaceGrokLaunch } from '../furnaceSituation.js'
import { ensureAdminMember } from '../slashCommands.js'

const router = Router()

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
