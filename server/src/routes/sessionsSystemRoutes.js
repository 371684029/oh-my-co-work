import { Router } from 'express'
import { listMembers, createGroup } from '../services.js'
import { listAgentDefinitions } from '../agentRegistry.js'
import { BUILTIN_TEMPLATES, listBuiltinTemplates } from '../builtinTemplates.js'
import { collectDiagnostics } from '../diagnostics.js'
import {
  getDataDirStatus,
  migrateLegacyDataToCurrent,
} from '../dataDirMigration.js'
import { getAppSettings } from '../appSettings.js'
import {
  listParseProfiles,
  listParseSamples,
  recordParseSample,
} from '../parseProfiles.js'
import { listBundledSkills, installSkillPack } from '../skillPack.js'
import { tickLocalScheduler } from '../localScheduler.js'
import { collectUsageStats } from '../usageStats.js'

const router = Router()

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

export default router
