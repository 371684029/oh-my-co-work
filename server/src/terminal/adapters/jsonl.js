import fs from 'node:fs'
import path from 'node:path'

const EVENT_TYPES = new Set(['message', 'tool.start', 'tool.end', 'question', 'result'])

function asString(v, max = 8000) {
  const s = v == null ? '' : String(v)
  return s.length > max ? s.slice(0, max) : s
}

/**
 * Parse one JSONL line from a trusted sidecar file.
 * Invalid lines never throw; caller should ignore and keep the PTY alive.
 */
export function parseAdapterLine(line) {
  const raw = String(line || '').trim()
  if (!raw) return { skip: true }
  let obj
  try {
    obj = JSON.parse(raw)
  } catch (error) {
    return { error: { code: 'ADAPTER_JSON', message: error.message } }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { error: { code: 'ADAPTER_SCHEMA', message: 'event must be an object' } }
  }
  const type = String(obj.type || '')
  if (!EVENT_TYPES.has(type)) {
    return { error: { code: 'ADAPTER_TYPE', message: `unsupported type ${type || '(empty)'}` } }
  }
  if (type === 'message') {
    const text = asString(obj.text)
    if (!text) return { error: { code: 'ADAPTER_SCHEMA', message: 'message.text required' } }
    const role = obj.role === 'user' ? 'user' : 'assistant'
    return { event: { type, role, text } }
  }
  if (type === 'tool.start') {
    const id = asString(obj.id, 120)
    const name = asString(obj.name, 200)
    if (!id || !name) return { error: { code: 'ADAPTER_SCHEMA', message: 'tool.start needs id and name' } }
    return {
      event: {
        type,
        id,
        name,
        path: obj.path != null ? asString(obj.path, 500) : undefined,
      },
    }
  }
  if (type === 'tool.end') {
    const id = asString(obj.id, 120)
    if (!id) return { error: { code: 'ADAPTER_SCHEMA', message: 'tool.end needs id' } }
    return { event: { type, id, ok: obj.ok !== false, summary: asString(obj.summary, 2000) } }
  }
  if (type === 'question') {
    const id = asString(obj.id, 120)
    const text = asString(obj.text)
    if (!id || !text) return { error: { code: 'ADAPTER_SCHEMA', message: 'question needs id and text' } }
    const choices = Array.isArray(obj.choices)
      ? obj.choices.map((c) => asString(c, 80)).filter(Boolean).slice(0, 8)
      : []
    return { event: { type, id, text, choices } }
  }
  const files = Array.isArray(obj.files)
    ? obj.files.map((f) => asString(f, 500)).filter(Boolean).slice(0, 40)
    : []
  return {
    event: {
      type: 'result',
      summary: asString(obj.summary || obj.text, 4000) || '完成',
      files,
    },
  }
}

export function defaultAdapterPaths(cwd) {
  const root = path.resolve(String(cwd || process.cwd()))
  return {
    eventsPath: path.join(root, '.acw-adapter.events.jsonl'),
    replyPath: path.join(root, '.acw-adapter.reply.jsonl'),
  }
}

/**
 * Poll a sidecar JSONL file. Adapter failures are reported, never thrown.
 */
export function watchJsonlAdapter({ eventsPath, onEvent, onError, intervalMs = 250 } = {}) {
  const file = path.resolve(String(eventsPath || ''))
  if (!file) {
    return () => {}
  }
  let offset = 0
  let carry = ''
  let stopped = false

  const tick = () => {
    if (stopped) return
    try {
      if (!fs.existsSync(file)) return
      const size = fs.statSync(file).size
      if (size < offset) {
        offset = 0
        carry = ''
      }
      if (size === offset) return
      const fd = fs.openSync(file, 'r')
      try {
        const buf = Buffer.alloc(size - offset)
        fs.readSync(fd, buf, 0, buf.length, offset)
        offset = size
        carry += buf.toString('utf8')
      } finally {
        fs.closeSync(fd)
      }
      const lines = carry.split(/\r?\n/)
      carry = lines.pop() || ''
      for (const line of lines) {
        const parsed = parseAdapterLine(line)
        if (parsed.skip) continue
        if (parsed.error) {
          onError?.(parsed.error)
          continue
        }
        try {
          onEvent?.(parsed.event)
        } catch (error) {
          onError?.({ code: 'ADAPTER_HANDLER', message: error?.message || String(error) })
        }
      }
    } catch (error) {
      onError?.({ code: 'ADAPTER_IO', message: error?.message || String(error) })
    }
  }

  const timer = setInterval(tick, Math.max(80, Number(intervalMs) || 250))
  tick()
  return () => {
    stopped = true
    clearInterval(timer)
  }
}

export function appendAdapterReply(replyPath, payload) {
  const file = path.resolve(String(replyPath || ''))
  if (!file) return false
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.appendFileSync(file, `${JSON.stringify(payload)}\n`, 'utf8')
  return true
}
