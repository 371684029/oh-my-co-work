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

export function docsFileKindLabel(kind) {
  if (kind === 'announce') return t('docs.file.announceKind')
  if (kind === 'index') return t('docs.file.indexKind')
  if (kind === 'step') return t('docs.file.stepLedgerGeneric')
  if (kind === 'furnace') return t('docs.file.furnaceKind')
  return ''
}

/** 正文区主标题：群报告按群聊名（名片「名称」）展示，不写 ANNOUNCEMENT.md */
export function docsHubPrimaryTitle(file, session = null) {
  const kind = file?.kind
  const isAnnounce = kind === 'announce' || file?.name === 'ANNOUNCEMENT.md'
  if (isAnnounce) {
    const groupTitle = String(session?.groupTitle || file?.groupTitle || '').trim()
    if (groupTitle && groupTitle !== '未分组') return groupTitle
    const sessionTitle = String(session?.sessionTitle || file?.sessionTitle || '').trim()
    if (sessionTitle) return sessionTitle
  }
  return docsFileLabel(file)
}

/** 副标题：类型 + 文件名 */
export function docsHubFileSubtitle(file) {
  const name = String(file?.name || '').trim()
  const kindLabel = docsFileKindLabel(file?.kind)
  if (kindLabel && name) return `${kindLabel} · ${name}`
  return kindLabel || name || ''
}

/** 按时间视图 / 最近打开：群报告优先群聊名，其余优先会话名 */
export function docsHubListItemLabel(item) {
  const kind = item?.kind
  const isAnnounce = kind === 'announce' || item?.name === 'ANNOUNCEMENT.md'
  const groupTitle = String(item?.groupTitle || '').trim()
  const sessionTitle = String(item?.sessionTitle || '').trim()
  if (isAnnounce) {
    if (groupTitle && groupTitle !== '未分组') return groupTitle
    if (sessionTitle) return sessionTitle
  }
  if (sessionTitle) {
    const kindLabel = docsFileKindLabel(kind)
    if (kindLabel) return `${sessionTitle} · ${kindLabel}`
    return sessionTitle
  }
  return docsFileLabel(item)
}

export function docsFileLabel(f) {
  if (f?.kind === 'step') {
    const m = /step-(\d{2})/.exec(f.name || '')
    if (m) {
      return t('docs.file.stepLedger').replace('{step}', m[1])
    }
    return t('docs.file.stepLedgerGeneric')
  }
  if (f?.kind === 'announce') return t('docs.file.announceKind')
  if (f?.kind === 'index') return t('docs.file.indexKind')
  if (f?.kind === 'furnace') return t('docs.file.furnaceKind')
  return f?.title || f?.name || ''
}

export function docsKindTag(kind) {
  if (kind === 'announce') return 'primary'
  if (kind === 'step') return 'success'
  return 'info'
}
