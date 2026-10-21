/**
 * Step-level timeout, retry, and failure policy (5.3.0 FLW-01).
 */
import { getAppSettings } from './appSettings.js'
import { killMemberProcesses } from './processRegistry.js'

const DEFAULT_TIMEOUT_MS = 0
const DEFAULT_MAX_RETRIES = 0
const DEFAULT_RETRY_INTERVAL_MS = 3000

export function resolveStepRunPolicy(step, settings = getAppSettings()) {
  const s = step && typeof step === 'object' ? step : {}
  const run = s.run && typeof s.run === 'object' ? s.run : {}
  const timeoutSec = Number(run.timeoutSec ?? s.timeoutSec ?? 0)
  const timeoutMs =
    Number.isFinite(timeoutSec) && timeoutSec > 0
      ? Math.min(86_400, Math.round(timeoutSec * 1000))
      : DEFAULT_TIMEOUT_MS
  const retry = run.retry && typeof run.retry === 'object' ? run.retry : {}
  const maxRetries = Math.max(
    0,
    Math.min(10, Number(retry.max ?? run.retryMax ?? s.retryMax ?? DEFAULT_MAX_RETRIES) || 0),
  )
  const intervalSec = Number(retry.intervalSec ?? run.retryIntervalSec ?? 3)
  const retryIntervalMs =
    Number.isFinite(intervalSec) && intervalSec >= 0
      ? Math.min(3600, Math.round(intervalSec * 1000))
      : DEFAULT_RETRY_INTERVAL_MS
  let onFailure = String(run.onFailure ?? s.onFailure ?? 'wait').toLowerCase()
  if (!['wait', 'skip', 'stop'].includes(onFailure)) onFailure = 'wait'
  const quota = settings?.quota || {}
  return {
    timeoutMs,
    maxRetries,
    retryIntervalMs,
    onFailure,
    quotaMaxTerminals: Number(quota.maxConcurrentTerminals) || 8,
  }
}

export function runWithTimeout(promise, timeoutMs, { onTimeout } = {}) {
  if (!timeoutMs || timeoutMs <= 0) return promise
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      const err = Object.assign(new Error('步骤执行超时'), { code: 'STEP_TIMEOUT' })
      try {
        onTimeout?.()
      } catch {
        /* ignore */
      }
      reject(err)
    }, timeoutMs)
    Promise.resolve(promise)
      .then((v) => {
        clearTimeout(t)
        resolve(v)
      })
      .catch((e) => {
        clearTimeout(t)
        reject(e)
      })
  })
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export function killMemberOnTimeout(sessionId, memberId) {
  if (!sessionId || !memberId) return
  try {
    killMemberProcesses(sessionId, memberId)
  } catch {
    /* ignore */
  }
}
