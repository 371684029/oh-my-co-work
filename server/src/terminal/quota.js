import { getAppSettings } from '../appSettings.js'

/** Terminal log / replay / concurrency limits from app settings (SRV-04). */
export function quotaLimits(settings = getAppSettings()) {
  const q = settings?.quota || {}
  return {
    maxConcurrent: Number(q.maxConcurrentTerminals) || 8,
    maxLogBytes: Math.max(1, Number(q.maxLogMiB) || 10) * 1024 * 1024,
    maxReplayChars: Math.max(32, Number(q.maxReplayKiB) || 256) * 1024,
  }
}

export function redactOpts(settings = getAppSettings()) {
  const r = settings?.redact || {}
  return { enabled: r.enabled !== false, patternsText: r.patternsText || '' }
}
