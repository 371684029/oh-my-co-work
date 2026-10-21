/**
 * Local usage & timing stats (5.3.0 TRC-05).
 */
import fs from 'node:fs'
import path from 'node:path'
import { getDb, DATA_ROOT } from './db.js'

function durationMs(start, end) {
  if (!start || !end) return null
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null
  return b - a
}

function dirSizeBytes(root, depth = 4) {
  let total = 0
  function walk(p, d) {
    if (d > depth) return
    let entries
    try {
      entries = fs.readdirSync(p, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      const full = path.join(p, ent.name)
      try {
        if (ent.isDirectory()) walk(full, d + 1)
        else total += fs.statSync(full).size
      } catch {
        /* ignore */
      }
    }
  }
  walk(root, 0)
  return total
}

export function collectUsageStats() {
  const db = getDb()
  const nodes = db
    .prepare(
      `SELECT ni.*, m.display_name AS member_name, m.id AS member_ref
       FROM node_instances ni
       LEFT JOIN members m ON m.id = ni.member_id
       WHERE ni.started_at IS NOT NULL AND ni.finished_at IS NOT NULL`,
    )
    .all()

  const byMember = new Map()
  let totalNodeMs = 0
  let failedNodes = 0
  for (const n of nodes) {
    const ms = durationMs(n.started_at, n.finished_at)
    if (ms == null) continue
    totalNodeMs += ms
    if (n.status === 'failed') failedNodes += 1
    const key = n.member_ref || n.member_id || '_unknown'
    const hit = byMember.get(key) || {
      memberId: n.member_ref || n.member_id,
      name: n.member_name || '未知',
      runs: 0,
      failed: 0,
      totalMs: 0,
    }
    hit.runs += 1
    hit.totalMs += ms
    if (n.status === 'failed') hit.failed += 1
    byMember.set(key, hit)
  }

  const terminals = db
    .prepare(
      `SELECT started_at, finished_at, exit_code FROM terminal_sessions WHERE started_at IS NOT NULL`,
    )
    .all()
  let terminalMs = 0
  let terminalFailed = 0
  for (const t of terminals) {
    const ms = durationMs(t.started_at, t.finished_at)
    if (ms != null) terminalMs += ms
    if (t.exit_code != null && Number(t.exit_code) !== 0) terminalFailed += 1
  }

  const sessions = db.prepare(`SELECT status FROM sessions`).all()
  const sessionCounts = { total: sessions.length, archived: 0, active: 0, failed: 0 }
  for (const s of sessions) {
    if (s.status === 'archived') sessionCounts.archived += 1
    else if (s.status === 'failed') sessionCounts.failed += 1
    else sessionCounts.active += 1
  }

  const logsDir = path.join(DATA_ROOT, 'logs')
  const logBytes = fs.existsSync(logsDir) ? dirSizeBytes(logsDir, 3) : 0

  const memberStats = [...byMember.values()]
    .map((m) => ({
      ...m,
      avgMs: m.runs ? Math.round(m.totalMs / m.runs) : 0,
      failRate: m.runs ? Math.round((m.failed / m.runs) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.totalMs - a.totalMs)

  return {
    collectedAt: new Date().toISOString(),
    sessions: sessionCounts,
    nodes: {
      measured: nodes.length,
      failed: failedNodes,
      totalHours: Math.round((totalNodeMs / 3_600_000) * 10) / 10,
    },
    terminals: {
      runs: terminals.length,
      failed: terminalFailed,
      totalHours: Math.round((terminalMs / 3_600_000) * 10) / 10,
    },
    storage: {
      logMiB: Math.round((logBytes / (1024 * 1024)) * 10) / 10,
    },
    byMember: memberStats.slice(0, 40),
  }
}
