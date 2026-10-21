/** DocsHub session/file status labels (FE-01 pure logic). */

import { t } from '../../i18n/index.js'

export function docsSessionStatusLabel(s) {
  const key = String(s || '')
  const map = {
    active: 'docs.status.active',
    running: 'docs.status.running',
    waiting_human: 'docs.status.waitingHuman',
    interrupted: 'docs.status.interrupted',
    archived: 'docs.status.archived',
    failed: 'docs.status.failed',
    paused: 'docs.status.paused',
  }
  if (map[key]) return t(map[key])
  return key || t('docs.status.unknown')
}

export function docsSessionStatusClass(s) {
  if (s === 'archived') return 'archived'
  if (s === 'waiting_human' || s === 'failed') return 'waiting'
  if (s === 'interrupted' || s === 'paused') return 'interrupted'
  return 'active'
}

export function docsFileLabel(f) {
  if (f?.kind === 'step') {
    const m = /step-(\d{2})/.exec(f.name || '')
    if (m) {
      return t('docs.file.stepLedger').replace('{step}', m[1])
    }
    return t('docs.file.stepLedgerGeneric')
  }
  return f?.title || f?.name || ''
}

export function docsKindTag(kind) {
  if (kind === 'announce') return 'primary'
  if (kind === 'step') return 'success'
  return 'info'
}
