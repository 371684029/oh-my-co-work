/** Terminal WS input limits (SRV-04 split). */

export const MAX_INPUT_CHARS = 65_536
export const MAX_INPUT_BYTES_PER_SECOND = 256 * 1024
export const MAX_INPUT_MESSAGES_PER_SECOND = 500

export function clampTerminalSize(value, fallback, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}
