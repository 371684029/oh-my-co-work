/** Settings → Preferences page copy (DSK-08). */
import { getLocale, t } from '../i18n/index.js'

function subst(str, vars = {}) {
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''))
}

function tp(suffix) {
  return t(`settings.prefsPage.${suffix}`)
}

/** Template helper: prefsT('demo.title') */
export function prefsT(suffix) {
  return tp(suffix)
}

export function prefsTitle() {
  return tp('title')
}

export function prefsDesc() {
  return tp('desc')
}

export function prefsRuntimeTitle() {
  return tp('runtime.title')
}

export function prefsRuntimeHintDesktopPrefix() {
  return tp('runtime.hintDesktopPrefix')
}

export function prefsRuntimeHintDesktopStrong(env) {
  return subst(tp('runtime.hintDesktopStrong'), { env })
}

export function prefsRuntimeHintDesktopSuffix() {
  return tp('runtime.hintDesktopSuffix')
}

export function prefsRuntimeHintWebStrong() {
  return tp('runtime.hintWebStrong')
}

export function prefsRuntimeHintWebSuffix() {
  return tp('runtime.hintWebSuffix')
}

export function prefsDataDirTitle() {
  return tp('dataDir.title')
}

export function prefsDataDirHint() {
  return tp('dataDir.hint')
}

export function prefsDataDirMigrate() {
  return tp('dataDir.migrate')
}

export function prefsDataDirSummary(d) {
  if (!d) return ''
  return [
    subst(tp('dataDir.summaryCurrent'), { path: d.current }),
    subst(tp('dataDir.summaryRecommended'), { path: d.recommended }),
    d.hasLegacy ? subst(tp('dataDir.summaryLegacy'), { path: d.legacy }) : tp('dataDir.summaryNoLegacy'),
    d.migrated ? tp('dataDir.summaryMigrated') : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function prefsColorSchemeOptions() {
  return [
    { label: tp('perf.schemeSystem'), value: 'system' },
    { label: tp('perf.schemeLight'), value: 'light' },
    { label: tp('perf.schemeDark'), value: 'dark' },
  ]
}

export function prefsResourceLabel(item) {
  const bits = []
  if (item.processCount) bits.push(subst(tp('resources.labelProcesses'), { n: item.processCount }))
  if (item.terminalCount) bits.push(subst(tp('resources.labelTerminals'), { n: item.terminalCount }))
  const inner = bits.join(' · ') || tp('resources.labelOccupied')
  const wrap =
    getLocale() === 'en-US' ? ` (${inner})` : `（${inner}）`
  return `${item.title}${wrap}`
}

export function prefsUsageSummaryText(u) {
  if (!u) return ''
  const lines = [
    subst(tp('usageSummary.sessions'), {
      total: u.sessions?.total ?? 0,
      active: u.sessions?.active ?? 0,
    }),
    subst(tp('usageSummary.nodes'), {
      hours: u.nodes?.totalHours ?? 0,
      failed: u.nodes?.failed ?? 0,
    }),
    subst(tp('usageSummary.terminals'), { hours: u.terminals?.totalHours ?? 0 }),
    subst(tp('usageSummary.storage'), { mib: u.storage?.logMiB ?? 0 }),
  ]
  for (const m of (u.byMember || []).slice(0, 5)) {
    lines.push(
      subst(tp('usageSummary.memberLine'), {
        name: m.name,
        runs: m.runs,
        avgSec: Math.round(m.avgMs / 1000),
        failRate: m.failRate,
      }),
    )
  }
  return lines.join('\n')
}

export function prefsResolvedHint(r, adminMemberId) {
  if (r?.display_name) return subst(tp('furnace.resolved'), { name: r.display_name })
  if (!adminMemberId) return tp('furnace.resolvedAuto')
  return ''
}

export function prefsConfirmCancel() {
  return t('common.cancel')
}

export function prefsToast(key) {
  return tp(`toast.${key}`)
}

export function prefsConfirm(key) {
  return tp(`confirm.${key}`)
}

export function prefsImportConfirmBody(name) {
  return subst(tp('confirm.importBody'), { name })
}

export function prefsReleaseOk(n) {
  return subst(tp('toast.releaseOk'), { n })
}

export function prefsBackupImportLast(time) {
  return subst(tp('backup.importLast'), { time })
}

export function prefsBackupExportLast(time) {
  return subst(tp('backup.exportLast'), { time })
}

export function prefsTestNotifyTitle() {
  return tp('testNotify.title')
}

export function prefsTestNotifyBody() {
  return tp('testNotify.body')
}
