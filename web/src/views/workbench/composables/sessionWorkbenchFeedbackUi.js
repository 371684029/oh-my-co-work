/** Workbench toasts, prompts, and labels still owned by useSessionDetail (DSK-08 / FE-01). */

import { t } from '../../../i18n/index.js'

export function composerEmptyMessage() {
  return t('workbench.composer.empty')
}

export function composerCopySuccessMessage() {
  return t('workbench.composer.copySuccess')
}

export function composerCopyFailedMessage(err) {
  return err?.message || t('workbench.composer.copyFailed')
}

export function announceMdHintLabel(relativePath) {
  if (relativePath) {
    return t('workbench.announce.openHint').replace('{path}', relativePath)
  }
  return t('workbench.announce.openHintDefault')
}

export function announceOpenedMessage(absolutePath) {
  if (absolutePath) {
    return t('workbench.announce.openedPath').replace('{path}', absolutePath)
  }
  return t('workbench.announce.openedDefault')
}

export function announceOpenFailedMessage(err) {
  return err?.message || t('workbench.announce.openFailed')
}

export function announceRefreshedMessage() {
  return t('workbench.announce.refreshed')
}

export function announceRefreshFailedMessage(err) {
  return err?.message || t('workbench.announce.refreshFailed')
}

export function sessionNotesSavedMessage() {
  return t('workbench.notes.saved')
}

export function sessionNotesSaveFailedMessage(err) {
  return err?.message || t('workbench.notes.saveFailed')
}

export function adapterAnsweredMessage() {
  return t('workbench.adapter.answered')
}

export function convUnrecognizedSessionMessage() {
  return t('workbench.conv.unrecognized')
}

export function convRenamePromptOptions(currentTitle) {
  return {
    message: t('workbench.conv.renameInput'),
    title: t('workbench.conv.renameTitle'),
    inputValue: currentTitle,
    confirmButtonText: t('common.confirm'),
    cancelButtonText: t('common.cancel'),
  }
}

export function convRenamedMessage() {
  return t('workbench.conv.renamed')
}

export function hashItemEmptyInsertMessage(name) {
  const label = name || t('workbench.hash.itemFallback')
  return t('workbench.hash.emptyInsert').replace('{name}', label)
}

export function deleteNoSessionMessage() {
  return t('workbench.delete.noSession')
}

export function deleteConfirmDialogOptions() {
  return {
    title: t('workbench.delete.title'),
    message: t('workbench.delete.message'),
    confirmButtonText: t('workbench.delete.confirm'),
  }
}

export function deleteSuccessMessage() {
  return t('workbench.delete.success')
}

export function deleteFailedMessage(err) {
  return err?.message || t('workbench.delete.failed')
}
