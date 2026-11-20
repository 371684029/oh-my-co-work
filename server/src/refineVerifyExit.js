/**
 * Older refine contracts exited immediately when ACW_VERIFY was set, which hid
 * a later non-zero exit. Saving a member strips those lines so the probe can
 * see the script's own status.
 */

const LINE_PATTERNS = [
  /\r?\nif defined ACW_VERIFY exit \/b 0/g,
  /\r?\nif \(\$env:ACW_VERIFY -eq '1'\) \{ exit 0 \}/g,
  /\r?\nif \[ "\$\{ACW_VERIFY:-\}" = "1" \]; then exit 0; fi/g,
  /\r?\nif \(process\.env\.ACW_VERIFY === '1'\) process\.exit\(0\)/g,
  /\r?\nif _acw_os\.environ\.get\('ACW_VERIFY'\) == '1':\r?\n[ \t]*raise SystemExit\(0\)/g,
]

export function stripRefineVerifyExitInSource(text) {
  const src = String(text ?? '')
  if (!src.includes('ACW_VERIFY')) return { ok: false, reason: 'absent' }
  let next = src
  for (const re of LINE_PATTERNS) next = next.replace(re, '')
  if (next === src) return { ok: false, reason: 'absent' }
  return { ok: true, next }
}
