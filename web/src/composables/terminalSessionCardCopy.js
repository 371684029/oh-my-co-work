/** Terminal session card labels (DSK-08 / QA-01 enter-terminal smoke). */
import { t } from '../i18n/index.js'

export function terminalCardDefaultLabel() {
  return t('terminal.card.defaultLabel')
}

export function terminalCardFailureTitle() {
  return t('terminal.card.failureTitle')
}

export function terminalCardCopyDiagnostics() {
  return t('terminal.card.copyDiagnostics')
}

export function terminalCardFailureFallback() {
  return t('terminal.card.failureFallback')
}

export function terminalCardMetaCommand() {
  return t('terminal.card.metaCommand')
}

export function terminalCardMetaCwd() {
  return t('terminal.card.metaCwd')
}

export function terminalCardEnterTerminal() {
  return t('terminal.card.enterTerminal')
}

export function terminalCardViewTerminal() {
  return t('terminal.card.viewTerminal')
}

export function terminalCardStop() {
  return t('terminal.card.stop')
}

export function terminalCardStatusUnknown() {
  return t('terminal.card.statusUnknown')
}

export function terminalCardDiagnosticsCopied() {
  return t('terminal.card.diagnosticsCopied')
}

export function terminalCardCopyFailed() {
  return t('terminal.card.copyFailed')
}

export function terminalCardPreviewIdle() {
  return t('terminal.card.previewIdle')
}

export function terminalCardElapsedSeconds(seconds) {
  return t('terminal.card.elapsedSeconds').replace('{seconds}', String(seconds))
}

export function terminalCardElapsedMinutes(minutes, seconds) {
  return t('terminal.card.elapsedMinutes')
    .replace('{minutes}', String(minutes))
    .replace('{seconds}', String(seconds))
}
