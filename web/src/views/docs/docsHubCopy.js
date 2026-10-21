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

export function docsHubUnpinTitle() {
  return t('docs.unpinTitle')
}
