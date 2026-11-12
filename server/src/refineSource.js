/**
 * 保存成员时立刻按炼化契约改源脚本：绑定 ACW 输入环境变量，并在 stdout 打文档标题。
 * 与「跑完再整理台账」互补——源文件先满足工作台输入/输出格式，文档中心才收得到稳定正文。
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  assessAdaptFiles,
  collectAdaptSourcePaths,
  createAdaptBackup,
  readScriptSource,
  restoreAdaptManifest,
  stampManifestAfterPatch,
  writeScriptSource,
} from './adaptBackup.js'
import { getAppSettings } from './appSettings.js'
import { verifyMemberSync } from './memberVerify.js'
import { defaultRefineSpecAuthor, produceRefineSpec } from './refine.js'
import {
  ensureRefineArgvSyncInSource,
  isNodeScript,
  nodeRefineArgvSyncSnippet,
} from './refineArgvSync.js'
import { REFINE_MARK, stripRefineContractText } from './refineContractStrip.js'

export { REFINE_MARK }

function nlOf(text) {
  return text.includes('\r\n') ? '\r\n' : '\n'
}

function safeTitle(member) {
  const spec = produceRefineSpec(member)
  return String(spec.title || defaultRefineSpecAuthor(member).title).replace(/[\r\n"]/g, '').trim()
}

function refineBlock(filePath, title, nl) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.bat' || ext === '.cmd') {
    // rem 行仅用 ASCII：全角括号 / UTF-8 无 BOM 时 cmd 可能把下一行拆成乱命令（ef-ined / _1 缺则用）
    return [
      `rem ${REFINE_MARK}: ACW_HUMAN_INPUT / ACW_PARAM_1; else use %%1; stdout ### for docs.`,
      'if not defined ACW_PARAM_1 if not "%~1"=="" set "ACW_PARAM_1=%~1"',
      'if not defined ACW_HUMAN_INPUT set "ACW_HUMAN_INPUT=%ACW_PARAM_1%"',
      `echo ### ${title}`,
      'echo.',
    ].join('\r\n')
  }
  if (ext === '.ps1') {
    return [
      `# ${REFINE_MARK}: 工作台炼化契约。输入：ACW_HUMAN_INPUT / ACW_PARAM_1；产出 Write-Output 到 stdout，文档中心按「${title}」收。`,
      'if (-not $env:ACW_PARAM_1 -and $args.Count -ge 1) { $env:ACW_PARAM_1 = [string]$args[0] }',
      'if (-not $env:ACW_HUMAN_INPUT) { $env:ACW_HUMAN_INPUT = $env:ACW_PARAM_1 }',
      `Write-Output "### ${title}"`,
      'Write-Output ""',
    ].join(nl)
  }
  if (ext === '.sh') {
    return [
      `# ${REFINE_MARK}: 工作台炼化契约。输入：ACW_HUMAN_INPUT / ACW_PARAM_1；产出 echo 到 stdout，文档中心按「${title}」收。`,
      ': "${ACW_PARAM_1:=${1:-}}"',
      ': "${ACW_HUMAN_INPUT:=${ACW_PARAM_1:-}}"',
      `echo "### ${title}"`,
      'echo',
    ].join(nl)
  }
  if (ext === '.py') {
    return [
      `# ${REFINE_MARK}: 工作台炼化契约。输入：ACW_HUMAN_INPUT / ACW_PARAM_1；产出 print 到 stdout，文档中心按「${title}」收。`,
      'import os as _acw_os, sys as _acw_sys',
      "_acw_os.environ.setdefault('ACW_PARAM_1', _acw_sys.argv[1] if len(_acw_sys.argv) > 1 else '')",
      "_acw_os.environ.setdefault('ACW_HUMAN_INPUT', _acw_os.environ.get('ACW_PARAM_1', ''))",
      `print("### ${title}\\n")`,
    ].join(nl)
  }
  const lines = [
    `// ${REFINE_MARK}: 工作台炼化契约。#1…#n → ACW_PARAM_1… / ACW_PARAMS_JSON；成员命令可只写前几个 #占位，其余仍走环境变量。stdout 文档标题「${title}」。`,
    "if (!process.env.ACW_PARAM_1 && process.argv[2]) process.env.ACW_PARAM_1 = process.argv[2]",
    "if (!process.env.ACW_HUMAN_INPUT) process.env.ACW_HUMAN_INPUT = process.env.ACW_PARAM_1 || ''",
    `console.log("### ${title}\\n")`,
    nodeRefineArgvSyncSnippet(),
  ]
  return lines.join(nl)
}

function insertAfterPreamble(text, block, nl) {
  const lines = text.split(/\r?\n/)
  let idx = 0
  if (lines[0]?.startsWith('#!')) idx = 1
  if (/^@?echo\s+off\b/i.test(String(lines[idx] || '').trim())) idx += 1
  const before = lines.slice(0, idx).join(nl)
  const after = lines.slice(idx).join(nl)
  const head = before ? `${before}${nl}` : ''
  const tail = after ? `${nl}${after}` : nl
  return `${head}${block}${tail}`
}

export function computeRefineContractContent(filePath, { title } = {}) {
  const ext = path.extname(filePath).toLowerCase()
  const commentable = /\.(mjs|cjs|js|ts|tsx|jsx|py|ps1|bat|cmd|sh)$/i.test(ext)
  if (!commentable) return { ok: false, reason: 'not_commentable' }
  const raw = fs.readFileSync(filePath)
  const src = readScriptSource(raw)
  if (!src.ok) return { ok: false, reason: src.reason }
  if (src.text.includes(REFINE_MARK)) return { ok: false, reason: 'already' }
  const nl =
    ext === '.bat' || ext === '.cmd'
      ? '\r\n'
      : src.nl || nlOf(src.text)
  const heading = String(title || '产出台账').trim() || '产出台账'
  const body = insertAfterPreamble(src.text, refineBlock(filePath, heading, nl), nl)
  const next =
    ext === '.bat' || ext === '.cmd'
      ? body.replace(/\r?\n/g, '\r\n')
      : body
  const hasBom = ext === '.bat' || ext === '.cmd' ? false : src.hasBom
  return { ok: true, next, hasBom }
}

export function applyRefineContract(filePath, opts = {}) {
  const r = computeRefineContractContent(filePath, opts)
  if (!r.ok) return { patched: false, reason: r.reason }
  writeScriptSource(filePath, r.next, { hasBom: r.hasBom })
  return { patched: true, reason: 'ok' }
}

/** 修复旧版 bat 炼化注释（全角括号 /「缺则用」导致 cmd 乱解析）。 */
export function repairRefineContractContent(filePath, { title } = {}) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext !== '.bat' && ext !== '.cmd') return { ok: false, reason: 'not_bat' }
  const raw = fs.readFileSync(filePath)
  const src = readScriptSource(raw)
  if (!src.ok) return { ok: false, reason: src.reason }
  if (!src.text.includes(REFINE_MARK)) return { ok: false, reason: 'no_mark' }
  if (!/缺则用|[\uFF08\uFF09]/.test(src.text)) return { ok: false, reason: 'ok' }
  const stripped = stripRefineContractText(src.text)
  const nl = '\r\n'
  const heading = String(title || '产出台账').trim() || '产出台账'
  const body = insertAfterPreamble(stripped.text, refineBlock(filePath, heading, nl), nl)
  const next = body.replace(/\r?\n/g, '\r\n')
  return { ok: true, next, hasBom: false }
}

/**
 * 勾选炼化并保存时：备份 → 改源文件契约 → 立刻写入 format 规格（不等第一次群聊跑完）。
 */
/** 保存前预览：将改哪些文件、契约片段（5.2.0 REF-03，不落盘）。 */
export function planRefineOnMemberSave(member) {
  const title = safeTitle(member)
  const paths = collectAdaptSourcePaths(member)
  const assess = assessAdaptFiles(paths)
  const needPatch = (assess.files || []).filter((f) => {
    try {
      return !fs.readFileSync(f.path, 'utf8').includes(REFINE_MARK)
    } catch {
      return false
    }
  })
  const files = []
  for (const f of needPatch) {
    const r = computeRefineContractContent(f.path, { title })
    if (r.ok) {
      const idx = r.next.indexOf(REFINE_MARK)
      const snippet =
        idx >= 0 ? r.next.slice(idx, idx + 520) : r.next.slice(0, 520)
      files.push({ path: f.path, snippet, willPatch: true })
    } else {
      files.push({ path: f.path, willPatch: false, reason: r.reason })
    }
  }
  let reason = assess.ok ? 'ok' : assess.reason
  if (assess.ok && !needPatch.length) reason = 'already'
  else if (assess.ok && files.some((x) => x.willPatch)) reason = 'will_patch'
  return { ok: assess.ok, reason, title, files, fileCount: needPatch.length }
}

export function applyRefineOnMemberSave(member) {
  const title = safeTitle(member)
  const spec = {
    ...produceRefineSpec(member),
    title,
    input: {
      env: ['ACW_HUMAN_INPUT', 'ACW_PARAM_1', 'ACW_PARAM_n', 'ACW_PARAMS_JSON'],
      argvFallback: true,
    },
    output: { channel: 'stdout', heading: title },
  }
  const paths = collectAdaptSourcePaths(member)
  const assess = assessAdaptFiles(paths)
  let backup = null
  const patched = []
  let reason = assess.ok ? 'ok' : assess.reason
  const needPatch = (assess.files || []).filter((f) => {
    try {
      return !fs.readFileSync(f.path, 'utf8').includes(REFINE_MARK)
    } catch {
      return false
    }
  })
  const needArgvUpgrade = (assess.files || []).filter((f) => {
    try {
      const t = fs.readFileSync(f.path, 'utf8')
      return (
        isNodeScript(f.path) &&
        t.includes(REFINE_MARK) &&
        !t.includes('acwSyncArgvFromEnv')
      )
    } catch {
      return false
    }
  })
  const needBatRepair = (assess.files || []).filter((f) => {
    try {
      const t = fs.readFileSync(f.path, 'utf8')
      const ext = path.extname(f.path).toLowerCase()
      if (ext !== '.bat' && ext !== '.cmd') return false
      return t.includes(REFINE_MARK) && /缺则用|[\uFF08\uFF09]/.test(t)
    } catch {
      return false
    }
  })
  const filesToTouch = [...needPatch, ...needArgvUpgrade, ...needBatRepair]
  if (assess.ok && !filesToTouch.length) {
    reason = 'already'
  } else if (assess.ok) {
    try {
      backup = createAdaptBackup({
        files: filesToTouch,
        memberId: member.id,
        kind: 'refine',
      })
    } catch {
      reason = 'backup_failed'
      backup = null
    }
    if (reason === 'ok') {
      const staged = []
      try {
        for (const f of needPatch) {
          const r = computeRefineContractContent(f.path, { title })
          if (!r.ok) {
            reason = r.reason === 'already' ? 'already' : 'patch_failed'
            break
          }
          staged.push({ path: f.path, next: r.next, hasBom: r.hasBom })
        }
        for (const f of needArgvUpgrade) {
          if (reason !== 'ok') break
          const raw = fs.readFileSync(f.path)
          const src = readScriptSource(raw)
          if (!src.ok) {
            reason = 'patch_failed'
            break
          }
          const up = ensureRefineArgvSyncInSource(src.text, f.path)
          if (!up.ok) continue
          staged.push({ path: f.path, next: up.next, hasBom: src.hasBom })
        }
        for (const f of needBatRepair) {
          if (reason !== 'ok') break
          const r = repairRefineContractContent(f.path, { title })
          if (!r.ok) continue
          staged.push({ path: f.path, next: r.next, hasBom: r.hasBom })
        }
        if (reason === 'ok') {
          for (const s of staged) {
            writeScriptSource(s.path, s.next, { hasBom: s.hasBom })
            patched.push(s.path)
          }
          if (backup?.manifestPath && patched.length) {
            let stampOk = true
            if (getAppSettings().furnace?.requireVerifyBeforeStamp) {
              const probe = {
                ...member,
                config: {
                  ...(member.config || {}),
                  refine: { ...(member.config?.refine || {}), enabled: true, format: spec },
                },
              }
              const v = verifyMemberSync(probe)
              stampOk = !!(v.ok || v.skipped)
              if (!stampOk) reason = 'verify_before_stamp_failed'
            }
            if (stampOk) stampManifestAfterPatch(backup.manifestPath, patched)
          }
        }
      } catch {
        reason = 'patch_failed'
      }
      if (reason === 'patch_failed' && backup?.manifestPath) {
        try {
          restoreAdaptManifest(backup.manifestPath)
        } catch {
          /* best effort rollback */
        }
        patched.length = 0
      }
    }
  }
  const prev = member.config?.refine && typeof member.config.refine === 'object' ? member.config.refine : {}
  const refine = {
    ...prev,
    enabled: true,
    status: patched.length && reason === 'ok' ? 'pending' : prev.status || 'done',
    format: spec,
    refinedAt: prev.refinedAt || new Date().toISOString(),
    refineBackup: backup?.zipPath || prev.refineBackup || null,
    refineBackupManifest: backup?.manifestPath || prev.refineBackupManifest || null,
    patched: patched.length ? patched : prev.patched || [],
    patchReason: reason,
  }
  const nextConfig = { ...(member.config || {}), refine }
  return {
    nextConfig,
    prep: {
      reason: refine.patchReason,
      patched,
      backup,
      fallback: refine.patchReason !== 'ok' && refine.patchReason !== 'already',
    },
  }
}

export function refineSaveStatusText(prep) {
  if (!prep) return ''
  if (prep.fallback) {
    const why = {
      no_source: '没有可改的源文件（命令成员可把脚本路径写进命令）',
      read_only: '源文件只读',
      binary: '源文件不是文本',
      file_too_large: '源文件过大',
      total_too_large: '待改文件总体积过大',
      too_many_files: '待改文件过多',
      backup_failed: '备份失败，未改源文件',
      patch_failed: '写入失败，未继续改源文件',
      unreadable: '源文件无法读取',
      not_utf8: '源文件不是 UTF-8（请转为 UTF-8 或去掉 GBK 等编码后再炼化）',
    }[prep.reason]
    return `炼化规格已保存；${why || prep.reason}。跑起来仍会按规格整理进文档中心。`
  }
  const n = (prep.patched || []).length
  if (n) {
    const names = prep.patched.map((p) => path.basename(p)).join('、')
    return `已按炼化契约改写 ${names}（输入走 ACW 环境变量，stdout 带文档标题）。跑完仍会写入文档中心。`
  }
  return '源文件已有炼化契约；格式规格已保存。'
}
