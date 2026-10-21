import { spawnSync } from 'node:child_process'
import { pickWindowsMatch } from '../commandResolver.js'

/**
 * 很多全局 CLI（grok、npm 装的工具等）在 Windows 上其实是 grok.exe / xxx.cmd，
 * 裸名 "grok" 直接扔给 pty.spawn（shell:false）会报 "File not found: "——
 * JS 侧 `where grok` 却能找到，两边判断不一致。这里在真正 spawn 前，用同一套
 * `where` 解析出带扩展名的绝对路径，node-pty 收到绝对路径就不会走那段裸名搜索。
 */
const WINDOWS_WHERE_TIMEOUT_MS = 1500

export function resolveWindowsExecutable(cmd, { platform = process.platform, run = spawnSync } = {}) {
  if (platform !== 'win32') return cmd
  const raw = String(cmd || '').trim()
  if (!raw || raw.includes('/') || raw.includes('\\')) return cmd
  try {
    const r = run('where', [raw], { encoding: 'utf8', timeout: WINDOWS_WHERE_TIMEOUT_MS })
    if (r?.status === 0) {
      const picked = pickWindowsMatch(r.stdout, process.env.PATHEXT)
      if (picked.path) return picked.path
    }
  } catch {
    /* 找不到就保留原样，交给 pty 报错，不掩盖问题 */
  }
  return cmd
}

export function normalizePtyLaunch(
  launch,
  { platform = process.platform, resolveExecutable = resolveWindowsExecutable } = {},
) {
  if (launch?.shell !== true) {
    return { file: resolveExecutable(launch.cmd, { platform }), args: launch.args || [] }
  }
  if (platform === 'win32') {
    return {
      file: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', String(launch.cmd || '')],
    }
  }
  return {
    file: process.env.SHELL || '/bin/sh',
    args: ['-lc', String(launch.cmd || '')],
  }
}
