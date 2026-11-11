/**
 * 精确剥离炼化契约块（还原无 zip 时、或 bat 契约占位修复）。
 */
import { REFINE_ARGV_SYNC_MARK } from './refineArgvSync.js'

export const REFINE_MARK = 'ACW-REFINE'

function isEmptyLine(line) {
  return !String(line || '').trim()
}

/** 炼化插入行（不含用户业务代码） */
export function isRefineContractLine(line) {
  const t = String(line || '').trim()
  if (!t) return true
  if (t.includes(REFINE_MARK)) return true
  if (/^rem\s/i.test(t) || /^::/.test(t)) {
    return /ACW|REFINE|炼化/i.test(t)
  }
  if (/^#\s/.test(t) && t.includes(REFINE_MARK)) return true
  if (/^\/\//.test(t) && t.includes(REFINE_MARK)) return true
  if (/^if not defined ACW_/i.test(t)) return true
  if (/^if \(!process\.env\.ACW_/i.test(t)) return true
  if (/^if \(!process\.env\.ACW_HUMAN_INPUT\)/.test(t)) return true
  if (/^console\.log\(\s*["']###/.test(t)) return true
  if (/^echo ###/.test(t) || /^echo\.$|^echo$/i.test(t)) return true
  if (/^Write-Output\s+["']###/.test(t)) return true
  if (/^print\(\s*["']###/.test(t)) return true
  if (/^import os as _acw_os/.test(t)) return true
  if (/^_acw_os\.environ\.setdefault/.test(t)) return true
  if (/^:\s*"\$\{ACW_PARAM_/.test(t)) return true
  if (/^:\s*"\$\{ACW_HUMAN_INPUT/.test(t)) return true
  if (t.includes(REFINE_ARGV_SYNC_MARK)) return true
  if (/^\s*(const |let |for |if |try |process\.argv|list\.)/.test(t) && t.includes('ACW_')) {
    return true
  }
  if (/^\s*\}\)\(\)\s*$/.test(t)) return true
  if (/^\s*;\(function\s+acwSyncArgvFromEnv/.test(t)) return true
  return false
}

/** @returns {{ text: string, nl: string, removed: boolean }} */
export function stripRefineContractText(text) {
  const src = String(text ?? '')
  if (!src.includes(REFINE_MARK)) {
    const nl = src.includes('\r\n') ? '\r\n' : '\n'
    return { text: src, nl, removed: false }
  }
  const nl = src.includes('\r\n') ? '\r\n' : '\n'
  const lines = src.split(/\r?\n/)
  const out = []
  let skipping = false
  let removed = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!skipping) {
      if (line.includes(REFINE_MARK) || /^\s*;\(function\s+acwSyncArgvFromEnv/.test(line)) {
        skipping = true
        removed = true
        if (!isRefineContractLine(line) && line.includes(REFINE_MARK)) {
          /* comment-only */
        }
        continue
      }
      out.push(line)
      continue
    }
    if (isRefineContractLine(line)) continue
    if (isEmptyLine(line) && i + 1 < lines.length && isRefineContractLine(lines[i + 1])) {
      continue
    }
    skipping = false
    out.push(line)
  }
  while (out.length && isEmptyLine(out[0]) && out[0] !== '') {
    /* keep intentional blank after @echo off */
    break
  }
  return { text: out.join(nl), nl, removed }
}
