/** Flow node restart messages (DSK-08). */

import { t } from '../../../i18n/index.js'

export function restartOffsiteBlockedMessage() {
  return t('workbench.flow.restartOffsiteBlocked')
}

export function restartArchiveBlockedMessage() {
  return t('workbench.flow.restartArchiveBlocked')
}

export function flowRailRestartFromHereLabel() {
  return t('workbench.flow.restartFromHere')
}

export function restartFromNodeSuccessMessage({ title, forwardJump, wasArchived, wasOffsite, offsiteArchived }) {
  const suffix = wasArchived
    ? t('workbench.flow.restartSuffixRecovered')
    : wasOffsite || offsiteArchived
      ? t('workbench.flow.restartSuffixOffsiteArchived')
      : ''
  const key = forwardJump ? 'workbench.flow.restartJump' : 'workbench.flow.restartContinue'
  return t(key).replace('{title}', title || '').replace('{suffix}', suffix)
}
