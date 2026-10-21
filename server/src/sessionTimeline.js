/**
 * Session run timeline (5.3.0 TRC-03).
 */
import { nodeStatusLabel } from '@acw/shared'

function msgText(m) {
  const c = m?.content
  if (!c) return ''
  if (typeof c === 'string') return c
  return String(c.text || c.body || c.markdown || '').trim()
}

function gateEventTitle(m) {
  const t = msgText(m)
  if (t) return t.slice(0, 120)
  return m.type === 'gate.request' ? '等待人工确认' : '闸门'
}

export function buildSessionTimeline({ nodes = [], messages = [], terminals = [] } = {}) {
  /** @type {Array<object>} */
  const events = []

  for (const n of nodes) {
    if (n.started_at) {
      events.push({
        id: `node-start-${n.id}`,
        at: n.started_at,
        category: 'node',
        kind: 'node.start',
        title: `步骤 ${Number(n.step_index) + 1} · ${n.title} 开始`,
        nodeId: n.id,
        stepIndex: n.step_index,
      })
    }
    if (n.finished_at) {
      events.push({
        id: `node-end-${n.id}`,
        at: n.finished_at,
        category: 'node',
        kind: 'node.end',
        title: `步骤 ${Number(n.step_index) + 1} · ${n.title} · ${nodeStatusLabel(n.status) || n.status}`,
        nodeId: n.id,
        stepIndex: n.step_index,
        status: n.status,
      })
      const cs = n.output?.changeSnapshot
      if (cs?.filesChanged) {
        events.push({
          id: `node-change-${n.id}`,
          at: n.finished_at,
          category: 'node',
          kind: 'node.change',
          title: `步骤 ${Number(n.step_index) + 1} 文件改动（${cs.filesChanged}）`,
          nodeId: n.id,
          stepIndex: n.step_index,
        })
      }
      if (n.journalPath) {
        events.push({
          id: `node-journal-${n.id}`,
          at: n.finished_at,
          category: 'docs',
          kind: 'docs.journal',
          title: `台账 · ${n.title}`,
          nodeId: n.id,
          journalPath: n.journalPath,
        })
      }
    }
    if (n.step_type === 'offsite' && n.started_at) {
      events.push({
        id: `offsite-${n.id}`,
        at: n.started_at,
        category: 'offsite',
        kind: 'offsite.start',
        title: `临时协助 · ${n.title}`,
        nodeId: n.id,
      })
    }
  }

  for (const m of messages) {
    if (!m.created_at) continue
    if (m.type === 'gate' || m.type === 'gate.request') {
      events.push({
        id: `msg-${m.id}`,
        at: m.created_at,
        category: 'gate',
        kind: m.type,
        title: gateEventTitle(m),
        nodeId: m.node_instance_id || null,
        messageId: m.id,
      })
      continue
    }
    const text = msgText(m)
    if (m.type === 'status' && /文档|台账|报告|ANNOUNCEMENT/i.test(text)) {
      events.push({
        id: `msg-doc-${m.id}`,
        at: m.created_at,
        category: 'docs',
        kind: 'docs.status',
        title: text.slice(0, 120),
        nodeId: m.node_instance_id || null,
        messageId: m.id,
      })
    }
  }

  for (const t of terminals) {
    if (t.started_at) {
      events.push({
        id: `term-start-${t.id}`,
        at: t.started_at,
        category: 'terminal',
        kind: 'terminal.start',
        title: `终端启动 · ${t.command_label || t.id}`,
        terminalId: t.id,
        nodeId: t.node_instance_id || null,
      })
    }
    if (t.finished_at) {
      const failed = t.exit_code != null && Number(t.exit_code) !== 0
      events.push({
        id: `term-end-${t.id}`,
        at: t.finished_at,
        category: 'terminal',
        kind: 'terminal.end',
        title: `终端结束 · ${t.command_label || t.id}${failed ? ` (exit ${t.exit_code})` : ''}`,
        terminalId: t.id,
        nodeId: t.node_instance_id || null,
        exitCode: t.exit_code,
      })
    }
  }

  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  return events
}

export function filterTimelineEvents(events, category = 'all') {
  const cat = String(category || 'all').trim()
  if (cat === 'all') return events
  return events.filter((e) => e.category === cat)
}
