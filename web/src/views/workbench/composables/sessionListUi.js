import { abbrGroupTag, formatSessionAutoTitle } from '@acw/shared'

/** 会话列表：#1 正文 + 群模板缩写标签；hover 气泡展示全文（前缀 + 群全称） */
export function sessionListParts(s) {
  const ctx = s?.context && typeof s.context === 'object' ? s.context : {}
  const groupTitle = String(s.groupTitle || ctx.groupTitle || '').trim()
  const abbr = s.groupTitleAbbr || ctx.groupTitleAbbr || abbrGroupTag(groupTitle)

  if (ctx.titleAuto === false && s.title) {
    const full = String(s.title).trim()
    return {
      label: full,
      labelPrefix: full,
      groupAbbr: '',
      hoverTitle: full,
    }
  }

  const p1 = String(
    (Array.isArray(ctx.paramsList) && ctx.paramsList[0]) ||
      ctx.params?.['#1'] ||
      '',
  ).trim()
  const groupAbbr = abbr || ''
  const labelPrefix = p1
  const label =
    formatSessionAutoTitle({
      param1: p1,
      groupTitle,
      groupTitleAbbr: groupAbbr,
    }) ||
    s.title ||
    groupTitle ||
    '未命名'

  let hoverTitle = ''
  if (p1 && groupTitle) hoverTitle = `${p1} · ${groupTitle}`
  else if (groupTitle) hoverTitle = groupTitle
  else if (p1) hoverTitle = p1
  else hoverTitle = String(s.title || label || '').trim()

  return {
    label,
    labelPrefix,
    groupAbbr,
    hoverTitle,
  }
}

/** 相对时间：最小 h，最大 w；已归档返回空 */
export function relativeSessionTime(isoOrTs, nowMs = Date.now()) {
  if (!isoOrTs) return ''
  const t = new Date(isoOrTs).getTime()
  if (!t || Number.isNaN(t)) return ''
  const diffMs = nowMs - t
  if (diffMs < 0) return ''
  const mins = Math.floor(diffMs / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  return `${weeks}w`
}

/**
 * 归档结果：success | failed | null
 */
/** Element-Plus-X Conversations 菜单（key + command 必填） */
export const CONVERSATION_MENU = [
  { label: '置顶', key: 'pin', command: 'pin' },
  { label: '取消置顶', key: 'unpin', command: 'unpin' },
  { label: '重命名', key: 'rename', command: 'rename' },
  {
    label: '删除',
    key: 'delete',
    command: 'delete',
    divided: true,
    menuItemHoverStyle: {
      color: 'red',
      backgroundColor: 'rgba(255, 0, 0, 0.1)',
    },
  },
]

export function filterSessionsByListFilter(sessions, listFilter) {
  const list = Array.isArray(sessions) ? sessions : []
  if (listFilter === 'all') return list.slice()
  if (listFilter === 'archived') return list.filter((s) => s.status === 'archived')
  return list.filter((s) => s.status !== 'archived')
}

/** 群模板块在前、置顶优先、更新时间降序 */
export function sortSessionsForSidebar(list) {
  return list.slice().sort((a, b) => {
    const am = a.adhoc ? 1 : 0
    const bm = b.adhoc ? 1 : 0
    if (am !== bm) return am - bm
    const pa = a.pinned ? 1 : 0
    const pb = b.pinned ? 1 : 0
    if (pb !== pa) return pb - pa
    return String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
  })
}

export function buildConversationItems(sessions, listFilter, nowMs = Date.now()) {
  const filtered = sortSessionsForSidebar(filterSessionsByListFilter(sessions, listFilter))
  return filtered.map((s) => {
    const outcome = archiveOutcomeOf(s)
    const parts = sessionListParts(s)
    return {
      uniqueKey: s.id,
      label: parts.label,
      labelPrefix: parts.labelPrefix,
      groupAbbr: parts.groupAbbr,
      group: s.adhoc ? '成员' : '群模板',
      id: s.id,
      status: s.status,
      title: s.title,
      hoverTitle: parts.hoverTitle,
      pinned: !!s.pinned,
      archiveOutcome: outcome,
      adhoc: !!s.adhoc,
      timeLabel: ['archived'].includes(s.status) ? '' : relativeSessionTime(s.updated_at, nowMs),
    }
  })
}

export function archiveOutcomeOf(session, nodes) {
  if (!session || session.status !== 'archived') return null
  const r = String(session.archive_reason || '').toLowerCase()
  if (['failed', 'rejected', 'error', 'fail'].includes(r)) return 'failed'
  if (Array.isArray(nodes) && nodes.some((n) => n.status === 'failed')) return 'failed'
  return 'success'
}
