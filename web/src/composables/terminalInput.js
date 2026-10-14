/**
 * Pure helpers for terminal input (5.1.0 CLI-07 / CLI-08). Kept DOM-free and
 * WebSocket-free so they can be unit-tested directly:
 *  - chunkTerminalInput: split a large paste so the server (and ConPTY) never
 *    receive one oversized write.
 *  - createInputSequencer: preserve keystroke order while a paste confirmation
 *    is pending, instead of letting later keys overtake the paste.
 */

export const DEFAULT_CHUNK_SIZE = 4096
export const DEFAULT_CHUNK_THRESHOLD = 4096
export const DEFAULT_CHUNK_INTERVAL_MS = 25

export function shouldChunkTerminalInput(data, { threshold = DEFAULT_CHUNK_THRESHOLD } = {}) {
  return String(data ?? '').length > threshold
}

/**
 * Split `data` into chunks of at most `size` code units, never splitting a
 * surrogate pair. Concatenating the result reproduces the input exactly.
 */
export function chunkTerminalInput(data, { size = DEFAULT_CHUNK_SIZE } = {}) {
  const text = String(data ?? '')
  const max = Math.max(2, Math.floor(Number(size) || DEFAULT_CHUNK_SIZE))
  if (!text) return []
  if (text.length <= max) return [text]
  const chunks = []
  let i = 0
  while (i < text.length) {
    let end = Math.min(i + max, text.length)
    if (end < text.length) {
      const code = text.charCodeAt(end)
      // A low surrogate at the boundary means the pair straddles it: pull the
      // boundary back so the high surrogate stays with its low half.
      if (code >= 0xdc00 && code <= 0xdfff && end - 1 > i) end -= 1
    }
    chunks.push(text.slice(i, end))
    i = end
  }
  return chunks
}

/**
 * Ordered input buffer for the paste-confirmation window (CLI-08).
 *
 * While a confirmation is pending, `enqueue` holds keystrokes. On confirm the
 * paste is released first (it triggered the dialog) followed by the buffered
 * keys in order; on cancel only the buffered keys are released. Nothing typed
 * during the window is silently dropped, and order is preserved.
 */
export function createInputSequencer() {
  let pending = false
  const buffer = []
  return {
    get pending() {
      return pending
    },
    begin() {
      pending = true
      buffer.length = 0
    },
    /** Returns `[data]` when idle, or `[]` (held) while a confirmation is pending. */
    enqueue(data) {
      if (!pending) return [data]
      buffer.push(data)
      return []
    },
    /** Confirm: paste first, then buffered keys, in order. */
    flushConfirmed(pasteData) {
      pending = false
      const out = []
      if (pasteData) out.push(pasteData)
      out.push(...buffer)
      buffer.length = 0
      return out
    },
    /** Cancel: release the buffered keys in order. */
    flushCancelled() {
      pending = false
      const out = buffer.slice()
      buffer.length = 0
      return out
    },
  }
}
