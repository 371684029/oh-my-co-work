/**
 * Unified command resolver: locate a bare command name on PATH without blocking
 * the event loop, with a short TTL cache.
 *
 * On Windows it understands PATHEXT so a bare name like `grok` resolves to
 * `grok.cmd` / `grok.exe` instead of an extensionless shell shim — the shim
 * cannot be spawned by node-pty (see resolveWindowsExecutable in terminalService).
 * Shared by terminalService and grokStatus so "is it installed" and "launch it"
 * agree on the same executable. (5.1.0 CLI-01 / CLI-03.)
 */
import fs from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'

const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD;.VBS;.JS;.WS;.MSC'
const CACHE_TTL_MS = 30_000
const cache = new Map() // `${platform}:${command}` -> { at, value }

function kindForExt(ext) {
  switch (String(ext || '').toLowerCase()) {
    case '.exe':
    case '.com':
      return 'exe'
    case '.cmd':
      return 'cmd'
    case '.bat':
      return 'bat'
    case '.ps1':
      return 'ps1'
    default:
      return 'bin'
  }
}

function extOf(p) {
  const m = /(\.[a-z0-9]+)$/i.exec(String(p || ''))
  return m ? m[1] : ''
}

export function guessKind(p) {
  return kindForExt(extOf(p))
}

function isPathLike(cmd) {
  return cmd.includes('/') || cmd.includes('\\')
}

/**
 * Pick the best Windows match from `where` output. Prefer `.exe`/`.com`, then
 * `.cmd`/`.bat`, then `.ps1`; ignore extensionless shims when any PATHEXT entry
 * matches; fall back to the first non-empty line when nothing matches.
 * Exported for tests (pure).
 */
export function pickWindowsMatch(stdout, pathext) {
  const exts = String(pathext || DEFAULT_PATHEXT)
    .split(';')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
  const lines = String(stdout || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return { path: null, kind: null }
  const rank = (line) => {
    const ext = extOf(line).toLowerCase()
    if (!ext || !exts.includes(ext)) return 99
    if (ext === '.exe' || ext === '.com') return 0
    if (ext === '.cmd' || ext === '.bat') return 1
    if (ext === '.ps1') return 2
    return 3
  }
  const scored = lines.map((line, i) => ({ line, r: rank(line), i }))
  const matching = scored.filter((s) => s.r < 99)
  const best =
    matching.length > 0
      ? matching.sort((a, b) => a.r - b.r || a.i - b.i)[0].line
      : lines[0]
  return { path: best, kind: kindForExt(extOf(best)) }
}

/**
 * Run a capture command (e.g. `where`/`which`/`<cli> status`) asynchronously.
 * Never throws; resolves to `{ code, stdout, stderr, error?, timeout? }`.
 */
export function runCapture(file, args, timeoutMs = 3000) {
  return new Promise((resolve) => {
    let done = false
    const finish = (v) => {
      if (done) return
      done = true
      resolve(v)
    }
    let child
    try {
      child = spawn(file, args, { windowsHide: true })
    } catch {
      finish({ code: -1, stdout: '', stderr: '', error: true })
      return
    }
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      try {
        child.kill()
      } catch {
        /* ignore */
      }
      finish({ code: -1, stdout, stderr, timeout: true })
    }, Math.max(200, Number(timeoutMs) || 3000))
    child.stdout?.on('data', (d) => {
      stdout += d
    })
    child.stderr?.on('data', (d) => {
      stderr += d
    })
    child.on('error', () => {
      clearTimeout(timer)
      finish({ code: -1, stdout, stderr, error: true })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      finish({ code: code ?? -1, stdout, stderr })
    })
  })
}

function fromWindows(stdout, env) {
  const picked = pickWindowsMatch(stdout, env?.PATHEXT)
  return picked.path
    ? { path: picked.path, kind: picked.kind, source: 'path' }
    : { path: null, kind: null, source: 'none' }
}

function firstPosixLine(stdout) {
  return String(stdout || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)[0]
}

export async function resolveCommand(
  command,
  { platform = process.platform, timeoutMs = 1500, env = process.env } = {},
) {
  const cmd = String(command || '').trim()
  if (!cmd) return { path: null, kind: null, source: 'none' }
  const key = `${platform}:${cmd}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value

  let value
  if (isPathLike(cmd)) {
    try {
      await fs.promises.access(cmd)
      value = { path: cmd, kind: guessKind(cmd), source: 'literal' }
    } catch {
      value = { path: null, kind: null, source: 'none' }
    }
  } else {
    const finder = platform === 'win32' ? 'where' : 'which'
    const r = await runCapture(finder, [cmd], timeoutMs)
    if (r.code === 0 && String(r.stdout || '').trim()) {
      if (platform === 'win32') {
        value = fromWindows(r.stdout, env)
      } else {
        const first = firstPosixLine(r.stdout)
        value = first ? { path: first, kind: 'bin', source: 'path' } : { path: null, kind: null, source: 'none' }
      }
    } else {
      value = { path: null, kind: null, source: 'none' }
    }
  }
  cache.set(key, { at: Date.now(), value })
  return value
}

/**
 * Synchronous variant for callers that must stay sync (existing probes).
 * Same selection logic; keep usage bounded.
 */
export function resolveCommandSync(
  command,
  { platform = process.platform, timeoutMs = 1500, env = process.env } = {},
) {
  const cmd = String(command || '').trim()
  if (!cmd) return { path: null, kind: null, source: 'none' }
  const key = `${platform}:${cmd}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value

  let value
  if (isPathLike(cmd)) {
    value = fs.existsSync(cmd)
      ? { path: cmd, kind: guessKind(cmd), source: 'literal' }
      : { path: null, kind: null, source: 'none' }
  } else {
    const finder = platform === 'win32' ? 'where' : 'which'
    try {
      const r = spawnSync(finder, [cmd], { encoding: 'utf8', timeout: timeoutMs, windowsHide: true })
      if (r?.status === 0 && String(r.stdout || '').trim()) {
        if (platform === 'win32') {
          value = fromWindows(r.stdout, env)
        } else {
          const first = firstPosixLine(r.stdout)
          value = first ? { path: first, kind: 'bin', source: 'path' } : { path: null, kind: null, source: 'none' }
        }
      } else {
        value = { path: null, kind: null, source: 'none' }
      }
    } catch {
      value = { path: null, kind: null, source: 'none' }
    }
  }
  cache.set(key, { at: Date.now(), value })
  return value
}

export function invalidateCommandCache() {
  cache.clear()
}
