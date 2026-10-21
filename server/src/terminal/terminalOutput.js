import { emitSession, emitTerminalOutput } from '../bus.js'
import { quotaLimits, redactOpts } from './quota.js'
import { redactText } from './redact.js'

export const OUTPUT_BATCH_MS = 24

export function appendReplay(entry, data) {
  const maxChars = quotaLimits().maxReplayChars
  entry.replay += data
  if (entry.replay.length > maxChars) {
    entry.replay = entry.replay.slice(-maxChars)
    entry.replayTruncated = true
  }
}

export function emitTerminal(entry, type, payload = {}) {
  emitSession(entry.sessionId, {
    type,
    payload: {
      terminalId: entry.id,
      ...payload,
    },
  })
}

export function emitTerminalStream(entry, payload = {}) {
  emitTerminalOutput(entry.sessionId, entry.id, {
    type: 'terminal.output',
    payload: {
      terminalId: entry.id,
      ...payload,
    },
  })
}

export function flushOutput(entry) {
  entry.flushTimer = null
  if (!entry.pendingOutput) return
  const data = entry.pendingOutput
  entry.pendingOutput = ''
  entry.seq += 1
  emitTerminalStream(entry, { seq: entry.seq, data })
}

export function queueOutput(entry, data) {
  const text = String(data || '')
  if (!text) return
  appendReplay(entry, text)
  entry.pendingOutput += text
  if (entry.logStream && !entry.logTruncated) {
    const logged = redactText(text, redactOpts())
    const maxLog = quotaLimits().maxLogBytes
    const bytes = Buffer.byteLength(logged)
    const remaining = maxLog - entry.logBytes
    if (remaining > 0) {
      const chunk = bytes <= remaining ? logged : Buffer.from(logged).subarray(0, remaining)
      entry.logStream.write(chunk)
      entry.logBytes += Math.min(bytes, remaining)
    }
    if (bytes > remaining) {
      entry.logTruncated = true
      entry.logStream.write('\n[oh-my-co-work] terminal log truncated\n')
    }
  }
  if (!entry.flushTimer) {
    entry.flushTimer = setTimeout(() => flushOutput(entry), OUTPUT_BATCH_MS)
  }
}
