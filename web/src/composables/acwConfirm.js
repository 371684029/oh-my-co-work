/**
 * Unified confirm dialogs with optional "don't ask again" (5.2.0 UX-05).
 */
import ElMessageBox from 'element-plus/es/components/message-box/index.mjs'

const SKIP_PREFIX = 'acw.confirm.skip.'

export function isConfirmSkipped(key) {
  if (!key) return false
  try {
    return localStorage.getItem(`${SKIP_PREFIX}${key}`) === '1'
  } catch {
    return false
  }
}

export function setConfirmSkipped(key, skipped = true) {
  if (!key) return
  try {
    if (skipped) localStorage.setItem(`${SKIP_PREFIX}${key}`, '1')
    else localStorage.removeItem(`${SKIP_PREFIX}${key}`)
  } catch {
    /* ignore */
  }
}

/**
 * @returns {Promise<boolean>} true if confirmed
 */
export async function acwConfirm(key, { title, message, confirmButtonText = '确认', cancelButtonText = '取消', type = 'warning', allowSkip = true } = {}) {
  if (key && isConfirmSkipped(key)) return true
  const skipId = `acw-skip-${Math.random().toString(36).slice(2, 9)}`
  const body =
    allowSkip && key
      ? `${message}<p style="margin:12px 0 0;font-size:13px"><label><input type="checkbox" id="${skipId}" /> 以后不再提示</label></p>`
      : message
  try {
    await ElMessageBox.confirm(body, title, {
      type,
      confirmButtonText,
      cancelButtonText,
      dangerouslyUseHTMLString: allowSkip && !!key,
    })
    if (key && allowSkip && typeof document !== 'undefined') {
      const el = document.getElementById(skipId)
      if (el?.checked) setConfirmSkipped(key, true)
    }
    return true
  } catch {
    return false
  }
}
