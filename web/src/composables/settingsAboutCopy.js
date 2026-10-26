/** Settings → About & updates page copy (DSK-08). */
import { t } from '../i18n/index.js'

function subst(str, vars = {}) {
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''))
}

function tp(suffix) {
  return t(`settings.aboutPage.${suffix}`)
}

/** Template helper: aboutT('updateSection') */
export function aboutT(suffix) {
  return tp(suffix)
}

export function aboutToast(key) {
  return tp(`toast.${key}`)
}

export function aboutConfirm(key) {
  return tp(`confirm.${key}`)
}

export function aboutConfirmCancel() {
  return t('common.cancel')
}

export function aboutDefaultTagline() {
  return tp('defaultTagline')
}

export function aboutDefaultLivingLine() {
  return tp('defaultLivingLine')
}

export function aboutDesktopTag(env) {
  return subst(tp('desktopTag'), { env })
}

export function aboutFoundNew(version) {
  return subst(tp('foundNew'), { version })
}

export function aboutDownloadOk(version, mb) {
  return subst(tp('toast.downloadOk'), { version, mb })
}

export function aboutLastBackup(name) {
  return subst(tp('lastBackup'), { name })
}

export function aboutBackupOptionLabel(name, isDir, size) {
  const dir = isDir ? tp('backupDirSuffix') : ''
  return subst(tp('backupOptionLabel'), { name, dir, size })
}

export function aboutRestoreConfirmBody(name) {
  return subst(tp('confirm.restoreBody'), { name })
}
