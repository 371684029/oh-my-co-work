const BASE = '/api'

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || res.statusText)
  return data
}

export const api = {
  health: () => req('/health'),
  members: {
    list: () => req('/members'),
    create: (body) => req('/members', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) =>
      req(`/members/${id}`, { method: 'PATCH', body: JSON.stringify(body || {}) }),
    clone: (id, body) => req(`/members/${id}/clone`, { method: 'POST', body: JSON.stringify(body || {}) }),
    remove: (id) => req(`/members/${id}`, { method: 'DELETE' }),
    startSession: (id, body) =>
      req(`/members/${id}/sessions`, { method: 'POST', body: JSON.stringify(body || {}) }),
  },
  groups: {
    list: () => req('/groups'),
    create: (body) => req('/groups', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) =>
      req(`/groups/${id}`, { method: 'PATCH', body: JSON.stringify(body || {}) }),
    clone: (id, body) => req(`/groups/${id}/clone`, { method: 'POST', body: JSON.stringify(body || {}) }),
    remove: (id) => req(`/groups/${id}`, { method: 'DELETE' }),
    startSession: (id, body) =>
      req(`/groups/${id}/sessions`, { method: 'POST', body: JSON.stringify(body || {}) }),
  },
  sessions: {
    list: (status) => req(status ? `/sessions?status=${status}` : '/sessions'),
    get: (id) => req(`/sessions/${id}`),
    rename: (id, title) => req(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
    pin: (id, pinned = true) =>
      req(`/sessions/${id}/pin`, { method: 'POST', body: JSON.stringify({ pinned: !!pinned }) }),
    remove: (id) => req(`/sessions/${id}`, { method: 'DELETE' }),
    archive: (id) => req(`/sessions/${id}/archive`, { method: 'POST', body: '{}' }),
    /** 从节点重新开始：{ nodeInstanceId } 或 { stepIndex } */
    restartFromNode: (id, body) =>
      req(`/sessions/${id}/restart-from-node`, {
        method: 'POST',
        body: JSON.stringify(body || {}),
      }),
    /** 离开场外协助继续主流程：{ nodeInstanceId } */
    continuePastOffsite: (id, body) =>
      req(`/sessions/${id}/continue-past-offsite`, {
        method: 'POST',
        body: JSON.stringify(body || {}),
      }),
    message: (id, text, attachments = []) =>
      req(`/sessions/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text, attachments }),
      }),
    gate: (id, body) => req(`/sessions/${id}/gate`, { method: 'POST', body: JSON.stringify(body) }),
    announcement: (id) => req(`/sessions/${id}/announcement`),
    refreshAnnouncement: (id, body) =>
      req(`/sessions/${id}/announcement/refresh`, {
        method: 'POST',
        body: JSON.stringify(body || {}),
      }),
    /** 系统默认程序打开 ANNOUNCEMENT.md */
    openAnnouncement: (id) =>
      req(`/sessions/${id}/announcement/open`, {
        method: 'POST',
        body: '{}',
      }),
    /** 会话备注（不覆盖自动进度） */
    saveNotes: (id, notes) =>
      req(`/sessions/${id}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ notes: notes ?? '' }),
      }),
    uploadFiles: async (id, fileList) => {
      const fd = new FormData()
      for (const f of fileList) fd.append('files', f)
      const res = await fetch(`${BASE}/sessions/${id}/files`, { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || res.statusText)
      return data
    },
  },
  support: () => req('/support'),
  about: () => req('/about'),
  runtime: () => req('/runtime'),
  heartbeat: () => req('/heartbeat', { method: 'POST', body: '{}' }),
  clientGone: () => req('/client-gone', { method: 'POST', body: '{}' }),
  shutdown: () => req('/shutdown', { method: 'POST', body: '{}' }),
  appSettings: {
    get: () => req('/settings/app'),
    update: (body) =>
      req('/settings/app', { method: 'PATCH', body: JSON.stringify(body || {}) }),
    purgeDemo: () => req('/settings/purge-demo', { method: 'POST', body: '{}' }),
  },
  slashCommands: {
    list: () => req('/slash-commands'),
    save: (commands) =>
      req('/slash-commands', { method: 'PUT', body: JSON.stringify({ commands }) }),
    run: (id, body) =>
      req(`/slash-commands/${id}/run`, {
        method: 'POST',
        body: JSON.stringify(body || {}),
      }),
  },
  /** 本机路径浏览（设置里选文件夹 / 脚本文件） */
  fs: {
    roots: () => req('/fs/roots'),
    list: (dirPath, { mode = 'all', extensions = [] } = {}) => {
      const q = new URLSearchParams()
      q.set('path', dirPath || '')
      q.set('mode', mode)
      if (extensions?.length) q.set('ext', extensions.join(','))
      return req(`/fs/list?${q.toString()}`)
    },
    stat: (p) => req(`/fs/stat?path=${encodeURIComponent(p || '')}`),
  },
}

export function connectSessionWs(sessionId, onEvent) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const url = `${proto}://${location.host}/ws?sessionId=${encodeURIComponent(sessionId)}`
  const ws = new WebSocket(url)
  ws.onmessage = (ev) => {
    try {
      onEvent(JSON.parse(ev.data))
    } catch {
      /* ignore */
    }
  }
  return ws
}
