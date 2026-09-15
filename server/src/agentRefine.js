/**
 * 第三方 Agent 炼化：把输入 / 改动 / 结论追加进会话群报告。
 */
import { getSessionDetail } from './services.js'
import { readSessionAnnouncement, saveSessionAnnouncementRaw } from './journal.js'
import { saveSessionAnnouncement } from './engine.js'
import { invalidateDocsCache } from './docsHub.js'

const MAX_FIELD = 80_000

function clip(value) {
  const text = String(value ?? '').trim()
  if (text.length <= MAX_FIELD) return text
  return `${text.slice(0, MAX_FIELD)}\n\n…（已截断）`
}

export function buildRefineSkillPrompt({ sessionId } = {}) {
  const sid = String(sessionId || '').trim() || '{sessionId}'
  return [
    '请在完成本次代码修改后，调用 agent-refine-skill，将【输入】【输出/改动】【结论】写回 cowork 文档中心。',
    `sessionId: ${sid}`,
    '本机 API（需工作台已登录，请求头带 X-ACW-Token）：POST /api/docs/refine',
    `JSON: {"sessionId":"${sid}","input":"用户需求","output":"git diff 摘要","conclusion":"结论"}`,
    `也可直接把同结构章节追加到 journals/sessions/${sid}/ANNOUNCEMENT.md。`,
  ].join('\n')
}

function formatRefineSection({ input, output, conclusion, source }) {
  const when = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, 'Z')
  const src = String(source || 'agent-refine-skill').trim() || 'agent-refine-skill'
  return [
    `## 外部 Agent 炼化 · ${when}`,
    '',
    `_来源：${src}_`,
    '',
    '### 输入',
    '',
    clip(input) || '_（空）_',
    '',
    '### 输出/改动',
    '',
    clip(output) || '_（空）_',
    '',
    '### 结论',
    '',
    clip(conclusion) || '_（空）_',
    '',
  ].join('\n')
}

export function appendAgentRefine({
  sessionId,
  input,
  output,
  conclusion,
  source,
} = {}) {
  const id = String(sessionId || '').trim()
  if (!id) throw Object.assign(new Error('缺少 sessionId'), { code: 'BAD_SESSION' })
  if (!getSessionDetail(id)) throw Object.assign(new Error('会话不存在'), { code: 'NO_SESSION' })
  const section = formatRefineSection({ input, output, conclusion, source })
  const existing = readSessionAnnouncement(id)
  const body = existing?.markdown
    ? `${String(existing.markdown).replace(/\s*$/, '')}\n\n${section}`
    : `# 群报告\n\n${section}`
  const saved = saveSessionAnnouncement(id, body)
  invalidateDocsCache()
  return {
    ok: true,
    sessionId: id,
    path: saved.rel,
    markdown: saved.markdown,
  }
}

/** 测试或不走引擎事件时的纯文件追加 */
export function appendAgentRefineRaw({ sessionId, input, output, conclusion, source } = {}) {
  const id = String(sessionId || '').trim()
  if (!id) throw new Error('缺少 sessionId')
  const section = formatRefineSection({ input, output, conclusion, source })
  const existing = readSessionAnnouncement(id)
  const body = existing?.markdown
    ? `${String(existing.markdown).replace(/\s*$/, '')}\n\n${section}`
    : `# 群报告\n\n${section}`
  return saveSessionAnnouncementRaw(id, body)
}
