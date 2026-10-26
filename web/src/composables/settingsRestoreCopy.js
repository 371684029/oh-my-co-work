/** Settings → Restore center page copy (DSK-08). */
import { t } from '../i18n/index.js'

function subst(str, vars = {}) {
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''))
}

function tp(suffix) {
  return t(`settings.restorePage.${suffix}`)
}

/** Template helper: restoreT('membersHeading') */
export function restoreT(suffix) {
  return tp(suffix)
}

export function restoreToast(key) {
  return tp(`toast.${key}`)
}

export function restoreConfirm(key) {
  return tp(`confirm.${key}`)
}

export function restoreConfirmCancel() {
  return t('common.cancel')
}

export function restoreNodeLine(step, title, n) {
  return subst(tp('nodeLine'), { step, title, n })
}
