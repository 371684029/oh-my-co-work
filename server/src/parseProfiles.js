/**
 * Agent output parse profiles + golden samples (5.3.0 EXT-02).
 */
import fs from 'node:fs'
import path from 'node:path'
import { DATA_ROOT } from './db.js'
import { nowIso, uid } from '@acw/shared'

const PROFILES = [
  {
    id: 'grok',
    displayName: 'Grok TUI',
    description: 'Plain terminal lines; tool hints in brackets.',
    lineMode: 'plain',
    hints: ['Prefer jsonl adapter when events file is available.'],
  },
  {
    id: 'cursor',
    displayName: 'Cursor CLI',
    description: 'Stream/jsonl events; bracketed paste for large payloads.',
    lineMode: 'jsonl',
    hints: ['Use structured adapter path from agent registry.'],
  },
  {
    id: 'generic-cli',
    displayName: 'Generic CLI',
    description: 'Fallback: treat output as plain text blocks.',
    lineMode: 'plain',
    hints: ['Add custom regex rules in a future profile editor.'],
  },
]

function samplesDir() {
  const d = path.join(DATA_ROOT, 'parse-samples')
  fs.mkdirSync(d, { recursive: true })
  return d
}

export function listParseProfiles() {
  return PROFILES.map((p) => ({ ...p }))
}

export function listParseSamples(agentId, { limit = 50 } = {}) {
  const file = path.join(samplesDir(), `${String(agentId || 'unknown').replace(/[^\w.-]/g, '_')}.jsonl`)
  if (!fs.existsSync(file)) return []
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean)
  const slice = lines.slice(-limit)
  return slice.map((line) => {
    try {
      return JSON.parse(line)
    } catch {
      return { id: 'bad', raw: line }
    }
  })
}

export function recordParseSample({ agentId, raw, parsed, note }) {
  const id = uid('ps')
  const entry = {
    id,
    agentId: String(agentId || 'generic-cli'),
    raw: String(raw || '').slice(0, 200_000),
    parsed: parsed && typeof parsed === 'object' ? parsed : { lines: String(raw || '').split('\n').length },
    note: note ? String(note).slice(0, 500) : '',
    createdAt: nowIso(),
  }
  const file = path.join(samplesDir(), `${entry.agentId.replace(/[^\w.-]/g, '_')}.jsonl`)
  fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, 'utf8')
  return entry
}
