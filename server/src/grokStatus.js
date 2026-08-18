/**
 * 本机 Grok Build 是否已安装 / 登录 / 写好配置。
 * 不启动 grok 进程（避免弹浏览器）。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { ROOT } from './db.js'
import { GROK_BUILD_INSTALL } from '@acw/shared'

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

function commandOnPath(command) {
  const cmd = String(command || 'grok').trim() || 'grok'
  if (cmd.includes('/') || cmd.includes('\\')) {
    return fs.existsSync(cmd)
  }
  const finder = process.platform === 'win32' ? 'where' : 'which'
  const r = spawnSync(finder, [cmd], { encoding: 'utf8', timeout: 4000 })
  return r.status === 0 && String(r.stdout || '').trim().length > 0
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
