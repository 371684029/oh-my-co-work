import fs from 'node:fs'
import path from 'node:path'
import { getScriptWorkDir } from './scriptWorkDir.js'

/**
 * 解析脚本运行 cwd（不用成员/群/会话工作文件夹）
 */
export function resolveCwdForScript(scriptCfg, filePath) {
  if (!scriptCfg || typeof scriptCfg !== 'object') return null
  if (scriptCfg.cwd) return String(scriptCfg.cwd)

  const sw = getScriptWorkDir(scriptCfg)
  if (sw && fs.existsSync(sw)) return path.resolve(sw)

  if (filePath) {
    try {
      const dir = path.dirname(path.resolve(String(filePath)))
      if (fs.existsSync(dir)) return dir
    } catch {
      /* ignore */
    }
  }
  return null
}

/**
 * 解析脚本运行 cwd（非 script 场景遗留；script 请用 resolveCwdForScript）
 */
export function resolveCwd({ member, group, sessionContext, scriptCfg, filePath }) {
  if (scriptCfg) {
    const sw = resolveCwdForScript(scriptCfg, filePath)
    if (sw) return sw
  }
  if (scriptCfg?.cwd) return scriptCfg.cwd

  const workCandidates = [
    member?.work_folder,
    sessionContext?.primaryWorkFolder,
    sessionContext?.workFolders?.[0],
    group?.work_folder,
  ].filter((p) => p && fs.existsSync(String(p)))

  if (filePath) {
    try {
      const abs = path.resolve(String(filePath))
      const dir = path.dirname(abs)
      const underWork = workCandidates.some((w) => {
        const root = path.resolve(String(w))
        const prefix = root.endsWith(path.sep) ? root : root + path.sep
        return abs === root || abs.startsWith(prefix) || dir === root || dir.startsWith(prefix)
      })
      if (underWork && fs.existsSync(dir)) return dir
      if (!underWork && workCandidates[0]) return path.resolve(String(workCandidates[0]))
      if (fs.existsSync(dir)) return dir
    } catch {
      /* ignore */
    }
  }
  if (workCandidates[0]) return path.resolve(String(workCandidates[0]))
  return process.cwd()
}

/**
 * 将配置中的脚本路径解析为绝对路径
 */
export function resolveScriptFilePath(rawPath, { scriptWorkDir, scriptDir } = {}) {
  if (!rawPath || !String(rawPath).trim()) return null
  const p = String(rawPath).trim()
  if (path.isAbsolute(p)) return path.resolve(p)
  const base = getScriptWorkDir({ scriptWorkDir, scriptDir })
  if (!base) return null
  return path.resolve(base, p)
}

/**
 * 从 command 行里抽出「像脚本文件」的片段
 */
export function extractScriptPathFromCommand(command) {
  const s = String(command || '').trim()
  if (!s) return null
  const parts = s.match(/(?:[^\s"'`]+|"[^"]*"|'[^']*')+/g) || []
  const extRe = /\.(mjs|cjs|js|ts|tsx|jsx|bat|cmd|ps1|py|sh)$/i
  for (let i = parts.length - 1; i >= 0; i--) {
    let t = parts[i].replace(/^["']|["']$/g, '').trim()
    if (!t || t.startsWith('-')) continue
    if (extRe.test(t)) return t
  }
  return null
}
