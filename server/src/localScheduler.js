/**
 * In-app scheduled group starts (5.3.0 FLW-06). Runs only while server process is up.
 */
import { getAppSettings } from './appSettings.js'
import { createSessionFromGroup } from './engine/sessionLifecycle.js'
import { nowIso } from '@acw/shared'

let intervalId = null
const lastFireKey = new Map()

function normalizeJobs(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((j) => j && j.groupId)
    .map((j) => ({
      id: String(j.id || j.groupId),
      groupId: String(j.groupId),
      title: j.title ? String(j.title) : '',
      hour: Math.max(0, Math.min(23, Number(j.hour) || 0)),
      minute: Math.max(0, Math.min(59, Number(j.minute) || 0)),
      enabled: j.enabled !== false,
    }))
}

function minuteKey(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`
}

export function tickLocalScheduler() {
  const jobs = normalizeJobs(getAppSettings().scheduledJobs)
  if (!jobs.length) return []
  const key = minuteKey()
  /** @type {Array<object>} */
  const started = []
  for (const job of jobs) {
    if (!job.enabled) continue
    const now = new Date()
    if (now.getHours() !== job.hour || now.getMinutes() !== job.minute) continue
    const dedupe = `${job.id}:${key}`
    if (lastFireKey.get(job.id) === dedupe) continue
    lastFireKey.set(job.id, dedupe)
    try {
      const session = createSessionFromGroup(job.groupId, job.title ? { title: job.title } : {})
      started.push({ jobId: job.id, sessionId: session.id, at: nowIso() })
    } catch (e) {
      started.push({ jobId: job.id, error: e.message, at: nowIso() })
    }
  }
  return started
}

export function startLocalScheduler() {
  if (intervalId) return
  intervalId = setInterval(() => {
    try {
      tickLocalScheduler()
    } catch (e) {
      console.warn('[acw] scheduler', e?.message || e)
    }
  }, 30_000)
}

export function stopLocalScheduler() {
  if (intervalId) clearInterval(intervalId)
  intervalId = null
}
