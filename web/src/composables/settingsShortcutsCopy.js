/** Settings → Shortcuts page copy (DSK-08). */
import { t } from '../i18n/index.js'

function subst(str, vars = {}) {
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''))
}

function tp(suffix) {
  return t(`settings.shortcutsPage.${suffix}`)
}

/** Template helper: shortcutsT('form.hotkeyTrigger') */
export function shortcutsT(suffix) {
  return tp(suffix)
}

export function shortcutsToast(key) {
  return tp(`toast.${key}`)
}

export function shortcutsConfirm(key) {
  return tp(`confirm.${key}`)
}

export function shortcutsConfirmCancel() {
  return t('common.cancel')
}

export function shortcutsKindLabel(kind) {
  if (kind === 'agent') return tp('kind.agent')
  if (kind === 'url') return tp('kind.url')
  return tp('kind.shell')
}

/** mode: 'yes' | 'no' | 'inherit' */
export function shortcutsPopupLabelForMode(mode) {
  if (mode === 'yes') return tp('popup.yes')
  if (mode === 'no') return tp('popup.no')
  return tp('popup.inherit')
}

export function shortcutsCloneName(name) {
  return subst(tp('cloneName'), { name })
}

export function shortcutsRunAgentOk(name) {
  return subst(tp('toast.runAgentOk'), { name: name || tp('kind.agent') })
}

export function shortcutsToggleEnableAria(name) {
  return subst(tp('a11y.toggleEnable'), { name })
}

export function shortcutsDefaultMemberName() {
  return tp('defaultMemberName')
}

export function shortcutsDefaultPrompt() {
  return tp('defaultPrompt')
}
