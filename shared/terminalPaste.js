/** 多行/大段粘贴策略：confirm | allow | reject */

export const PASTE_POLICY = {
  CONFIRM: 'confirm',
  ALLOW: 'allow',
  REJECT: 'reject',
}

export function countPasteLines(data) {
  const text = String(data || '')
  if (!text) return 0
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const parts = normalized.split('\n')
  while (parts.length > 1 && parts[parts.length - 1] === '') parts.pop()
  return parts.length
}

/**
 * @param {string} data
 * @param {string} [policy]
 * @param {{ multilineMinLines?: number, largeChars?: number }} [opts]
 * @returns {{ action: 'send' | 'confirm' | 'reject', lines: number, chars: number, risky: boolean }}
 */
export function inspectTerminalPaste(data, policy = PASTE_POLICY.CONFIRM, opts = {}) {
  const text = String(data || '')
  const lines = countPasteLines(text)
  const chars = text.length
  const multilineMinLines = Number(opts.multilineMinLines) > 1 ? Number(opts.multilineMinLines) : 2
  const largeChars = Number(opts.largeChars) > 0 ? Number(opts.largeChars) : 800
  const risky = lines >= multilineMinLines || chars >= largeChars
  const p =
    policy === PASTE_POLICY.ALLOW || policy === PASTE_POLICY.REJECT ? policy : PASTE_POLICY.CONFIRM
  if (!risky) return { action: 'send', lines, chars, risky: false }
  if (p === PASTE_POLICY.ALLOW) return { action: 'send', lines, chars, risky: true }
  if (p === PASTE_POLICY.REJECT) return { action: 'reject', lines, chars, risky: true }
  return { action: 'confirm', lines, chars, risky: true }
}
