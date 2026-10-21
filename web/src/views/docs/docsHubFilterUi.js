/** DocsHub sidebar filters (FE-01 pure logic). */

import { t } from '../../i18n/index.js'

export const MS_PER_DAY = 24 * 60 * 60 * 1000

export function docsTimeRangeBuckets(items, now = Date.now()) {
  const allCount = items.length
  const sevenDays = 7 * MS_PER_DAY
  const thirtyDays = 30 * MS_PER_DAY
  let todayCount = 0
  let weekCount = 0
  let monthCount = 0
  let olderCount = 0

  for (const it of items) {
    const diff = now - Number(it.mtimeMs || 0)
    if (diff <= MS_PER_DAY) todayCount++
    if (diff <= sevenDays) weekCount++
    if (diff <= thirtyDays) monthCount++
    if (diff > thirtyDays) olderCount++
  }

  return [
    { key: 'all', label: t('docs.timeRange.all'), icon: '🕒', count: allCount },
    { key: 'today', label: t('docs.timeRange.today'), icon: '⚡', count: todayCount },
    { key: 'week', label: t('docs.timeRange.week'), icon: '📅', count: weekCount },
    { key: 'month', label: t('docs.timeRange.month'), icon: '🗓️', count: monthCount },
    { key: 'older', label: t('docs.timeRange.older'), icon: '📦', count: olderCount },
  ]
}

export function filterDocsItemsByTimeRange(items, rangeKey, now = Date.now()) {
  if (rangeKey === 'all') return items
  const sevenDays = 7 * MS_PER_DAY
  const thirtyDays = 30 * MS_PER_DAY

  return items.filter((it) => {
    const diff = now - Number(it.mtimeMs || 0)
    if (rangeKey === 'today') return diff <= MS_PER_DAY
    if (rangeKey === 'week') return diff <= sevenDays
    if (rangeKey === 'month') return diff <= thirtyDays
    if (rangeKey === 'older') return diff > thirtyDays
    return true
  })
}

export function docsGroupKey(g) {
  return g.groupId || 'none'
}

export function filterDocsGroupsById(groups, selectedGroupId) {
  if (selectedGroupId === 'all') return groups
  return groups.filter((g) => docsGroupKey(g) === selectedGroupId)
}

export function totalDocsSessionCount(groups) {
  return groups.reduce((acc, g) => acc + (g.sessions || []).length, 0)
}
