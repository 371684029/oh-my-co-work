/** 6.8 RFV：试跑失败 → 熔炉炼化深链与预填 */

export const FURNACE_BIND_INTENT_KEY = 'acw.furnaceBindIntent'
export const FURNACE_REFINE_PREFILL_KEY = 'acw.furnaceRefinePrefill'
export const FURNACE_REFINE_AGENT_KEY = 'acw.furnaceRefineAgent'
export const REFINE_FURNACE_TARGET_KEY = 'acw.refineFurnaceTarget'

export const REFINE_FURNACE_TARGETS = ['grok', 'cursor', 'external']

export function normalizeRefineFurnaceTarget(raw) {
  const t = String(raw || '').trim().toLowerCase()
  return REFINE_FURNACE_TARGETS.includes(t) ? t : 'grok'
}

export function readRefineFurnaceTarget() {
  try {
    return normalizeRefineFurnaceTarget(localStorage.getItem(REFINE_FURNACE_TARGET_KEY))
  } catch {
    return 'grok'
  }
}

export function saveRefineFurnaceTarget(target) {
  try {
    localStorage.setItem(REFINE_FURNACE_TARGET_KEY, normalizeRefineFurnaceTarget(target))
  } catch {
    /* ignore */
  }
}

export function storeFurnaceRefinePrefill(prompt, agent) {
  try {
    if (prompt) sessionStorage.setItem(FURNACE_REFINE_PREFILL_KEY, String(prompt))
    if (agent) sessionStorage.setItem(FURNACE_REFINE_AGENT_KEY, normalizeRefineFurnaceTarget(agent))
  } catch {
    /* ignore */
  }
}

export function peekFurnaceRefinePrefill() {
  try {
    return {
      prompt: sessionStorage.getItem(FURNACE_REFINE_PREFILL_KEY) || '',
      agent: sessionStorage.getItem(FURNACE_REFINE_AGENT_KEY) || '',
    }
  } catch {
    return { prompt: '', agent: '' }
  }
}

export function consumeFurnaceRefinePrefill() {
  const peek = peekFurnaceRefinePrefill()
  try {
    sessionStorage.removeItem(FURNACE_REFINE_PREFILL_KEY)
    sessionStorage.removeItem(FURNACE_REFINE_AGENT_KEY)
  } catch {
    /* ignore */
  }
  return peek
}

export function parseFurnaceLaunchQuery(query = {}) {
  return {
    openFurnace: query.furnace === '1' || query.furnace === 'true',
    agent: normalizeRefineFurnaceTarget(query.agent),
    refineMemberId: String(query.refineMemberId || '').trim(),
  }
}

export function buildFurnaceLaunchQuery({ agent, memberId, jump = true } = {}) {
  const q = {
    furnace: jump ? '1' : undefined,
    agent: normalizeRefineFurnaceTarget(agent),
  }
  if (memberId) q.refineMemberId = String(memberId)
  return Object.fromEntries(Object.entries(q).filter(([, v]) => v != null && v !== ''))
}

export function storeFurnaceBindIntent(intent) {
  try {
    sessionStorage.setItem(FURNACE_BIND_INTENT_KEY, JSON.stringify(intent || {}))
  } catch {
    /* ignore */
  }
}

/**
 * Agent chosen in the launch dialog. Read this before startChat replaces the
 * workbench route, because that navigation drops the query string.
 * Intent wins: it survives the route change. Empty means the user did not name one.
 */
export function resolveFurnaceLaunchAgent({ intent, query } = {}) {
  const raw = String(intent?.agent || query?.agent || '').trim().toLowerCase()
  if (raw === 'cursor') return 'cursor'
  if (raw === 'grok') return 'grok'
  return ''
}

export function consumeFurnaceBindIntent() {
  try {
    const raw = sessionStorage.getItem(FURNACE_BIND_INTENT_KEY) || ''
    sessionStorage.removeItem(FURNACE_BIND_INTENT_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return data && typeof data === 'object' ? data : null
  } catch {
    return null
  }
}

/**
 * How to attach a live furnace process to the member the user just picked.
 * Stance itself never changes from TUI text; this only chooses start / continue / restart.
 */
/**
 * Plain transcript already had TUI chrome removed. A short status line is not a user task.
 * Two real lines, or one line long enough to be a sentence, counts.
 */
export function furnacePlainTextHasUserTask(text) {
  const lines = String(text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length >= 12)
  return lines.length >= 2 || lines.some((s) => s.length >= 40)
}

export function decideFurnaceProcess({ live, seenMemberId, nextMemberId, hasUserTask } = {}) {
  const next = String(nextMemberId || '').trim()
  const seen = String(seenMemberId || '').trim()
  if (!next) return live ? 'focus' : 'start-free'
  if (!live) return 'start'
  if (seen && seen === next) return 'continue'
  return hasUserTask ? 'confirm-restart' : 'restart'
}

export function memberVerifyFailedForLaunch(form) {
  const v = form?._verifyLast
  if (v && v.ok === false && !v.skipped) return true
  return !!form?._verifyFailed
}

/** 还原中心 / 列表上的成员摘要（verifyLast 在顶层） */
export function memberVerifyFailedFromRecord(record) {
  if (!record) return false
  if (record.verifyFailed) return true
  const v = record.verifyLast
  return !!(v && v.ok === false && !v.skipped)
}