import path from 'node:path'
import fs from 'node:fs'
import { getScriptWorkDir } from './scriptWorkDir.js'
import { extractScriptPathFromCommand } from './cwdResolve.js'

function mirrorScriptWorkDirFields(script) {
  if (!script || typeof script !== 'object') return script
  const w = getScriptWorkDir(script)
  if (w) {
    script.scriptWorkDir = w
    script.scriptDir = w
  }
  return script
}

export function usesTerminalExecution(script) {
  return script?.executionMode !== 'pipe'
}

/**
 * 常驻进程：节点启动成功即推进，不等待退出。
 * 内嵌终端默认常驻（grok / CLI / TUI）；显式 waitForExit:true 或 detach:false 才等待退出。
 * 普通执行仅在 detach:true / waitForExit:false 时常驻。
 */
export function usesKeepAlive(script) {
  if (script?.waitForExit === true || script?.detach === false) return false
  if (script?.detach === true || script?.waitForExit === false) return true
  return usesTerminalExecution(script)
}

/**
 * 补全 scriptWorkDir（选脚本 / 命令中的脚本名 / 绝对路径）
 * @param {object} script
 */
export function enrichScriptConfig(script) {
  if (!script || typeof script !== 'object') return script
  const next = { ...script }
  delete next.timeoutMs
  if (next.executionMode !== 'pipe' && next.executionMode !== 'terminal') {
    next.executionMode = 'terminal'
  }
  const raw =
    next.filePath ||
    next.path ||
    next.scriptPath ||
    extractScriptPathFromCommand(next.command)
  if (raw && !next.scriptPath && !next.filePath && !next.path) {
    next.scriptPath = String(raw).trim()
  }

  const existing = getScriptWorkDir(next)
  if (existing && fs.existsSync(existing)) {
    return mirrorScriptWorkDirFields(next)
  }

  if (!raw || !String(raw).trim()) return mirrorScriptWorkDirFields(next)

  const trimmed = String(raw).trim()
  if (path.isAbsolute(trimmed)) {
    if (fs.existsSync(trimmed)) {
      next.scriptWorkDir = path.dirname(path.resolve(trimmed))
    } else {
      const d = path.dirname(path.resolve(trimmed))
      if (fs.existsSync(d)) next.scriptWorkDir = d
    }
    return mirrorScriptWorkDirFields(next)
  }

  const sw = getScriptWorkDir(next)
  if (sw) {
    const abs = path.resolve(sw, trimmed)
    if (fs.existsSync(abs)) {
      next.scriptWorkDir = path.dirname(abs)
    }
  }
  return mirrorScriptWorkDirFields(next)
}
