/** Docs hub / announcement path helpers (FE-01 pure logic). */

export function resolveAnnounceMdRelativePath(detail, activeId) {
  const fromDetail =
    detail?.announcement?.path || detail?.session?.context?.announcementPath || ''
  if (fromDetail) return fromDetail
  if (activeId) return `journals/sessions/${activeId}/ANNOUNCEMENT.md`
  return ''
}

export function buildDocsHubQuery(sessionId, file = 'ANNOUNCEMENT.md') {
  const id = String(sessionId || '').trim()
  if (!id) return null
  return {
    session: id,
    file: String(file || 'ANNOUNCEMENT.md').trim() || 'ANNOUNCEMENT.md',
  }
}

/** Browser tabs vs in-app router (desktop keeps SPA navigation). */
export function docsHubOpenUsesNewTab({ newTab, hasDesktopApi, hasDesktopEnv }) {
  if (newTab) return true
  return !hasDesktopApi && !hasDesktopEnv
}

export function formatDocsHubSearchParams(query) {
  if (!query?.session) return ''
  return new URLSearchParams(query).toString()
}
