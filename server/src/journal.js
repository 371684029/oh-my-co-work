/**
 * 节点 I/O 台账：SQL 为调度真相，Markdown 给人读/可 Git
 */
import fs from 'node:fs'
import path from 'node:path'
import { digestBusinessIo, formatBusinessIo } from '@acw/shared'
import { DATA_ROOT } from './db.js'

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function yamlEscape(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
}

function toMdBlock(obj) {
  // 台账正文也走业务摘要，避免整包技术 JSON
  const text = formatBusinessIo(obj, 'auto')
  return text ? `${text}\n` : '_（无）_\n'
}

/**
 * 写入/更新单节点 markdown
 * @returns {string} 相对 dataRoot 的路径
 */
export function writeNodeJournal({
  sessionId,
  sessionTitle,
  node,
  input,
  output,
  memberName,
}) {
  const dir = path.join(DATA_ROOT, 'journals', 'sessions', sessionId, 'nodes')
  ensureDir(dir)
  const fileName = `step-${String(node.step_index).padStart(2, '0')}-${node.id}.md`
  const abs = path.join(dir, fileName)
  const rel = path
    .join('journals', 'sessions', sessionId, 'nodes', fileName)
    .replace(/\\/g, '/')

  const status = node.status || ''
  const body = `---
session_id: "${yamlEscape(sessionId)}"
session_title: "${yamlEscape(sessionTitle || '')}"
node_id: "${yamlEscape(node.id)}"
step_index: ${Number(node.step_index) || 0}
step_id: "${yamlEscape(node.step_id || '')}"
title: "${yamlEscape(node.title || '')}"
step_type: "${yamlEscape(node.step_type || '')}"
member: "${yamlEscape(memberName || '')}"
status: "${yamlEscape(status)}"
started_at: "${yamlEscape(node.started_at || '')}"
finished_at: "${yamlEscape(node.finished_at || '')}"
---

# ${Number(node.step_index) + 1}. ${node.title || '节点'}

## 输入

${toMdBlock(input)}

## 输出

${toMdBlock(output)}
`

  fs.writeFileSync(abs, body, 'utf8')
  return rel
}

/** 会话归档时写一份总览索引 */
export function writeSessionJournalIndex({ sessionId, sessionTitle, status, nodes }) {
  const dir = path.join(DATA_ROOT, 'journals', 'sessions', sessionId)
  ensureDir(dir)
  const abs = path.join(dir, 'README.md')
  const lines = [
    `---`,
    `session_id: "${yamlEscape(sessionId)}"`,
    `title: "${yamlEscape(sessionTitle || '')}"`,
    `status: "${yamlEscape(status || '')}"`,
    `---`,
    ``,
    `# ${sessionTitle || sessionId}`,
    ``,
    `| # | 步骤 | 状态 | 台账 |`,
    `|---:|------|------|------|`,
  ]
  for (const n of nodes || []) {
    const link = n.journal_path
      ? `[查看](./nodes/${path.basename(n.journal_path)})`
      : '—'
    lines.push(
      `| ${Number(n.step_index) + 1} | ${n.title || ''} | ${n.status || ''} | ${link} |`,
    )
  }
  lines.push('')
  fs.writeFileSync(abs, lines.join('\n'), 'utf8')
  return path.join('journals', 'sessions', sessionId, 'README.md').replace(/\\/g, '/')
}

export function readJournalRelative(rel) {
  if (!rel) return null
  const abs = path.join(DATA_ROOT, rel)
  if (!abs.startsWith(DATA_ROOT) || !fs.existsSync(abs)) return null
  return fs.readFileSync(abs, 'utf8')
}

/** 解析节点上的 input/output 字段 */
function coerceIo(val) {
  if (val == null) return null
  if (typeof val === 'string') {
    try {
      return JSON.parse(val)
    } catch {
      return val
    }
  }
  return val
}

/**
 * 从 I/O 抽一句话（业务向：用户输入 / 完成概况，不堆 id·路径）
 */
export function digestIoValue(val, { maxLen = 160 } = {}) {
  return digestBusinessIo(val, { maxLen })
}

const STATUS_LABEL = {
  pending: '待执行',
  running: '执行中',
  waiting_human: '等人',
  succeeded: '完成',
  failed: '失败',
  skipped: '跳过',
}

/**
 * 群报告：会话级台账
 * - 优先记录全部 # 类参数（#群聊 / #文件夹 / #1…）
 * - 再记录各子节点实质输入 / 输出
 * 不写「开始/结束」类空话。
 *
 * 路径：journals/sessions/{sessionId}/ANNOUNCEMENT.md（文件名兼容旧会话）
 */
export function writeSessionAnnouncement({
  sessionId,
  sessionTitle,
  status,
  nodes,
  adminName,
  paramsList,
  params,
  groupCard,
  groupFolder,
  modes,
  kickoff,
  userNotes,
}) {
  const dir = path.join(DATA_ROOT, 'journals', 'sessions', sessionId)
  ensureDir(dir)
  const fileName = 'ANNOUNCEMENT.md'
  const abs = path.join(dir, fileName)
  const rel = path.join('journals', 'sessions', sessionId, fileName).replace(/\\/g, '/')
  const updated = new Date().toISOString()
  const useModes = Array.isArray(modes) && modes.length ? modes : ['io']

  const list = (Array.isArray(nodes) ? nodes : []).map((n) => {
    const inObj = coerceIo(n.input !== undefined ? n.input : n.input_json)
    const outObj = coerceIo(n.output !== undefined ? n.output : n.output_json)
    return {
      ...n,
      inObj,
      outObj,
      inText: formatBusinessIo(inObj, 'input'),
      outText: formatBusinessIo(outObj, 'output'),
      outDigest: digestIoValue(outObj, { maxLen: 120 }),
      statusLabel: STATUS_LABEL[n.status] || n.status || '—',
    }
  })

  const shortTime = updated.replace('T', ' ').replace(/\.\d{3}Z$/, 'Z')
  const lines = [
    `# ${sessionTitle || '群报告'}`,
    ``,
    `群报告 · ${status || '—'} · ${shortTime}${adminName ? ` · ${adminName}` : ''}`,
    ``,
  ]

  // —— 1. 全部 # 参数（报告核心）——
  const hashItems = collectHashParamItems({
    params,
    paramsList,
    groupCard,
    groupFolder,
  })
  lines.push(`## # 参数`, '')
  if (hashItems.length) {
    for (const h of hashItems) {
      const body = String(h.value ?? '')
      if (body.includes('\n') || body.length > 80) {
        lines.push(`### ${h.key}`, '', fenceOrPlain(body), '')
      } else {
        lines.push(`- \`${h.key}\` ${body || '_（空）_'}`, '')
      }
    }
  } else {
    lines.push('_暂无 # 参数（提交人工步后写入 #1…；开聊即有 #群聊 / #文件夹）_', '')
  }

  // 开聊启动输入（次要）
  const kickText =
    (kickoff && typeof kickoff === 'object' && kickoff.text != null
      ? String(kickoff.text).trim()
      : '') || ''
  if (kickText) {
    lines.push(`## 启动说明`, '', kickText, '')
  }

  // —— 2. 各子节点输入 / 输出 ——
  lines.push(`## 节点输入 / 输出`, '')
  if (!list.length) {
    lines.push('_暂无步骤_', '')
  } else {
    for (const n of list) {
      const idx = Number(n.step_index) + 1
      const title = n.title || `步骤 ${idx}`
      const st = n.statusLabel
      lines.push(`### ${idx}. ${title} · ${st}`)
      lines.push('')

      // 节点上的 # 参数（若有）
      const nodeHash = collectHashParamItems({
        params: n.inObj?.params || n.outObj?.params,
        paramsList: n.inObj?.paramsList || n.outObj?.paramsList,
      })
      if (nodeHash.length) {
        lines.push(`**# 参数**`, '')
        for (const h of nodeHash) {
          const v = String(h.value ?? '').replace(/\s+/g, ' ').trim()
          lines.push(`- \`${h.key}\` ${v.length > 240 ? `${v.slice(0, 240)}…` : v || '_（空）_'}`)
        }
        lines.push('')
      }

      const inBody = meaningfulIoText(n.inText, n.inObj, 'input')
      if (inBody) {
        lines.push(`**入**`, '', fenceOrPlain(inBody), '')
      }

      const outBody = meaningfulIoText(n.outText, n.outObj, 'output')
      if (outBody) {
        lines.push(`**出**`, '', fenceOrPlain(outBody), '')
      } else if (n.status === 'pending') {
        lines.push('_待执行_', '')
      } else if (n.status === 'running' || n.status === 'waiting_human') {
        lines.push('_进行中…_', '')
      }

      const note =
        n.outObj && typeof n.outObj === 'object' && n.outObj.humanNote
          ? String(n.outObj.humanNote).trim()
          : ''
      if (note) {
        const act =
          n.outObj.humanAction === 'reject'
            ? '拒绝'
            : n.outObj.humanAction === 'approve'
              ? '同意'
              : '附言'
        lines.push(`**审（${act}）** ${note}`, '')
      }
    }
  }

  // 全程用户参与附言
  const notes = Array.isArray(userNotes) ? userNotes.filter((x) => x && String(x.text || '').trim()) : []
  if (notes.length) {
    lines.push(`## 用户参与`, '')
    for (const u of notes) {
      const when = u.at ? String(u.at).replace('T', ' ').replace(/\.\d{3}Z$/, '') : ''
      const act = u.actionLabel || u.action || '附言'
      const where = u.nodeTitle ? ` · ${u.nodeTitle}` : ''
      lines.push(`- ${when ? `${when} · ` : ''}${act}${where}：${String(u.text).trim()}`)
    }
    lines.push('')
  }

  const markdown = lines.join('\n')
  fs.writeFileSync(abs, markdown, 'utf8')
  return { rel, markdown, modes: useModes }
}

/**
 * 汇总会话 / 节点上的全部 # 类参数
 * 顺序：#群聊 → #文件夹 → #1 #2… → 其它 #xxx
 */
function collectHashParamItems({ params, paramsList, groupCard, groupFolder } = {}) {
  const map = params && typeof params === 'object' ? { ...params } : {}
  const card = groupCard || map['#群聊'] || map['群聊'] || ''
  const folder = groupFolder || map['#文件夹'] || map['文件夹'] || ''
  if (card) {
    map['#群聊'] = card
    map['群聊'] = card
  }
  if (folder) {
    map['#文件夹'] = folder
    map['文件夹'] = folder
  }
  if (Array.isArray(paramsList) && paramsList.length) {
    paramsList.forEach((v, i) => {
      const k = `#${i + 1}`
      if (map[k] == null || map[k] === '') map[k] = v
    })
  }

  const items = []
  const seen = new Set()
  const push = (key, value) => {
    if (!key || seen.has(key)) return
    seen.add(key)
    items.push({ key, value: value == null ? '' : String(value) })
  }

  push('#群聊', map['#群聊'] || map['群聊'])
  push('#文件夹', map['#文件夹'] || map['文件夹'])

  const numKeys = Object.keys(map)
    .filter((k) => /^#\d+$/.test(k))
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  for (const k of numKeys) push(k, map[k])

  // 其它以 # 开头的键（排除已收录）
  const other = Object.keys(map)
    .filter((k) => k.startsWith('#') && !seen.has(k))
    .sort((a, b) => a.localeCompare(b, 'zh'))
  for (const k of other) push(k, map[k])

  // 若只有空 #群聊/#文件夹 且无用户参数，去掉空系统项
  return items.filter((h) => {
    if ((h.key === '#群聊' || h.key === '#文件夹') && !String(h.value || '').trim()) return false
    return true
  })
}

/** 过滤「开始/结束/已完成」等空话，保留实质内容 */
function meaningfulIoText(formatted, rawObj, role) {
  let t = String(formatted || '').trim()
  if (!t || t === '（无）' || t === '（空）' || t === '（暂无实质产出）' || t === '（无业务摘要）') {
    t = ''
  }
  // 去掉纯状态行
  t = t
    .split(/\r?\n/)
    .filter((line) => {
      const s = line.trim()
      if (!s) return true
      if (/^结果：成功$|^结果：失败$|^结果：执行中/.test(s)) return true // 保留结果行
      if (/开始执行|已结束任务|任务已创建/.test(s) && s.length < 24) return false
      if (/^状态：等待/.test(s)) return false
      return true
    })
    .join('\n')
    .trim()

  // 若 format 后仍空，再从 raw 抽 digest / human 字段
  if (!t && rawObj != null) {
    if (role === 'input') {
      const hi =
        rawObj.submitted ??
        rawObj.humanInput ??
        (typeof rawObj === 'string' ? rawObj : '')
      if (hi != null && String(hi).trim()) t = String(hi).trim()
    } else {
      const d = digestIoValue(rawObj, { maxLen: 400 })
      if (d && d !== '—') t = d
    }
  }
  return t
}

function fenceOrPlain(text) {
  const t = String(text || '')
  // 多行用代码块更易读
  if (t.includes('\n') || t.length > 80) {
    return '```\n' + t.replace(/```/g, '``\u200b`') + '\n```'
  }
  return t
}

/** 读取群报告 MD（文件名 ANNOUNCEMENT.md，兼容旧会话） */
export function readSessionAnnouncement(sessionId) {
  if (!sessionId) return null
  const rel = path.join('journals', 'sessions', sessionId, 'ANNOUNCEMENT.md').replace(/\\/g, '/')
  const md = readJournalRelative(rel)
  if (md == null) return null
  return { rel, markdown: md }
}

/**
 * 人工直接保存群报告 Markdown（整文件覆盖）
 * @returns {{ rel: string, markdown: string }}
 */
export function saveSessionAnnouncementRaw(sessionId, markdown) {
  if (!sessionId) throw new Error('缺少 sessionId')
  const dir = path.join(DATA_ROOT, 'journals', 'sessions', sessionId)
  ensureDir(dir)
  const fileName = 'ANNOUNCEMENT.md'
  const abs = path.join(dir, fileName)
  const rel = path.join('journals', 'sessions', sessionId, fileName).replace(/\\/g, '/')
  const body = markdown == null ? '' : String(markdown)
  // 统一换行，便于跨平台
  const normalized = body.replace(/\r\n/g, '\n')
  fs.writeFileSync(abs, normalized, 'utf8')
  return { rel, markdown: normalized }
}
