/** Pure list merge for docs cache (testable without api). */

export function patchSessionIntoListData(data, summary) {
  if (!data || !summary) return data
  if (data.sort === 'group') {
    const groups = (data.groups || []).map((g) => {
      const sessions = (g.sessions || []).map((s) =>
        s.sessionId === summary.sessionId ? { ...s, ...summary, files: summary.files } : s,
      )
      const had = (g.sessions || []).some((s) => s.sessionId === summary.sessionId)
      if (!had && summary.groupId === g.groupId) {
        sessions.push(summary)
        sessions.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      }
      return { ...g, sessions }
    })
    return { ...data, groups }
  }
  const items = (data.items || []).filter((i) => i.sessionId !== summary.sessionId)
  for (const f of summary.files || []) {
    items.push({
      sessionId: summary.sessionId,
      sessionTitle: summary.sessionTitle,
      groupTitle: summary.groupTitle,
      name: f.name,
      kind: f.kind,
      title: f.title,
      meta: f.meta,
      mtimeMs: f.mtimeMs,
      size: f.size,
    })
  }
  items.sort((a, b) => b.mtimeMs - a.mtimeMs)
  return { ...data, items }
}
