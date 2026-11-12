/** Settings → Members page copy (DSK-08). */
import { getLocale, t } from '../i18n/index.js'

function subst(str, vars = {}) {
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''))
}

function tp(suffix) {
  return t(`settings.membersPage.${suffix}`)
}

/** Template helper: membersT('form.refine') */
export function membersT(suffix) {
  return tp(suffix)
}

export function membersToast(key) {
  return tp(`toast.${key}`)
}

export function membersConfirm(key) {
  return tp(`confirm.${key}`)
}

export function membersConfirmCancel() {
  return t('common.cancel')
}

export function membersCloneName(name) {
  return subst(tp('cloneName'), { name })
}

export function membersImportPrompt() {
  return tp('importPrompt')
}

export function membersRefineSkillFallback() {
  return tp('refineSkillFallback')
}

/** Compose the save toast after a (possibly refine) member save. */
export function membersRefineSavedHint(saved, refineOn) {
  if (!refineOn) return tp('refineSaved.off')
  const prep = saved?.refinePrep
  const verify = saved?.verifyResult
  const names = (prep?.patched || [])
    .map((p) => String(p).split(/[/\\]/).pop())
    .filter(Boolean)
  let base
  if (names.length) {
    const joined = names.join(getLocale() === 'en-US' ? ', ' : '、')
    base = subst(tp('refineSaved.patched'), { names: joined })
  } else if (prep?.fallback) base = tp('refineSaved.fallback')
  else base = tp('refineSaved.plain')
  if (!verify || verify.skipped) return base
  if (verify.ok) return `${base} · ${tp('refineSaved.verifyOk')}`
  const failed = (verify.checks || []).filter((c) => !c.ok).map((c) => c.detail)
  const detail = failed.length ? failed.join(getLocale() === 'en-US' ? '; ' : '；') : tp('refineSaved.verifyFail')
  return `${base} · ${subst(tp('refineSaved.verifyFail'), { detail })}`
}

export function membersRestoreOk(n) {
  return subst(tp('toast.restoreOk'), { n })
}

export function membersRemoveConfirmBody(name) {
  return subst(tp('confirm.removeBody'), { name })
}

export function membersRestoreConflictBody(list, fallback) {
  return subst(tp('confirm.conflictBody'), { list: list || fallback || '' })
}

export function membersPlanConfirmBody(n, lines) {
  return subst(tp('confirm.planBody'), { n, lines })
}

/** Live adapt plan summary under the「是否适配」checkbox (5.9.0 RAR-08). */
export function membersAdaptPlanHint(plan) {
  if (!plan) return ''
  if (!plan.ok) {
    const reason = plan.reason || 'unknown'
    const key = `form.adaptPlanReason.${reason}`
    const line = tp(key)
    return line !== key ? line : reason
  }
  const n = plan.fileCount ?? 0
  const jsonl = plan.enableJsonl ? tp('form.adaptPlanJsonlSuffix') : ''
  if (plan.reason === 'already') return tp('form.adaptPlanAlready')
  if (plan.reason === 'no_source') return tp('form.adaptPlanNoSource')
  return subst(tp('form.adaptPlanWillPatch'), { n, jsonl })
}
