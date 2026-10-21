/**
 * Archive furnace PTY replay into session journals (5.2.0 FUR-05).
 */
import fs from 'node:fs'
import path from 'node:path'
import { DATA_ROOT } from './db.js'
import { invalidateDocsCache } from './docsHub.js'
import { emitSession } from './bus.js'
import { getTerminal } from './terminal/terminalService.js'
import { estimateFurnaceContext, furnaceGuiTranscript, normalizeFurnaceAgent } from '@acw/shared'

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function isoFileStamp(iso) {
  return String(iso || new Date().toISOString())
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19)
}

/**
 * @returns {{ rel: string, name: string, markdown: string, estimate: object } | null}
 */
export function archiveFurnaceReplay(
  sessionId,
  { replay, terminalId = 'archived', agent = 'grok', cols, rows, label, replayTruncated = false } = {},
) {
  if (!sessionId) return null
  const rawReplay = String(replay || '')
  if (!rawReplay.trim()) return null

  const furnaceAgent = normalizeFurnaceAgent(agent)
  const profile = furnaceAgent === 'cursor' ? 'cursor' : 'grok'
  const estimate = estimateFurnaceContext(rawReplay, { cols, rows, profile })
  const transcript = furnaceGuiTranscript(rawReplay, { cols, rows, profile })
  const at = new Date().toISOString()
  const name = `furnace/archive-${isoFileStamp(at)}.md`
  const dir = path.join(DATA_ROOT, 'journals', 'sessions', sessionId, 'furnace')
  ensureDir(dir)
  const abs = path.join(dir, path.basename(name))
  const rel = path.join('journals', 'sessions', sessionId, name).replace(/\\/g, '/')

  const header = [
    '---',
    `acwKind: furnace-archive`,
    `archivedAt: ${at}`,
    `furnaceAgent: ${furnaceAgent}`,
    `terminalId: ${terminalId}`,
    `chars: ${estimate.chars}`,
    `tokensApprox: ${estimate.tokensApprox}`,
    `replayTruncated: ${!!replayTruncated}`,
    '---',
    '',
    `# 熔炉对话归档`,
    '',
    `- Agent：${furnaceAgent === 'cursor' ? 'Cursor CLI' : 'Grok'}`,
    `- 终端：${label || terminalId}`,
    `- 估算上下文：约 ${estimate.tokensApprox} token（${estimate.chars} 字符）`,
    replayTruncated ? '- 注意：终端回放已被截断，归档可能不完整。' : '',
    '',
    '## 对话正文',
    '',
    '```text',
    (transcript || '(空)').replace(/```/g, '``\u200b`'),
    '```',
    '',
  ]
    .filter(Boolean)
    .join('\n')

  fs.writeFileSync(abs, header.replace(/\r\n/g, '\n'), 'utf8')
  invalidateDocsCache()
  emitSession(sessionId, {
    type: 'announcement.updated',
    payload: { sessionId, path: rel, kind: 'furnace-archive' },
  })
  return { rel, name, markdown: header, estimate }
}

export function archiveFurnaceTranscript(sessionId, { terminalId, agent } = {}) {
  if (!sessionId || !terminalId) return null
  const entry = getTerminal(terminalId)
  if (!entry || entry.sessionId !== sessionId) return null
  return archiveFurnaceReplay(sessionId, {
    replay: entry.replay,
    terminalId,
    agent: agent || entry.furnaceAgent,
    cols: entry.cols,
    rows: entry.rows,
    label: entry.label,
    replayTruncated: entry.replayTruncated,
  })
}
