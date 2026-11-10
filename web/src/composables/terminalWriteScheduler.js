/**
 * Coalesce PTY output into rAF-flushed xterm writes (5.3.2 PERF-A1).
 */

/**
 * @param {{ write: (text: string) => void, isActive: () => boolean }} opts
 */
export function createTerminalWriteFlusher(opts) {
  const write = opts.write
  const isActive = opts.isActive || (() => true)
  let chunks = []
  let rafId = 0

  function flushNow() {
    rafId = 0
    if (!chunks.length) return
    if (!isActive()) return
    const merged = chunks.join('')
    chunks = []
    if (merged) write(merged)
  }

  function scheduleFlush() {
    if (rafId) return
    if (typeof requestAnimationFrame === 'function') {
      rafId = requestAnimationFrame(flushNow)
    } else {
      rafId = setTimeout(flushNow, 16)
    }
  }

  function enqueue(data) {
    const text = String(data || '')
    if (!text) return
    chunks.push(text)
    scheduleFlush()
  }

  function flushPending(opts = {}) {
    const force = opts.force === true
    if (rafId) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId)
      else clearTimeout(rafId)
      rafId = 0
    }
    if (!chunks.length) return
    if (!force && !isActive()) return
    const merged = chunks.join('')
    chunks = []
    if (merged) write(merged)
  }

  function clearPending() {
    if (rafId) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId)
      else clearTimeout(rafId)
      rafId = 0
    }
    chunks = []
  }

  function dispose() {
    clearPending()
  }

  return { enqueue, flushPending, clearPending, dispose }
}

const DEFAULT_CHUNK = 64 * 1024

/**
 * Write large replay without blocking the main thread for too long (PERF-A3).
 * @param {import('@xterm/xterm').Terminal} xterm
 * @param {string} text
 * @param {{ chunkSize?: number, signal?: { cancelled: boolean } }} [opts]
 */
export async function writeReplayInChunks(xterm, text, opts = {}) {
  if (!xterm) return
  const raw = String(text || '')
  xterm.reset()
  if (!raw) return
  const chunkSize = Math.max(4096, Number(opts.chunkSize) || DEFAULT_CHUNK)
  let i = 0
  while (i < raw.length) {
    if (opts.signal?.cancelled) return
    const end = Math.min(i + chunkSize, raw.length)
    xterm.write(raw.slice(i, end))
    i = end
    if (i < raw.length) {
      await new Promise((resolve) => {
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(() => resolve(), { timeout: 32 })
        } else {
          setTimeout(resolve, 0)
        }
      })
    }
  }
}
