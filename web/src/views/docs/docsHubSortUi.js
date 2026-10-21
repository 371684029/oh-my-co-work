/** DocsHub list sort mode (FE-01). */

export const DOCS_HUB_SORT_KEY = 'acw.docsHubSort'

export function readDocsHubSortMode() {
  try {
    return localStorage.getItem(DOCS_HUB_SORT_KEY) === 'time' ? 'time' : 'group'
  } catch {
    return 'group'
  }
}

export function writeDocsHubSortMode(mode) {
  try {
    localStorage.setItem(DOCS_HUB_SORT_KEY, mode === 'time' ? 'time' : 'group')
  } catch {
    /* ignore */
  }
}

/** @param {(key: string) => string} t */
export function docsHubSortOptions(t) {
  return [
    { label: t('docs.sortByGroup'), value: 'group' },
    { label: t('docs.sortByTime'), value: 'time' },
  ]
}
