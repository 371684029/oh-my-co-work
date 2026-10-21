/** DocsHub visible labels (DSK-08 via t()). */

import { t } from '../../i18n/index.js'

export function docsHubColTitle(sort) {
  return sort === 'group' ? t('docs.colTitleGroup') : t('docs.colTitleTime')
}

export function docsHubExportAllLabel() {
  return t('docs.exportAll')
}

export function docsHubExportAllAria() {
  return t('docs.a11y.exportAll')
}

export function docsHubAllGroupsLabel() {
  return t('docs.allGroups')
}

export function docsHubAllGroupsAria() {
  return t('docs.a11y.allGroups')
}

export function docsHubSearchPlaceholder() {
  return t('docs.searchPlaceholder')
}

export function docsHubRefreshLabel() {
  return t('docs.refresh')
}

export function docsHubPinnedSectionTitle() {
  return t('docs.pinned')
}

export function docsHubRecentSectionTitle() {
  return t('docs.recent')
}

export function docsHubOutlineTitle() {
  return t('docs.outline')
}

export function docsHubOutlineAria() {
  return t('docs.a11y.outline')
}

export function docsHubWelcomeSelectTitle() {
  return t('docs.welcome.selectTitle')
}

export function docsHubWelcomeEmptyTitle() {
  return t('docs.welcome.emptyTitle')
}

export function docsHubWelcomeSelectDesc() {
  return t('docs.welcome.selectDesc')
}

export function docsHubWelcomeEmptyDesc() {
  return t('docs.welcome.emptyDesc')
}

export function docsHubGoWorkbenchLabel() {
  return t('docs.goWorkbench')
}

export function docsHubLoadingFile() {
  return t('docs.loadingFile')
}

export function docsHubNoGroups() {
  return t('docs.noGroups')
}

export function docsHubNoDocsInRange() {
  return t('docs.noDocsInRange')
}

export function docsHubNoSessionDocs() {
  return t('docs.noSessionDocs')
}

export function docsHubExportGroupShort() {
  return t('docs.exportGroupShort')
}

export function docsHubExportGroupAria(groupTitle) {
  return t('docs.a11y.exportGroup').replace('{title}', groupTitle || '')
}

export function docsHubViewGroupAria(groupTitle) {
  return t('docs.a11y.viewGroup').replace('{title}', groupTitle || '')
}

export function docsHubWelcomeEmptyTip() {
  return t('docs.welcome.emptyTip')
}

export function docsHubWelcomeRegionAria() {
  return t('docs.a11y.welcomeRegion')
}

export function docsHubUnpinTitle() {
  return t('docs.unpinTitle')
}

export function docsHubReadingThemeLabel(theme) {
  return theme === 'dark' ? t('docs.reading.themeLight') : t('docs.reading.themeDark')
}

export function docsHubReadingFocusLabel(focus) {
  return focus ? t('docs.reading.exitFocus') : t('docs.reading.focus')
}

export function docsHubEditLabel() {
  return t('docs.actions.edit')
}

export function docsHubSaveLabel() {
  return t('docs.actions.save')
}

export function docsHubCancelLabel() {
  return t('docs.actions.cancel')
}

export function docsHubReadonlyHint() {
  return t('docs.actions.readonlyHint')
}

export function docsHubCodeLineNumbersLabel() {
  return t('docs.actions.codeLineNumbers')
}

export function docsHubPinDocLabel(pinned) {
  return pinned ? t('docs.actions.unpinDoc') : t('docs.actions.pinDoc')
}

export function docsHubExportHtmlLabel() {
  return t('docs.actions.exportHtml')
}

export function docsHubExportPdfLabel() {
  return t('docs.actions.exportPdf')
}

export function docsHubInDocPrevLabel() {
  return t('docs.inDoc.prev')
}

export function docsHubInDocNextLabel() {
  return t('docs.inDoc.next')
}

export function docsHubInDocCloseLabel() {
  return t('docs.inDoc.close')
}

export function docsHubInDocSearchBanner(query, pager) {
  const q = String(query || '')
  const p = String(pager || '')
  return t('docs.inDoc.banner').replace('{query}', q).replace('{pager}', p)
}

export function docsHubSearchingLabel() {
  return t('docs.list.searching')
}

export function docsHubNoSearchHitsLabel() {
  return t('docs.list.noHits')
}

export function docsHubHitLineLabel(line) {
  return t('docs.list.hitLine').replace('{line}', String(line ?? ''))
}

export function docsHubListLoadingLabel() {
  return t('docs.list.loading')
}

export function docsHubPinQuickTitle() {
  return t('docs.pinQuickTitle')
}

export function docsHubBadgeAdaptLabel() {
  return t('docs.badges.adapt')
}

export function docsHubBadgeClonedLabel() {
  return t('docs.badges.cloned')
}

export function docsHubTruncatedWarn() {
  return t('docs.truncatedWarn')
}

export function docsHubEditPlaceholder() {
  return t('docs.editPlaceholder')
}
