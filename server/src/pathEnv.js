/**
 * GUI-launched processes often miss login-shell PATH (5.1.0 CLI-02).
 * Augment PATH once at server boot with common CLI install locations.
 */
import os from 'node:os'
import path from 'node:path'

const EXTRA_DIRS = [
  path.join(os.homedir(), '.local', 'bin'),
  path.join(os.homedir(), '.cursor', 'bin'),
  path.join(os.homedir(), 'bin'),
  '/opt/homebrew/bin',
  '/usr/local/bin',
]

export function augmentPathForGuiLaunch(env = process.env) {
  const sep = path.delimiter
  const current = String(env.PATH || env.Path || '')
  const parts = current.split(sep).filter(Boolean)
  const set = new Set(parts.map((p) => path.normalize(p)))
  for (const dir of EXTRA_DIRS) {
    const n = path.normalize(dir)
    if (!set.has(n)) {
      parts.push(dir)
      set.add(n)
    }
  }
  const next = parts.join(sep)
  return { ...env, PATH: next, Path: next }
}

export function applyAugmentedPath() {
  const next = augmentPathForGuiLaunch(process.env)
  process.env.PATH = next.PATH
  if (process.platform === 'win32') process.env.Path = next.PATH
}
