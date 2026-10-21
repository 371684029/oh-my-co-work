/**
 * Session audit bundle as Markdown (5.3.0 TRC-06).
 */
import { getSessionDetail } from './services.js'
import { getDb } from './db.js'
import { buildSessionTimeline } from './sessionTimeline.js'
import { formatStepChangeSummary } from '@acw/shared'

export function buildSessionAuditMarkdown(sessionId) {
  const d = getSessionDetail(sessionId)
  if (!d) return null
  const terminals = getDb()
    .prepare('SELECT * FROM terminal_sessions WHERE session_id = ? ORDER BY started_at ASC')
    .all(sessionId)
  const events = buildSessionTimeline({
    nodes: d.nodes,
    messages: d.messages,
    terminals,
  })
  const lines = []
  lines.push(`# 会话审计 · ${d.session.title || sessionId}`)
  lines.push('')
  lines.push(`- 会话 ID: \`${sessionId}\``)
  lines.push(`- 状态: ${d.session.status}`)
  lines.push(`- 导出时间: ${new Date().toISOString()}`)
  lines.push('')
  lines.push('## 时间线')
  lines.push('')
  for (const ev of events) {
    lines.push(`- ${ev.at} · **${ev.category}** · ${ev.title}`)
  }
  lines.push('')
  lines.push('## 步骤快照摘要')
  lines.push('')
  for (const n of d.nodes) {
    const cs = n.output?.changeSnapshot
    const summary = formatStepChangeSummary(cs)
    if (!summary) continue
    lines.push(`- 步骤 ${Number(n.step_index) + 1} ${n.title}: ${summary}`)
  }
  lines.push('')
  lines.push('---')
  lines.push('_本文件由 oh-my-co-work 本地生成，未上传外部服务。_')
  return lines.join('\n')
}
