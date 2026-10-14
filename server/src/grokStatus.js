/**
 * 本机 Grok Build 是否已安装 / 登录 / 写好配置。
 * 不启动 grok 进程（避免弹浏览器）。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ROOT } from './db.js'
import { GROK_BUILD_INSTALL } from '@acw/shared'
import { resolveCommand, resolveCommandSync, runCapture } from './commandResolver.js'

const PLACEHOLDER_KEY = /^(秘钥|your[_-]?key|changeme|xxx)?$/i

export function grokHomeDir() {
  const env = String(process.env.GROK_HOME || '').trim()
  return env || path.join(os.homedir(), '.grok')
}

export function grokExampleConfigPath() {
  return path.join(ROOT, 'server/config/furnace/grok-config.example.toml')
}

export function loadGrokExampleConfig() {
  try {
    return fs.readFileSync(grokExampleConfigPath(), 'utf8')
  } catch {
    return ''
  }
}

/**
 * Sync "is it on PATH" check, delegating to the shared (cached) resolver so
 * probing and launching use the same PATHEXT-aware lookup. Kept synchronous so
 * existing sync callers/tests keep working; async paths use probe*Async.
 */
function commandOnPath(command) {
  const cmd = String(command || 'grok').trim() || 'grok'
  return !!resolveCommandSync(cmd).path
}

function bundledBinary(home) {
  const name = process.platform === 'win32' ? 'grok.exe' : 'grok'
  return path.join(home, 'bin', name)
}

function configLooksFilled(raw) {
  const text = String(raw || '')
  if (!text.trim()) return false
  const keys = [...text.matchAll(/api_key\s*=\s*"([^"]*)"/g)].map((m) => m[1].trim())
  const hasRealKey = keys.some((k) => k && !PLACEHOLDER_KEY.test(k))
  const hasEnvKey = /env_key\s*=/.test(text)
  const hasModels = /\[models\]/.test(text) || /\[model\./.test(text)
  return hasModels && (hasRealKey || hasEnvKey)
}

function authLooksPresent(authPath) {
  if (!fs.existsSync(authPath)) return false
  try {
    const raw = fs.readFileSync(authPath, 'utf8').trim()
    if (!raw) return false
    const j = JSON.parse(raw)
    return !!j && typeof j === 'object' && Object.keys(j).length > 0
  } catch {
    return true
  }
}

const CURSOR_CLI_CANDIDATES = ['cursor-agent', 'agent']

function cursorCandidates(requested) {
  const req = String(requested || '').trim()
  const allowFallback = !req || req === 'cursor' || CURSOR_CLI_CANDIDATES.includes(req)
  const candidates = []
  if (req) candidates.push(req)
  if (allowFallback) {
    for (const name of CURSOR_CLI_CANDIDATES) {
      if (!candidates.includes(name)) candidates.push(name)
    }
  }
  return { candidates, requested: req }
}

/**
 * Sync cursor probe. `loggedIn` stays unknown (always false) here for backward
 * compatibility; call probeCursorStatusAsync for a real login check.
 */
export function probeCursorStatus({ command } = {}) {
  const { candidates, requested } = cursorCandidates(command)
  let resolved = ''
  for (const name of candidates) {
    if (commandOnPath(name)) {
      resolved = name
      break
    }
  }
  const installed = !!resolved
  const gaps = []
  if (!installed) gaps.push('install')
  return {
    installed,
    loggedIn: false,
    loginChecked: false,
    configured: installed,
    ready: installed,
    canRun: installed,
    gaps,
    command: resolved || requested || 'cursor-agent',
    install: 'https://cursor.com/docs/cli/overview',
  }
}

const CURSOR_NOT_LOGGED_IN_RE =
  /not logged in|please log in|login required|unauthorized|not authenticated|sign in|no account/i

/** Bounded async login/readiness probe: run `<cli> status` and read the text. */
async function probeCursorLogin(binPath) {
  if (!binPath) return { loggedIn: false, loginChecked: false }
  const r = await runCapture(binPath, ['status'], 2500)
  if (r.error || r.timeout) return { loggedIn: false, loginChecked: false }
  const text = `${r.stdout || ''}\n${r.stderr || ''}`
  const notLoggedIn = CURSOR_NOT_LOGGED_IN_RE.test(text)
  const loggedIn = !notLoggedIn && (r.code === 0 || text.trim().length > 0)
  return { loggedIn, loginChecked: true }
}

/**
 * Async cursor probe (CLI-04): resolves the CLI via the shared async resolver and
 * actually checks login state so the UI can guide "go log in" instead of letting
 * the user meet the CLI's own error inside the terminal.
 */
export async function probeCursorStatusAsync({ command } = {}) {
  const { candidates, requested } = cursorCandidates(command)
  let resolved = ''
  let resolvedPath = ''
  for (const name of candidates) {
    const r = await resolveCommand(name)
    if (r.path) {
      resolved = name
      resolvedPath = r.path
      break
    }
  }
  const installed = !!resolved
  const { loggedIn, loginChecked } = installed
    ? await probeCursorLogin(resolvedPath)
    : { loggedIn: false, loginChecked: false }
  const gaps = []
  if (!installed) gaps.push('install')
  if (installed && !loggedIn) gaps.push('login')
  return {
    installed,
    loggedIn,
    loginChecked,
    configured: installed,
    ready: installed && loggedIn,
    canRun: installed && loggedIn,
    gaps,
    command: resolved || requested || 'cursor-agent',
    install: 'https://cursor.com/docs/cli/overview',
  }
}

export function probeGrokStatus({ command = 'grok' } = {}) {
  const home = grokHomeDir()
  const configPath = path.join(home, 'config.toml')
  const authPath = path.join(home, 'auth.json')
  const binPath = bundledBinary(home)
  const installed = commandOnPath(command) || fs.existsSync(binPath)
  let hasConfigFile = fs.existsSync(configPath)
  let configRaw = ''
  if (hasConfigFile) {
    try {
      configRaw = fs.readFileSync(configPath, 'utf8')
    } catch {
      hasConfigFile = false
    }
  }
  const hasProviderKey = hasConfigFile && configLooksFilled(configRaw)
  const configured = hasProviderKey
  const hasAuth = authLooksPresent(authPath)
  const hasEnvKey = !!String(process.env.XAI_API_KEY || '').trim()
  const loggedIn = hasAuth || hasEnvKey || hasProviderKey
  const gaps = []
  if (!installed) gaps.push('install')
  if (!loggedIn) gaps.push('login')
  if (!configured) gaps.push('config')
  return {
    installed,
    loggedIn,
    configured,
    hasConfigFile,
    hasAuth,
    ready: installed && loggedIn && configured,
    canRun: installed && loggedIn,
    gaps,
    home,
    configPath,
    authPath,
    command: String(command || 'grok').trim() || 'grok',
    install: GROK_BUILD_INSTALL,
  }
}

/** Async grok probe: same shape, but resolves the command via the cached async resolver. */
export async function probeGrokStatusAsync({ command = 'grok' } = {}) {
  const home = grokHomeDir()
  const configPath = path.join(home, 'config.toml')
  const authPath = path.join(home, 'auth.json')
  const binPath = bundledBinary(home)
  const resolved = await resolveCommand(command)
  const installed = !!resolved.path || fs.existsSync(binPath)
  let hasConfigFile = fs.existsSync(configPath)
  let configRaw = ''
  if (hasConfigFile) {
    try {
      configRaw = fs.readFileSync(configPath, 'utf8')
    } catch {
      hasConfigFile = false
    }
  }
  const hasProviderKey = hasConfigFile && configLooksFilled(configRaw)
  const configured = hasProviderKey
  const hasAuth = authLooksPresent(authPath)
  const hasEnvKey = !!String(process.env.XAI_API_KEY || '').trim()
  const loggedIn = hasAuth || hasEnvKey || hasProviderKey
  const gaps = []
  if (!installed) gaps.push('install')
  if (!loggedIn) gaps.push('login')
  if (!configured) gaps.push('config')
  return {
    installed,
    loggedIn,
    configured,
    hasConfigFile,
    hasAuth,
    ready: installed && loggedIn && configured,
    canRun: installed && loggedIn,
    gaps,
    home,
    configPath,
    authPath,
    command: String(command || 'grok').trim() || 'grok',
    install: GROK_BUILD_INSTALL,
  }
}
