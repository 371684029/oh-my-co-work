/** Pure doc-link resolution for the FlowRail docs pane (FE-01 extract from FlowRail.vue). */

const DOC_NAME_RE = /^(ANNOUNCEMENT\.md|README\.md|nodes\/step-\d{2}-[A-Za-z0-9_-]+\.md)$/

export function flowRailResolveDocLink(href, sessionId) {
  const raw = String(href || '').trim()
  if (!raw || !sessionId) return null
  let sid = sessionId
  let rest = raw
  const abs = raw.match(/^\/journals\/sessions\/([^/]+)\/(.+)$/)
  if (abs) {
    sid = abs[1]
    rest = abs[2]
  } else {
    rest = raw.replace(/^\.\//, '')
  }
  if (sid !== sessionId) return null
  let name = rest.replace(/\\/g, '/')
  if (/^step-\d{2}-[A-Za-z0-9_-]+\.md$/.test(name)) name = `nodes/${name}`
  if (!DOC_NAME_RE.test(name)) return null
  return { sessionId: sid, name }
}
