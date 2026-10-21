/** TerminalView chrome and toasts (DSK-08). */
import { t } from '../i18n/index.js'

export function terminalViewAriaLabel() {
  return t('terminal.view.ariaLabel')
}

export function terminalViewCtxCopy() {
  return t('terminal.view.ctxCopy')
}

export function terminalViewCtxPaste() {
  return t('terminal.view.ctxPaste')
}

export function terminalViewCtxSelectAll() {
  return t('terminal.view.ctxSelectAll')
}

export function terminalViewCtxCopyVisible() {
  return t('terminal.view.ctxCopyVisible')
}

export function terminalViewCtxClear() {
  return t('terminal.view.ctxClear')
}

export function terminalViewProcessEnded() {
  return t('terminal.view.processEnded')
}

export function terminalViewCopyEmptyMessage() {
  return t('terminal.view.copyEmpty')
}

export function terminalViewCopyFailedMessage() {
  return t('terminal.view.copyFailed')
}

export function terminalViewCopiedSelectionMessage() {
  return t('terminal.view.copiedSelection')
}

export function terminalViewCopiedVisibleMessage() {
  return t('terminal.view.copiedVisible')
}

export function terminalViewCopiedCharsMessage(count) {
  return t('terminal.view.copiedChars').replace('{count}', String(count))
}

export function terminalViewForceSelectionOnMessage() {
  return t('terminal.view.forceSelectionOn')
}

export function terminalViewForceSelectionOffMessage() {
  return t('terminal.view.forceSelectionOff')
}

export function terminalViewNeedSessionForFilesMessage() {
  return t('terminal.view.needSessionForFiles')
}

export function terminalViewPathsWrittenMessage(count) {
  return t('terminal.view.pathsWritten').replace('{count}', String(count))
}

export function terminalViewFileIngestFailedMessage(err) {
  return err?.message || t('terminal.view.fileIngestFailed')
}

export function terminalViewSearchPromptMessage() {
  return t('terminal.view.searchPromptMessage')
}

export function terminalViewSearchPromptTitle() {
  return t('terminal.view.searchPromptTitle')
}

export function terminalViewSearchConfirmButton() {
  return t('terminal.view.searchConfirm')
}

export function terminalViewSearchCancelButton() {
  return t('terminal.view.searchCancel')
}

export function terminalViewSearchPlaceholder() {
  return t('terminal.view.searchPlaceholder')
}

export function terminalViewSearchNotFoundMessage() {
  return t('terminal.view.searchNotFound')
}
