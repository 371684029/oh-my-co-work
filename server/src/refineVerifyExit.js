/**
 * Probe early-exit: when ACW_VERIFY=1 the contract prints the heading and
 * leaves before a long-running server body. Normal runs do not set the variable.
 */
const MARK = 'ACW_VERIFY'

export function verifyExitSnippet(filePath) {
  const ext = String(filePath || '').toLowerCase()
  if (ext.endsWith('.bat') || ext.endsWith('.cmd')) return 'if defined ACW_VERIFY exit /b 0'
  if (ext.endsWith('.ps1')) return "if ($env:ACW_VERIFY -eq '1') { exit 0 }"
  if (ext.endsWith('.sh')) return 'if [ "${ACW_VERIFY:-}" = "1" ]; then exit 0; fi'
  if (ext.endsWith('.py')) return "if _acw_os.environ.get('ACW_VERIFY') == '1':\n    raise SystemExit(0)"
  return "if (process.env.ACW_VERIFY === '1') process.exit(0)"
}

export function ensureRefineVerifyExitInSource(text, filePath) {
  const src = String(text ?? '')
  if (!src.includes('ACW-REFINE')) return { ok: false, reason: 'no_mark' }
  if (src.includes(MARK)) return { ok: false, reason: 'already' }
  const nl = src.includes('\r\n') ? '\r\n' : '\n'
  const lines = src.split(/\r?\n/)
  let insertAt = -1
  const limit = Math.min(lines.length, 40)
  for (let i = 0; i < limit; i++) {
    if (!lines[i].includes('ACW-REFINE')) continue
    for (let j = i; j < Math.min(lines.length, i + 16); j++) {
      if (/###/.test(lines[j]) && /echo|print|Write-Output|console\.log/i.test(lines[j])) {
        insertAt = j + 1
        break
      }
    }
    if (insertAt < 0) insertAt = Math.min(lines.length, i + 5)
    break
  }
  if (insertAt < 0) return { ok: false, reason: 'anchor_missing' }
  const snippet = verifyExitSnippet(filePath)
  const next = [...lines.slice(0, insertAt), ...snippet.split('\n'), ...lines.slice(insertAt)].join(nl)
  return { ok: true, reason: 'ok', next }
}
