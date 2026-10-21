/** DocsHub user-facing toast / fallback messages (DSK-08). */

import { t } from '../../i18n/index.js'

export function docsExportGroupSuccessMessage() {
  return t('docs.export.groupSuccess')
}

export function docsExportGroupErrorMessage(err) {
  return err?.message || t('docs.export.failed')
}

export function docsExportAllSuccessMessage() {
  return t('docs.export.allSuccess')
}

export function docsExportAllErrorMessage(err) {
  return err?.message || t('docs.export.allFailed')
}

export function docsCopyAnchorSuccessMessage() {
  return t('docs.copyAnchorSuccess')
}

export function docsCopyAnchorFallbackMessage(hash) {
  return t('docs.copyAnchorFallback').replace('{hash}', hash)
}

export function docsPrintPopupBlockedMessage() {
  return t('docs.printPopupBlocked')
}

export function docsLinkResolveFailedMessage() {
  return t('docs.linkResolveFailed')
}

export function docsCopyCodeSuccessMessage() {
  return t('docs.copyCodeSuccess')
}

export function docsCopyCodeFailedMessage() {
  return t('docs.copyCodeFailed')
}
