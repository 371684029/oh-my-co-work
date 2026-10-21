/**
 * 第三方 Agent 炼化：把输入 / 改动 / 结论追加进会话群报告。
 */
import { getSessionDetail } from './services.js'
import { readSessionAnnouncement, saveSessionAnnouncementRaw } from './journal.js'
import { saveSessionAnnouncement } from './engine.js'
import { invalidateDocsCache } from './docsHub.js'

const MAX_FIELD = 80_000
const MAX_TOTAL_BODY = 240_000
const RATE_WINDOW_MS = 60_000
const RATE_MAX_PER_SESSION = 12
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000

/** @type {Map<string, { at: number, result: object }>} */
const idempotencyCache = new Map()
/** @type {Map<string, { start: number, count: number }>} */
const rateBySession = new Map()

function pruneIdempotency() {
  const now = Date.now()
  for (const [k, v] of idempotencyCache) {
    if (now - v.at > IDEMPOTENCY_TTL_MS) idempotencyCache.delete(k)
  }
}

function assertRateLimit(sessionId) {
  const now = Date.now()
  let bucket = rateBySession.get(sessionId)
  if (!bucket || now - bucket.start > RATE_WINDOW_MS) {
    bucket = { start: now, count: 0 }
  }
  bucket.count += 1
  rateBySession.set(sessionId, bucket)
  if (bucket.count > RATE_MAX_PER_SESSION) {
    throw Object.assign(new Error('炼化请求过于频繁，请稍后再试'), { code: 'RATE_LIMIT' })
  }
}

function assertPayloadSize({ input, output, conclusion }) {
  const total = String(input ?? '').length + String(output ?? '').length + String(conclusion ?? '').length
  if (total > MAX_TOTAL_BODY) {
    throw Object.assign(new Error('炼化内容过大'), { code: 'PAYLOAD_TOO_LARGE' })
  }
}

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
  requestId,
} = {}) {
  const id = String(sessionId || '').trim()
  if (!id) throw Object.assign(new Error('缺少 sessionId'), { code: 'BAD_SESSION' })
  if (!getSessionDetail(id)) throw Object.assign(new Error('会话不存在'), { code: 'NO_SESSION' })
  assertPayloadSize({ input, output, conclusion })
  const rid = String(requestId || '').trim()
  if (rid) {
    pruneIdempotency()
    const cached = idempotencyCache.get(rid)
    if (cached) return { ...cached.result, deduped: true }
  }
  assertRateLimit(id)
  const section = formatRefineSection({ input, output, conclusion, source })
  const existing = readSessionAnnouncement(id)
  const body = existing?.markdown
    ? `${String(existing.markdown).replace(/\s*$/, '')}\n\n${section}`
    : `# 群报告\n\n${section}`
  const saved = saveSessionAnnouncement(id, body)
  invalidateDocsCache()
  const result = {
    ok: true,
    sessionId: id,
    path: saved.rel,
    markdown: saved.markdown,
  }
  if (rid) idempotencyCache.set(rid, { at: Date.now(), result })
  return result
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
