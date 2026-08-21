const BASE = '/api'
let accessTokenPromise = null

async function accessToken({ refresh = false } = {}) {
  if (refresh || !accessTokenPromise) {
    accessTokenPromise = fetch(`${BASE}/bootstrap`, {
      method: 'POST',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.token) throw new Error(data.error || '无法建立本地安全连接')
        return data.token
      })
      .catch((error) => {
        accessTokenPromise = null
        throw error
      })
  }
  return accessTokenPromise
}

async function req(path, options = {}) {
  const token = await accessToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-ACW-Token': token,
      ...(options.headers || {}),
    },
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
    remove: (id) => req(`/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    archive: (id) => req(`/sessions/${id}/archive`, { method: 'POST', body: '{}' }),
    /** 恢复：仍在本会话，可无限归档 */
    unarchive: (id) => req(`/sessions/${id}/unarchive`, { method: 'POST', body: '{}' }),
    terminals: (id) => req(`/sessions/${id}/terminals`),
    killTerminal: (id, terminalId) =>
      req(`/sessions/${id}/terminals/${terminalId}/kill`, {
        method: 'POST',
        body: '{}',
      }),
    closeFurnace: (id) => req(`/sessions/${id}/furnace/close`, { method: 'POST', body: '{}' }),
    reopenFurnace: (id) => req(`/sessions/${id}/furnace/reopen`, { method: 'POST', body: '{}' }),
    downloadTerminalLog: async (id, terminalId) => {
      const token = await accessToken()
      const res = await fetch(`${BASE}/sessions/${id}/terminals/${terminalId}/log`, {
        headers: { 'X-ACW-Token': token },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || res.statusText)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `terminal_${terminalId}.log`
      a.click()
      URL.revokeObjectURL(url)
    },
    /** 从节点重开：统一追加克隆；{ nodeInstanceId } 或 { stepIndex } */
    restartFromNode: (id, body) =>
      req(`/sessions/${id}/restart-from-node`, {
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
      const token = await accessToken()
      const res = await fetch(`${BASE}/sessions/${id}/files`, {
        method: 'POST',
        headers: { 'X-ACW-Token': token },
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || res.statusText)
      return data
    },
    uploadFurnaceFiles: async (id, fileList) => {
      const fd = new FormData()
      for (const f of fileList) fd.append('files', f)
      const token = await accessToken()
      const res = await fetch(`${BASE}/sessions/${id}/furnace-files`, {
        method: 'POST',
        headers: { 'X-ACW-Token': token },
        body: fd,
      })
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
  grok: {
    status: () => req('/grok/status'),
  },
  furnace: {
    prepare: (body) =>
      req('/furnace/prepare', { method: 'POST', body: JSON.stringify(body || {}) }),
  },
  appSettings: {
    get: () => req('/settings/app'),
    update: (body) =>
      req('/settings/app', { method: 'PATCH', body: JSON.stringify(body || {}) }),
    purgeDemo: () => req('/settings/purge-demo', { method: 'POST', body: '{}' }),
  },
  resources: {
    list: () => req('/resources'),
    release: (sessionIds = []) =>
      req('/resources/release', {
        method: 'POST',
        body: JSON.stringify({ sessionIds }),
      }),
  },
  backup: () => req('/backup', { method: 'POST', body: '{}' }),
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

export function connectSessionWs(sessionId, onEvent, { onOpen, onStatus } = {}) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  let socket = null
  let reconnectTimer = null
  let stopped = false
  let attempt = 0

  const client = {
    get readyState() {
      return socket?.readyState ?? WebSocket.CONNECTING
    },
    send(data) {
      if (socket?.readyState !== WebSocket.OPEN) return false
      socket.send(data)
      return true
    },
    close() {
      stopped = true
      window.clearTimeout(reconnectTimer)
      reconnectTimer = null
      socket?.close()
      socket = null
    },
  }

  async function connect() {
    try {
      const token = await accessToken({ refresh: attempt > 0 })
      if (stopped) return
      const query = new URLSearchParams({ sessionId, token })
      socket = new WebSocket(`${proto}://${location.host}/ws?${query}`)
      onStatus?.('connecting')
      socket.onopen = () => {
        attempt = 0
        onStatus?.('open')
        onOpen?.(client)
      }
      socket.onmessage = (ev) => {
        try {
          onEvent(JSON.parse(ev.data))
        } catch {
          /* ignore malformed server event */
        }
      }
      socket.onerror = () => onStatus?.('error')
      socket.onclose = () => {
        socket = null
        if (stopped) return
        onStatus?.('closed')
        const delay = Math.min(5000, 300 * 2 ** Math.min(attempt++, 4))
        reconnectTimer = window.setTimeout(connect, delay)
      }
    } catch {
      if (stopped) return
      onStatus?.('error')
      const delay = Math.min(5000, 300 * 2 ** Math.min(attempt++, 4))
      reconnectTimer = window.setTimeout(connect, delay)
    }
  }

  connect()
  return client
}
