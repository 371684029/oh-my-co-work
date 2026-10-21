/**
 * Clipboard read/write with desktop IPC fallback (5.2.0 CP-11).
 */

export async function writeClipboardText(text) {
  const value = String(text ?? '')
  if (!value) return false
  const api = typeof window !== 'undefined' ? window.__ACW_DESKTOP_API__ : null
  if (api?.writeClipboard) {
    return !!(await api.writeClipboard(value))
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return true
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = value
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export async function readClipboardText() {
  const api = typeof window !== 'undefined' ? window.__ACW_DESKTOP_API__ : null
  if (api?.readClipboard) {
    return String((await api.readClipboard()) || '')
  }
  if (navigator.clipboard?.readText) {
    return String(await navigator.clipboard.readText())
  }
  return ''
}
