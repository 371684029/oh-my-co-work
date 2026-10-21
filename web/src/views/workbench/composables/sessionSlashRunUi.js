/** Slash command run helpers (FE-01). */

import { t } from '../../../i18n/index.js'

export function slashNeedsUrlPrompt(cmd) {
  return cmd?.kind === 'url' && cmd.promptForUrl
}

export function agentInsertTextFromSlashRun(r, furnaceDisplayName) {
  return r?.insertText || t('workbench.slash.agentInsert').replace('{name}', r?.memberName || furnaceDisplayName)
}

export function slashRunSuccessMessage(r, cmd) {
  return r?.message || t('workbench.slash.executed').replace('{slash}', cmd?.slash || '')
}

export function slashCommandNotFoundMessage(token) {
  return t('workbench.slash.notFound').replace('{token}', token || '')
}
