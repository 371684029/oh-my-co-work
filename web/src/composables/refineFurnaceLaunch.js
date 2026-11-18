/** 6.8 RFV：试跑失败 → 熔炉炼化深链与预填 */

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

export function memberVerifyFailedForLaunch(form) {
  const v = form?._verifyLast
  if (v && v.ok === false && !v.skipped) return true
  return !!form?._verifyFailed
}