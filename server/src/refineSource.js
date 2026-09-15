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
  isProbablyBinary,
} from './adaptBackup.js'
import { defaultRefineSpecAuthor, produceRefineSpec } from './refine.js'

export const REFINE_MARK = 'ACW-REFINE'

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
    return [
      `rem ${REFINE_MARK}: 工作台炼化契约。输入：ACW_HUMAN_INPUT / ACW_PARAM_1（缺则用 %1）；产出 echo 到 stdout，文档中心按「${title}」收。`,
      'if not defined ACW_PARAM_1 if not "%~1"=="" set "ACW_PARAM_1=%~1"',
      'if not defined ACW_HUMAN_INPUT set "ACW_HUMAN_INPUT=%ACW_PARAM_1%"',
      `echo ### ${title}`,
      'echo.',
    ].join(nl)
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
  return [
    `// ${REFINE_MARK}: 工作台炼化契约。输入：ACW_HUMAN_INPUT / ACW_PARAM_1；产出 console 到 stdout，文档中心按「${title}」收。`,
    "if (!process.env.ACW_PARAM_1 && process.argv[2]) process.env.ACW_PARAM_1 = process.argv[2]",
    "if (!process.env.ACW_HUMAN_INPUT) process.env.ACW_HUMAN_INPUT = process.env.ACW_PARAM_1 || ''",
    `console.log("### ${title}\\n")`,
  ].join(nl)
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

export function applyRefineContract(filePath, { title } = {}) {
  const ext = path.extname(filePath).toLowerCase()
  const commentable = /\.(mjs|cjs|js|ts|tsx|jsx|py|ps1|bat|cmd|sh)$/i.test(ext)
  if (!commentable) return { patched: false, reason: 'not_commentable' }
  const raw = fs.readFileSync(filePath)
  if (isProbablyBinary(raw)) return { patched: false, reason: 'binary' }
  const text = raw.toString('utf8')
  if (text.includes(REFINE_MARK)) return { patched: false, reason: 'already' }
  const nl = nlOf(text)
  const heading = String(title || '产出台账').trim() || '产出台账'
  const next = insertAfterPreamble(text, refineBlock(filePath, heading, nl), nl)
  fs.writeFileSync(filePath, next, 'utf8')
  return { patched: true, reason: 'ok' }
}

/**
 * 勾选炼化并保存时：备份 → 改源文件契约 → 立刻写入 format 规格（不等第一次群聊跑完）。
 */
export function applyRefineOnMemberSave(member) {
  const title = safeTitle(member)
  const spec = {
    ...produceRefineSpec(member),
    title,
    input: {
      env: ['ACW_HUMAN_INPUT', 'ACW_PARAM_1', 'ACW_PARAMS_JSON'],
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
  if (assess.ok && !needPatch.length) {
    reason = 'already'
  } else if (assess.ok) {
    try {
      backup = createAdaptBackup({
        files: needPatch,
        memberId: member.id,
        kind: 'refine',
      })
    } catch {
      reason = 'backup_failed'
      backup = null
    }
    if (reason === 'ok') {
      for (const f of needPatch) {
        try {
          const r = applyRefineContract(f.path, { title })
          if (r.patched) patched.push(f.path)
        } catch {
          reason = 'patch_failed'
          break
        }
      }
    }
  }
  const prev = member.config?.refine && typeof member.config.refine === 'object' ? member.config.refine : {}
  const refine = {
    ...prev,
    enabled: true,
    status: 'done',
    format: spec,
    refinedAt: prev.refinedAt || new Date().toISOString(),
    refineBackup: backup?.zipPath || prev.refineBackup || null,
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
