/** Docs hub navigation from workbench (FE-01 extract from useSessionDetail). */
import {
  buildDocsHubQuery,
  docsHubOpenUsesNewTab,
  formatDocsHubSearchParams,
} from './sessionDocsNavUi.js'

export function createSessionDocsHubActions({ activeId, clearDocsUnread, navigateDocsInApp }) {
  function openDocsHub({ newTab = false, file = 'ANNOUNCEMENT.md' } = {}) {
    const query = buildDocsHubQuery(activeId.value, file)
    if (!query) return
    const useNewTab = docsHubOpenUsesNewTab({
      newTab,
      hasDesktopApi: !!window.__ACW_DESKTOP_API__,
      hasDesktopEnv: !!window.__ACW_DESKTOP_ENV__,
    })
    if (useNewTab) {
      const qs = formatDocsHubSearchParams(query)
      window.open(`/docs?${qs}`, '_blank', 'noopener')
      return
    }
    clearDocsUnread()
    navigateDocsInApp(query)
  }

  return { openDocsHub }
}
