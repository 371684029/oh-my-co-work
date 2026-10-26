/** Settings → Group templates page copy (DSK-08). */
import { t } from '../i18n/index.js'

function subst(str, vars = {}) {
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''))
}

function tp(suffix) {
  return t(`settings.groupsPage.${suffix}`)
}

/** Template helper: groupsT('admin.title') */
export function groupsT(suffix) {
  return tp(suffix)
}

export function groupsToast(key) {
  return tp(`toast.${key}`)
}

export function groupsConfirm(key) {
  return tp(`confirm.${key}`)
}

export function groupsConfirmCancel() {
  return t('common.cancel')
}

export function groupsCloneName(name) {
  return subst(tp('cloneName'), { name })
}

export function groupsRemoveConfirmBody(title) {
  return subst(tp('confirm.removeBody'), { title })
}

export function groupsStartTitle(title) {
  return subst(tp('confirm.startTitle'), { title })
}

export function groupsBatchAdded(n) {
  return subst(tp('toast.batchAdded'), { n })
}

export function groupsAdminInherit() {
  return tp('admin.viewInherit')
}

export function groupsAdminInheritNamed(name) {
  return subst(tp('admin.viewInheritNamed'), { name })
}

export function groupsAdminNone() {
  return tp('admin.viewNone')
}

export function groupsAdminInheritHintCurrent(name) {
  return subst(tp('admin.inheritHintCurrent'), { name })
}

/** Labels for flow keys (admin | auto | human) shown in the view dialog. */
export function groupsFlowTags(keys) {
  const map = {
    admin: tp('steps.flowAdmin'),
    auto: tp('steps.flowAutoShort'),
    human: tp('steps.flowHuman'),
  }
  return (keys || []).map((k) => map[k]).filter(Boolean)
}

export function groupsImportPrompt() {
  return tp('importPrompt')
}
