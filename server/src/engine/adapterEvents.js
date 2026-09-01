// Trusted JSONL adapter events → chat / gates / node output.
// Failures must not throw into the PTY watcher.
// Imports: store, archive (below advance/gates in the engine DAG).
import { getDb, parseJson } from '../db.js'
import { emitSession } from '../bus.js'
import { SESSION_STATUS, nowIso } from '@acw/shared'
import { appendAdapterReply } from '../terminal/adapters/jsonl.js'
import { getSession, updateSession, addMessage, updateNode, updateMessageContent } from './store.js'
import { refreshSessionAnnouncement } from './archive.js'

export function applyAdapterEvent({
  sessionId,
  nodeInstanceId,
  memberId,
  terminalId,
  replyPath,
  event,
}) {
  if (!sessionId || !event?.type) return
  const session = getSession(sessionId)
  if (!session || session.status === SESSION_STATUS.ARCHIVED) return
  try {
    if (event.type === 'message') {
      addMessage(sessionId, {
        role: event.role === 'user' ? 'user' : 'assistant',
        member_id: memberId || null,
        node_instance_id: nodeInstanceId || null,
        type: 'adapter_message',
        content: { text: event.text, terminalId, adapter: 'jsonl' },
      })
      return
    }
    if (event.type === 'tool.start' || event.type === 'tool.end') {
      const started = event.type === 'tool.start'
      addMessage(sessionId, {
        role: 'assistant',
        member_id: memberId || null,
        node_instance_id: nodeInstanceId || null,
        type: 'adapter_tool',
        content: {
          text: started
            ? `工具 ${event.name}${event.path ? ` · ${event.path}` : ''} 开始`
            : `工具 ${event.id} ${event.ok === false ? '失败' : '结束'}${event.summary ? `：${event.summary}` : ''}`,
          toolId: event.id,
          name: event.name,
          path: event.path,
          ok: event.ok,
          phase: started ? 'start' : 'end',
          terminalId,
        },
      })
      return
    }
    if (event.type === 'question') {
      const ctx = parseJson(session.context_json, {})
      const pending = Array.isArray(ctx.pendingAdapterQuestions) ? ctx.pendingAdapterQuestions : []
      if (pending.some((q) => q.id === event.id)) return
      pending.push({
        id: event.id,
        text: event.text,
        choices: event.choices || [],
        terminalId,
        replyPath: replyPath || null,
        nodeInstanceId: nodeInstanceId || null,
        memberId: memberId || null,
      })
      ctx.pendingAdapterQuestions = pending
      updateSession(sessionId, { context_json: JSON.stringify(ctx) })
      addMessage(sessionId, {
        role: 'system',
        type: 'gate',
        node_instance_id: nodeInstanceId || null,
        member_id: memberId || null,
        content: {
          text: event.text,
          mode: 'adapter_question',
          questionId: event.id,
          choices: event.choices || [],
          terminalId,
          actions: (event.choices || []).length ? ['adapter_answer'] : ['adapter_answer', 'approve', 'reject'],
          humanAction: 'pending',
        },
      })
      emitSession(sessionId, {
        type: 'gate.request',
        payload: {
          mode: 'adapter_question',
          questionId: event.id,
          terminalId,
          nodeInstanceId,
        },
      })
      return
    }
    if (event.type === 'result') {
      addMessage(sessionId, {
        role: 'assistant',
        member_id: memberId || null,
        node_instance_id: nodeInstanceId || null,
        type: 'adapter_result',
        content: {
          text: event.summary,
          files: event.files || [],
          terminalId,
          adapter: 'jsonl',
        },
      })
      if (nodeInstanceId) {
        const node = getDb().prepare('SELECT * FROM node_instances WHERE id = ?').get(nodeInstanceId)
        if (node) {
          const prev = parseJson(node.output_json, {})
          updateNode(nodeInstanceId, {
            output_json: JSON.stringify({
              ...prev,
              adapterResult: {
                summary: event.summary,
                files: event.files || [],
                terminalId,
                at: nowIso(),
              },
            }),
          })
        }
      }
      try {
        refreshSessionAnnouncement(sessionId)
      } catch {
        /* announcement is best-effort */
      }
    }
  } catch (error) {
    console.warn('[acw] adapter event failed', error?.message || error)
  }
}

export function answerAdapterQuestion(sessionId, { questionId, text, choice, action } = {}) {
  const session = getSession(sessionId)
  if (!session) throw new Error('会话不存在')
  const ctx = parseJson(session.context_json, {})
  const pending = Array.isArray(ctx.pendingAdapterQuestions) ? ctx.pendingAdapterQuestions : []
  const q = pending.find((item) => item.id === questionId) || pending[0]
  if (!q) throw new Error('当前没有待回答的工具提问')
  const answerText =
    choice != null && String(choice)
      ? String(choice)
      : text != null && String(text).trim()
        ? String(text).trim()
        : action === 'reject'
          ? '取消'
          : '继续'
  if (q.replyPath) {
    try {
      appendAdapterReply(q.replyPath, {
        type: 'answer',
        at: nowIso(),
        id: q.id,
        terminalId: q.terminalId,
        text: answerText,
        choice: choice != null ? String(choice) : undefined,
        ok: action !== 'reject',
      })
    } catch {
      /* sidecar write is best-effort */
    }
  }
  ctx.pendingAdapterQuestions = pending.filter((item) => item.id !== q.id)
  updateSession(sessionId, { context_json: JSON.stringify(ctx) })
  const row = getDb()
    .prepare(
      `SELECT * FROM messages WHERE session_id = ? AND type = 'gate' ORDER BY created_at DESC`,
    )
    .all(sessionId)
    .find((m) => parseJson(m.content_json, {})?.questionId === q.id)
  if (row) {
    const content = parseJson(row.content_json, {})
    updateMessageContent(row.id, {
      ...content,
      humanAction: action === 'reject' ? 'reject' : 'approve',
      answered: true,
      answer: answerText,
    })
  }
  addMessage(sessionId, {
    role: 'user',
    type: 'gate',
    node_instance_id: q.nodeInstanceId || null,
    content: {
      text: answerText,
      mode: 'adapter_question',
      questionId: q.id,
      answered: true,
      humanAction: action === 'reject' ? 'reject' : 'approve',
    },
  })
  return { ok: true, questionId: q.id, answer: answerText }
}
