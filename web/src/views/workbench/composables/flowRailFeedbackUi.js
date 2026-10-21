/** Flow rail toasts and confirm copy (DSK-08). */
import { t } from '../../../i18n/index.js'

export function flowRailTimelineLoadFailedMessage(err) {
  return err?.message || t('workbench.flowRail.timeline.loadFailed')
}

export function flowRailAuditExportFailedMessage(err) {
  return err?.message || t('workbench.flowRail.timeline.exportFailed')
}

export function flowRailTerminalLogFailedMessage(err) {
  return err?.message || t('workbench.flowRail.timeline.terminalLogFailed')
}

export function flowRailRevertBlockedMessage(preview) {
  return preview?.message || t('workbench.flowRail.revert.cannot')
}

export function flowRailRevertConfirmMessage(preview) {
  if (preview?.needsForce) {
    return `${preview.message || t('workbench.flowRail.revert.confirmBody')}\n\n${t('workbench.flowRail.revert.confirmForceHint')}`
  }
  return preview?.message || t('workbench.flowRail.revert.confirmBody')
}

export function flowRailRevertConfirmTitle() {
  return t('workbench.flowRail.revert.confirmTitle')
}

export function flowRailRevertConfirmButton(needsForce) {
  return needsForce
    ? t('workbench.flowRail.revert.forceConfirm')
    : t('workbench.flowRail.revert.confirm')
}

export function flowRailRevertSuccessMessage() {
  return t('workbench.flowRail.revert.success')
}

export function flowRailRevertConflictMessage(err) {
  return err?.message || t('workbench.flowRail.revert.conflictBody')
}

export function flowRailRevertConflictTitle() {
  return t('workbench.flowRail.revert.conflictTitle')
}

export function flowRailRevertForceButton() {
  return t('workbench.flowRail.revert.forceConfirm')
}

export function flowRailRevertForcedSuccessMessage() {
  return t('workbench.flowRail.revert.forcedSuccess')
}

export function flowRailRevertFailedMessage(err) {
  return err?.message || t('workbench.flowRail.revert.failed')
}

export function flowRailDocsListFailedMessage(err) {
  return err?.message || t('workbench.flowRail.docsRail.listFailed')
}

export function flowRailDocsReadFailedMessage(err) {
  return err?.message || t('workbench.flowRail.docsRail.readFailed')
}

export function flowRailDocsNoGroupMessage() {
  return t('workbench.flowRail.docsRail.noGroup')
}

export function flowRailDocsExportSuccessMessage() {
  return t('workbench.flowRail.docsRail.exportSuccess')
}

export function flowRailDocsExportFailedMessage(err) {
  return err?.message || t('workbench.flowRail.docsRail.exportFailed')
}
