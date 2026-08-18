/** @acw/shared — DTO helpers & constants */

export const SESSION_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  WAITING_HUMAN: 'waiting_human',
  /** 崩溃恢复：继续 / 放弃（释放进程到设置） */
  INTERRUPTED: 'interrupted',
  ARCHIVED: 'archived',
  FAILED: 'failed',
}

export const NODE_STATUS = {
  /** 未执行（尚未跑 / 排队）；展示文案统一「未执行」 */
  PENDING: 'pending',
  RUNNING: 'running',
  /**
   * 未执行（等人交互 / 闸门挂起）。产品文案「未执行」，不再用「等人」。
   * 归档后仍可保留该状态（节点未跑完也存在）。
   */
  WAITING_HUMAN: 'waiting_human',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  SKIPPED: 'skipped',
}

/** 节点状态 → 中文（展示细分：待跑 / 待确认） */
export function nodeStatusLabel(status) {
  const m = {
    pending: '待跑',
    not_run: '待跑',
    running: '执行中',
    waiting_human: '待确认',
    succeeded: '完成',
    failed: '失败',
    skipped: '已绕过',
  }
  return m[status] || status || ''
}

/**
 * 流程轨默认折叠：未跑过且已废弃（旧轨跳过/绕过、游标之前仍待跑的归档等）。
 * 已执行节点与当前轨上将要跑的节点不折叠。
 */
export function isDiscardedUnexecutedFlowNode(node, { currentStepIndex, isCurrent } = {}) {
  if (!node || node.step_type === 'offsite') return false
  if (
    node.status === 'succeeded' ||
    node.status === 'failed' ||
    node.status === 'running' ||
    node.status === 'interrupted'
  ) {
    return false
  }
  if (isCurrent) return false
  const cur = Number(currentStepIndex)
  const behindCursor = Number.isFinite(cur) && Number(node.step_index) < cur
  const bypassed = !!(node.output?.bypassed || node.input?.bypassed)
  return (
    node.status === 'skipped' ||
    bypassed ||
    ((node.status === 'pending' || node.status === 'waiting_human') && behindCursor)
  )
}

export const MEMBER_KIND = {
  ECHO: 'echo',
  SCRIPT: 'script',
}

/** 3.x 熔炉：产品名；内部成员 key 仍为 unified_admin */
export const FURNACE_MEMBER_KEY = 'unified_admin'
export const FURNACE_DISPLAY_NAME = '熔炉'
export const GROK_BUILD_DOWNLOAD_URL = 'https://grok.com'
/** 熔炉角色壳：一次只装一套；情境包另见 crucible-3.2.md */
export const FURNACE_ROLE = {
  SESSION: 'session',
  MEMBER_ADAPT: 'member_adapt',
  NODE_ADAPT: 'node_adapt',
  REVIEW: 'review',
}
export const FURNACE_ROLE_LABEL = {
  session: '群聊主持',
  member_adapt: '成员适配',
  node_adapt: '节点适配',
  review: '系统审核',
}
export const ADAPT_OPTION_HOVER =
  '开启后由熔炉做适配：优先改代码接到工作台；改不了代码再给该步骤打适配标记。改源文件前会打压缩包备份。'

export function isFurnaceMember(m) {
  if (!m) return false
  const name = String(m.name || '')
  const display = String(m.display_name || m.displayName || '')
  return (
    name === FURNACE_MEMBER_KEY ||
    display === FURNACE_DISPLAY_NAME ||
    display === '统一管理员'
  )
}

/** 产品宗旨（口号放关于页；日常控件用功能名） */
export const PRODUCT_MISSION = {
  tagline: '人机协同 · 万物归元 · 皆可 Workflow',
  living: '节点是死的，人是活的',
  oneLiner: '流动的 Workflow：节点是锚点，人可绕行、插队、临时协助再回来。',
}

/**
 * 归档 / 会话边界（已决，文档与实现冲突时以本条为准）
 * - 归档只释放本机进程与目录占用，不是「结束并另开新群聊」
 * - 同一会话（同一次开聊）可无限次归档 / 解档
 * - 归档后再发消息 = 解档并仍在本会话，不新建 Session / 不新建群模板
 * - 续跑：往回/再跑=追加克隆；往前跳未完成步=直达不克隆；旧待确认标已绕过
 * - 只有左栏主动「开聊」才新建会话
 */
export const SESSION_ARCHIVE_RULES = {
  archiveMeans: 'release_resources_only',
  sameSessionAfterArchiveSend: true,
  infiniteArchiveUnarchive: true,
  resumeByCloneAppend: true,
  newSessionOnlyViaStartChat: true,
}

/** 场外协助进入方式 */
export const OFFSITE_MODE = {
  PLANNED: 'planned',
  INTERRUPT: 'interrupt',
}

export const STEP_TYPE = {
  MEMBER: 'member',
  HUMAN: 'human',
  /** 场外协助：按时序游标插入 */
  OFFSITE: 'offsite',
  /** 归档：每局会话末尾固定节点；可手动或超时自动 */
  ARCHIVE: 'archive',
}

/** 步骤类型 → 中文 */
export function stepTypeLabel(type) {
  const m = {
    member: '成员',
    human: '人工',
    offsite: '临时协助',
    archive: '归档',
  }
  return m[type] || type || ''
}

/**
 * 节点流转设置（可多选，默认全开）
 * - admin: 管理员可确认流转
 * - auto:  子节点产出成功后自动计一票
 * - human: 人工审核；开启后必须人工同意才继续
 */
export function defaultStepFlow() {
  return { admin: true, auto: true, human: true }
}

/**
 * @param {object|null|undefined} flow
 * @param {boolean} [legacyGate]
 */
export function normalizeStepFlow(flow, legacyGate) {
  if (flow && typeof flow === 'object') {
    const hasAny =
      'admin' in flow ||
      'auto' in flow ||
      'human' in flow ||
      'adminReview' in flow ||
      'autoOnOutput' in flow ||
      'humanReview' in flow
    if (hasAny) {
      return {
        admin: !!(flow.admin ?? flow.adminReview ?? false),
        auto: !!(flow.auto ?? flow.autoOnOutput ?? false),
        human: !!(flow.human ?? flow.humanReview ?? false),
      }
    }
  }
  // 旧数据：仅 gate 布尔
  if (legacyGate === true) return defaultStepFlow()
  if (legacyGate === false) return { admin: false, auto: true, human: false }
  return defaultStepFlow()
}

/** 是否需要等人确认（人工或管理员闸门） */
export function flowNeedsWait(flow) {
  const f = normalizeStepFlow(flow)
  return !!(f.human || f.admin)
}

export function nowIso() {
  return new Date().toISOString()
}

export function uid(prefix = '') {
  const id = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
  return prefix ? `${prefix}_${id}` : id
}

/**
 * 群模板标签缩写：按分隔段取首字母/首字；无分隔的中文取前两字。
 * @param {string} title
 * @returns {string}
 */
export function abbrGroupTag(title) {
  const t = String(title || '').trim()
  if (!t) return ''
  const parts = t.split(/[\s·•\-_/|，,、]+/).filter(Boolean)
  if (parts.length >= 2) {
    return parts
      .map((p) => {
        const en = p.match(/[A-Za-z]/)
        if (en) return en[0].toUpperCase()
        const chars = [...p]
        return chars[0] || ''
      })
      .join('')
  }
  const enWords = t.match(/[A-Za-z]+/g)
  if (enWords && enWords.length >= 2) {
    return enWords.map((w) => w[0].toUpperCase()).join('')
  }
  const chars = [...t]
  if (chars.length <= 2) return t
  // 连续中文等：前两字作短标签
  return chars.slice(0, 2).join('')
}

/**
 * 默认会话名：#1 正文 + 群模板缩写（无 #1 时仅缩写）
 * @param {{ param1?: string, groupTitle?: string, groupTitleAbbr?: string }} opts
 */
export function formatSessionAutoTitle(opts = {}) {
  const p1 = String(opts.param1 || '').trim()
  const abbr =
    String(opts.groupTitleAbbr || '').trim() || abbrGroupTag(opts.groupTitle || '')
  if (p1 && abbr) return `${p1} · ${abbr}`
  if (p1) return p1
  if (abbr) return abbr
  return ''
}

/**
 * 项目参数编号上限：#1 … #99
 */
export const MAX_PROJECT_PARAMS = 99

/**
 * 项目信息 → 节点参数 #1 #2 …
 * **仅用于用户输入**：空格或换行均可分隔多段；空段丢弃。
 * 节点/成员**输出**不要走本函数（输出整段使用，不切分）。
 * 另：新开聊（新会话）各自独立一套 #1…；**同会话内多次采集为递增追加，不覆盖**。
 * 最多 #99，超出丢弃。
 * @param {string} text
 * @returns {{ list: string[], map: Record<string,string>, raw: string }}
 */
export function parseProjectParams(text) {
  const raw = text == null ? '' : String(text)
  const trimmed = raw.trim()
  if (!trimmed) {
    return { list: [], map: {}, raw }
  }
  // 空格、换行、tab 均一视同仁作分隔
  const parts = trimmed.split(/\s+/).filter(Boolean)
  const list = dedupeProjectParamsList(parts).slice(0, MAX_PROJECT_PARAMS)

  const map = {}
  list.forEach((v, i) => {
    const n = i + 1
    map[`#${n}`] = v
    map[String(n)] = v
  })
  return { list, map, raw }
}

/**
 * 项目参数 #1… 去重：保留首次出现顺序（trim 后完全相同视为重复）
 * @param {string[]} list
 * @returns {string[]}
 */
export function dedupeProjectParamsList(list) {
  const seen = new Set()
  const out = []
  for (const item of Array.isArray(list) ? list : []) {
    const t = String(item ?? '').trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/** list → #1/#2 map */
export function listToParamMap(list) {
  const map = {}
  ;(Array.isArray(list) ? list : []).forEach((v, i) => {
    const n = i + 1
    map[`#${n}`] = v
    map[String(n)] = v
  })
  return map
}

/**
 * 从会话上下文取出已有项目参数列表（仅用户 #1…，不含系统键）
 * @param {object|null|undefined} sessionContext
 * @returns {string[]}
 */
export function existingProjectParamsList(sessionContext) {
  const ctx = sessionContext || {}
  if (Array.isArray(ctx.paramsList) && ctx.paramsList.length) {
    return ctx.paramsList.map((v) => String(v)).slice(0, MAX_PROJECT_PARAMS)
  }
  const p = ctx.params && typeof ctx.params === 'object' ? ctx.params : {}
  const out = []
  for (let i = 1; i < 1000; i++) {
    const v = p[`#${i}`]
    if (v == null || !String(v).trim()) break
    out.push(String(v))
  }
  return out
}

/**
 * 同会话追加项目参数：在已有 #1… 之后继续编号，不覆盖旧值。
 * @param {string[]|object|null|undefined} existingListOrCtx 已有 list，或 session context
 * @param {string} text 本轮用户输入
 * @returns {{ list: string[], map: Record<string,string>, raw: string, added: string[], startIndex: number }}
 */
export function appendProjectParams(existingListOrCtx, text) {
  const base = dedupeProjectParamsList(
    Array.isArray(existingListOrCtx)
      ? existingListOrCtx.map((v) => String(v)).filter((v) => v.length)
      : existingProjectParamsList(existingListOrCtx),
  )
  const parsed = parseProjectParams(text)
  const seen = new Set(base.map((v) => v.trim()))
  const room = Math.max(0, MAX_PROJECT_PARAMS - base.length)
  const added = []
  for (const p of parsed.list) {
    if (added.length >= room) break
    const t = String(p).trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    added.push(t)
  }
  const list = [...base.slice(0, MAX_PROJECT_PARAMS), ...added].slice(0, MAX_PROJECT_PARAMS)
  const startIndex = base.length + 1
  return {
    list,
    map: listToParamMap(list),
    raw: parsed.raw,
    added,
    startIndex,
  }
}

/** 状态文案：本轮追加的 #n=… */
export function formatAddedParamsText(added, startIndex) {
  const from = Number(startIndex) || 1
  return (Array.isArray(added) ? added : [])
    .map((v, i) => `#${from + i}=${v}`)
    .join(' · ')
}

/**
 * 去掉已识别的 @成员名后是否几乎为空 → 视为「仅 @协助」，不当项目参数提交
 * @param {string} text
 * @param {Array<{display_name?: string, name?: string}>} [memberList]
 */
export function isMentionAssistOnly(text, memberList = []) {
  let rest = String(text || '')
  if (!rest.includes('@')) return false
  const names = []
  for (const m of memberList || []) {
    if (m?.display_name) names.push(String(m.display_name))
    if (m?.name) names.push(String(m.name))
  }
  names.sort((a, b) => b.length - a.length)
  for (const n of [...new Set(names)]) {
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`@${escaped}(?=$|[\\s,，、@])`, 'g')
    rest = rest.replace(re, ' ')
  }
  if (!names.length) {
    rest = rest.replace(/@[\w\u4e00-\u9fff·.\-]+/g, ' ')
  }
  return !rest.replace(/[\s,，、]/g, '').length
}

/**
 * 从节点 output 取整段业务正文（不切分）
 * @param {unknown} output
 * @returns {string}
 */
export function wholeOutputText(output) {
  if (output == null) return ''
  if (typeof output === 'string') return output.trim()
  if (typeof output !== 'object') return String(output).trim()
  const o = output
  const candidates = [
    o.text,
    o.summary,
    o.stdout,
    o.output,
    o.result,
    Array.isArray(o.paramsList) ? o.paramsList.join('\n') : '',
  ]
  for (const c of candidates) {
    if (c != null && String(c).trim()) return String(c).trim()
  }
  try {
    const s = JSON.stringify(o, null, 0)
    return s === '{}' ? '' : s
  } catch {
    return ''
  }
}

/** 系统级占位符（非用户输入序号） */
export const SYSTEM_PARAM_KEYS = {
  /** 整个群聊名片 */
  GROUP_CARD: '#群聊',
  /** 群聊工作文件夹路径 */
  GROUP_FOLDER: '#文件夹',
  /**
   * 调用时输入框参数：@成员 或 /指令 时，去掉触发词后的正文
   * 成员命令 / 快捷指令里写 #a · {#a} · {a}
   */
  CALL_ARGS: '#a',
}

/**
 * 把调用参数写入 paramsMap（#a）
 * @param {Record<string,string>|null|undefined} paramsMap
 * @param {string|null|undefined} callArgs
 */
export function injectCallArgsParam(paramsMap, callArgs) {
  const map = { ...(paramsMap && typeof paramsMap === 'object' ? paramsMap : {}) }
  const v =
    callArgs != null && String(callArgs).length
      ? String(callArgs)
      : map[SYSTEM_PARAM_KEYS.CALL_ARGS] != null
        ? String(map[SYSTEM_PARAM_KEYS.CALL_ARGS])
        : ''
  map[SYSTEM_PARAM_KEYS.CALL_ARGS] = v
  return map
}

/**
 * 从 @成员 消息里抽出调用参数（去掉 @显示名/@name 后的剩余正文）
 * @param {string} text
 * @param {Array<{display_name?:string,name?:string}>} mentioned
 */
export function extractCallArgsFromMention(text, mentioned = []) {
  let s = String(text || '')
  const names = []
  for (const m of mentioned || []) {
    if (m?.display_name) names.push(String(m.display_name))
    if (m?.name) names.push(String(m.name))
  }
  names.sort((a, b) => b.length - a.length)
  for (const n of names) {
    if (!n) continue
    const re = new RegExp(`@${escapeRegExpLocal(n)}`, 'gi')
    s = s.replace(re, ' ')
  }
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * 从 /指令 输入里抽出调用参数（去掉 /slash 后的剩余正文）
 * @param {string} text
 * @param {string} slash 不含 /
 */
export function extractCallArgsFromSlash(text, slash) {
  const raw = String(text || '')
  const token = String(slash || '')
    .trim()
    .replace(/^\//, '')
  if (!token) return raw.trim()
  const re = new RegExp(`^/${escapeRegExpLocal(token)}\\b\\s*`, 'i')
  if (re.test(raw)) return raw.replace(re, '').trim()
  // 面板点选时输入框可能已是参数正文、或仅 /slash
  if (raw.trim() === `/${token}` || raw.trim() === token) return ''
  return raw.trim()
}

function escapeRegExpLocal(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 解析群聊文件夹路径
 * 优先：会话 primary / workFolders[0] → 群模板 work_folder
 */
export function resolveGroupFolder(group, sessionContext) {
  const ctx = sessionContext || {}
  if (ctx.primaryWorkFolder) return String(ctx.primaryWorkFolder)
  if (Array.isArray(ctx.workFolders) && ctx.workFolders[0]) return String(ctx.workFolders[0])
  if (group?.work_folder) return String(group.work_folder)
  if (group?.workFolder) return String(group.workFolder)
  return ''
}

/**
 * 生成群聊名片文本（给人读 / 进脚本）
 * @param {object} group 群模板（含 steps）
 * @param {{ memberNameOf?: (id:string)=>string }} [opts]
 */
export function formatGroupCard(group, opts = {}) {
  if (!group) return ''
  const title = group.title || '未命名群'
  const desc = (group.description || '').trim()
  const folder = group.work_folder || group.workFolder || ''
  const steps = Array.isArray(group.steps)
    ? group.steps
    : typeof group.steps_json === 'string'
      ? (() => {
          try {
            return JSON.parse(group.steps_json)
          } catch {
            return []
          }
        })()
      : []

  const lines = [
    '【群聊名片】',
    `名称：${title}`,
  ]
  if (desc) lines.push(`简介：${desc}`)
  if (folder) lines.push(`工作文件夹：${folder}`)
  if (group.id) lines.push(`群ID：${group.id}`)
  lines.push('步骤：')
  if (!steps.length) {
    lines.push('  （无步骤）')
  } else {
    steps.forEach((s, i) => {
      const kind = s.type === 'human' ? '人工' : '成员'
      let who = ''
      if (s.type === 'member' && s.memberId) {
        const name =
          (opts.memberNameOf && opts.memberNameOf(s.memberId)) ||
          s.memberName ||
          s.memberId
        who = ` · ${name}`
      }
      const paramTag = s.captureParams ? ' · 项目参数' : ''
      lines.push(`  ${i + 1}. ${s.title || `步骤${i + 1}`}（${kind}${who}${paramTag}）`)
    })
  }
  return lines.join('\n')
}

/**
 * 合并用户参数 + 系统参数（#群聊、#文件夹）
 * @param {Record<string,string>} userParams
 * @param {{ group?: object, sessionContext?: object, memberNameOf?: function }} [sys]
 */
export function mergeSystemParams(userParams, sys = {}) {
  const map = { ...(userParams && typeof userParams === 'object' ? userParams : {}) }
  if (sys.group) {
    const card = formatGroupCard(sys.group, { memberNameOf: sys.memberNameOf })
    map[SYSTEM_PARAM_KEYS.GROUP_CARD] = card
    map['群聊'] = card
  }
  const folder = resolveGroupFolder(sys.group, sys.sessionContext)
  if (folder || sys.group) {
    map[SYSTEM_PARAM_KEYS.GROUP_FOLDER] = folder
    map['文件夹'] = folder
  }
  return map
}

/**
 * 替换字符串中的 #1 / {#1} / {1} / #群聊 等占位符
 * @param {string} template
 * @param {Record<string,string>|null|undefined} paramsMap
 * @param {object} [extra] 额外：input/folder/cwd/sessionId
 */
export function applyParamPlaceholders(template, paramsMap, extra = {}) {
  if (template == null) return template
  let s = String(template)
  const map = paramsMap && typeof paramsMap === 'object' ? paramsMap : {}

  // 长 key 优先（#文件夹、#群聊、#12 先于 #1）
  const keys = Object.keys(map)
    .filter((k) => k.startsWith('#') || k === '群聊' || k === '文件夹')
    .sort((a, b) => b.length - a.length)

  for (const k of keys) {
    const v = map[k] == null ? '' : String(map[k])
    if (k.startsWith('#')) {
      const n = k.slice(1)
      // 必须先替 {#1}/{1}，再替裸 #1；否则 grok {#1} 会变成 grok {值}
      s = s.split(`{#${n}}`).join(v)
      s = s.split(`{${n}}`).join(v)
      s = s.split(k).join(v)
    } else {
      s = s.split(`{#${k}}`).join(v)
      s = s.split(`{${k}}`).join(v)
      s = s.split(`#${k}`).join(v)
    }
  }

  if (extra.input != null) {
    s = s.split('{input}').join(String(extra.input))
    s = s.split('{human}').join(String(extra.input))
    // 与 #a 同义：调用时输入框参数（若 map 里已有 #a 则上面循环已替）
    if (!Object.prototype.hasOwnProperty.call(map, SYSTEM_PARAM_KEYS.CALL_ARGS)) {
      s = s.split('{#a}').join(String(extra.input))
      s = s.split('{a}').join(String(extra.input))
      s = s.split('#a').join(String(extra.input))
    }
  }
  if (extra.folder != null) {
    s = s.split('{folder}').join(String(extra.folder))
    s = s.split('{cwd}').join(String(extra.cwd ?? extra.folder))
  } else if (extra.cwd != null) {
    s = s.split('{folder}').join(String(extra.cwd))
    s = s.split('{cwd}').join(String(extra.cwd))
  }
  if (extra.sessionId != null) {
    s = s.split('{sessionId}').join(String(extra.sessionId))
  }

  // 未提供的 {#n} / {n} 置空，避免命令里残留字面量
  s = s.replace(/\{#\d+\}/g, '')
  s = s.replace(/\{(\d+)\}/g, '')

  // 去掉因空参数产生的空引号片段：cli ""  →  cli
  s = s.replace(/\s*""\s*/g, ' ')
  s = s.replace(/\s*''\s*/g, ' ')
  s = s.replace(/[ \t]{2,}/g, ' ').trim()
  return s
}

/** 从 session context 取出 params map（不含系统名片时仅用户参数） */
export function getParamsMap(sessionContext) {
  const ctx = sessionContext || {}
  if (ctx.params && typeof ctx.params === 'object') return { ...ctx.params }
  if (Array.isArray(ctx.paramsList) && ctx.paramsList.length) {
    const map = {}
    ctx.paramsList.forEach((v, i) => {
      map[`#${i + 1}`] = v
      map[String(i + 1)] = v
    })
    return map
  }
  return {}
}

export function cloneName(name) {
  const base = (name || '未命名').replace(/\s*副本(#\d+)?\s*$/, '').trim()
  return `${base} 副本`
}

// ─── 业务向 I/O 展示（给人看：用户说了啥 / 做了啥，不堆 id·路径·命令行） ───

const TECH_KEY =
  /^(memberId|memberName|kind|workFolder|groupCard|groupFolder|params|pid|code|runtime|cmd|args|log|cwd|label|ok|data|error|running|waiting|votes|flow|requireHuman|requireAdmin|failed|passed|journal_path|journalPath|captureParams)$/i

function clipText(s, maxLen) {
  const t = String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return ''
  return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t
}

/** 只保留用户项目参数 #1 #2…（去掉 #群聊 名片等大段） */
function userParamsLines(paramsList, params) {
  const lines = []
  const list = dedupeProjectParamsList(
    Array.isArray(paramsList) ? paramsList : [],
  )
  if (list.length) {
    list.forEach((v, i) => {
      const t = clipText(v, 120)
      if (t) lines.push(`#${i + 1} ${t}`)
    })
    return lines
  }
  if (params && typeof params === 'object') {
    const keys = Object.keys(params)
      .filter((k) => /^#\d+$/.test(k))
      .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
    const vals = dedupeProjectParamsList(
      keys.map((k) => String(params[k] ?? '').trim()).filter(Boolean),
    )
    vals.forEach((v, i) => {
      const t = clipText(v, 120)
      if (t) lines.push(`#${i + 1} ${t}`)
    })
  }
  return lines
}

/**
 * 业务向一句话（群报告 / 列表）
 */
export function digestBusinessIo(val, { maxLen = 100 } = {}) {
  if (val == null) return '—'
  if (typeof val === 'string') return clipText(val, maxLen) || '—'
  if (typeof val !== 'object') return clipText(val, maxLen) || '—'

  // 人工步
  if (val.submitted != null || val.kind === 'human') {
    const t = clipText(val.submitted || val.text || '', maxLen)
    if (t) return t
    if (val.waiting) return '等待输入'
    if (val.prompt) return clipText(`提示：${val.prompt}`, maxLen)
  }

  // 用户参数
  const pl = userParamsLines(val.paramsList, val.params)
  if (pl.length && !val.summary) {
    return clipText(pl.join(' · '), maxLen)
  }

  // 人工输入透传
  if (val.humanInput != null && String(val.humanInput).trim()) {
    return clipText(val.humanInput, maxLen)
  }

  // 审核/用户备注（同意拒绝时附带）
  if (val.humanNote != null && String(val.humanNote).trim()) {
    return clipText(val.humanNote, maxLen)
  }

  // 脚本真实产出：stdout 优先于「已完成」类空话
  const stdoutDigest = extractStdoutDigest(val, maxLen)
  if (stdoutDigest) return stdoutDigest

  // 结果摘要：去掉「【xxx】执行失败 · 退出码」类技术前缀里的路径堆叠，只留原因/正文
  if (val.summary != null && String(val.summary).trim()) {
    let s = String(val.summary)
    // 去掉目录/命令/脚本等技术行
    s = s
      .split(/\r?\n/)
      .filter((line) => {
        const t = line.trim()
        if (!t) return false
        if (/^(目录|命令|脚本|配置命令|cwd|cmd|pid|runtime)\s*[:：]/i.test(t)) return false
        if (/^---\s*(stdout|stderr)/i.test(t)) return false
        if (/控制台已结束/i.test(t) && /exit\s*-?\d+/i.test(t)) return false
        if (/^开始执行|已结束|执行中/.test(t)) return false
        return true
      })
      .join(' ')
    // 失败时优先「原因：」
    const reason = String(val.summary).match(/原因[:：]\s*(.+)/)
    if (reason) return clipText(reason[1], maxLen)
    if (val.ok === false) {
      const m = s.match(/失败[^\n]*|Error[:：].+|Cannot find.+/i)
      if (m) return clipText(m[0], maxLen)
      return clipText(s || '执行失败', maxLen)
    }
    if (val.ok === true || val.ok === undefined) {
      // 成功：去掉【标签】执行失败类；取短业务句
      s = s.replace(/【[^】]+】\s*/g, '').replace(/执行失败[·.\s]*/g, '')
      // 纯「已完成」且无实质内容时继续往下找 stdout
      if (s && !/^(已完成|完成|ok|OK|成功)$/i.test(s.trim())) {
        return clipText(s, maxLen)
      }
    }
  }

  if (val.text != null && String(val.text).trim()) {
    const t = String(val.text)
    if (/^▶\s/.test(t) || /开始执行/.test(t)) return ''
    if (/^已同意|^已拒绝|^已通过/.test(t) && t.length < 12) return clipText(t, maxLen)
    return clipText(t, maxLen)
  }

  if (val.ok === false) {
    const e = val.error
    const msg = typeof e === 'object' ? e?.message || e?.code : e
    return clipText(msg ? `失败：${msg}` : '执行失败', maxLen)
  }
  if (val.running) return '执行中…'
  if (val.waiting) return '等待中…'

  if (val.data != null && typeof val.data === 'object') {
    // echo 等
    if (val.data.echo != null) return clipText(val.data.echo, maxLen)
  }

  // 无实质产出时不回落「已完成」空话
  if (val.ok === true) return ''
  return '—'
}

/** 从 data.stdout / summary 抽有信息量的产出尾部 */
function extractStdoutDigest(val, maxLen = 160) {
  const raw =
    (val?.data && typeof val.data === 'object' && val.data.stdout != null
      ? String(val.data.stdout)
      : '') ||
    (typeof val?.stdout === 'string' ? val.stdout : '') ||
    ''
  const errRaw =
    (val?.data && typeof val.data === 'object' && val.data.stderr != null
      ? String(val.data.stderr)
      : '') ||
    (typeof val?.stderr === 'string' ? val.stderr : '') ||
    ''
  const pickLines = (text) =>
    String(text || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .filter(
        (l) =>
          !/^(cwd|pid|code|runtime|cmd)=/i.test(l) &&
          !/^ECW /i.test(l) &&
          !/^\[ecw\]/i.test(l) &&
          !/^Press Enter/i.test(l) &&
          !/^按任意键/i.test(l) &&
          !/^---\s*(stdout|stderr)/i.test(l) &&
          !/控制台已结束|独立控制台完成/i.test(l),
      )
  const outLines = pickLines(raw)
  if (outLines.length) {
    return clipText(outLines.slice(-6).join(' · '), maxLen)
  }
  const errLines = pickLines(errRaw)
  if (errLines.length) {
    return clipText(errLines.slice(-4).join(' · '), maxLen)
  }
  return ''
}

/**
 * 业务向多行展示（流程轨输入/输出展开）
 * @param {'input'|'output'|'auto'} role
 */
export function formatBusinessIo(val, role = 'auto') {
  if (val == null) return '（无）'
  if (typeof val === 'string') return val.trim() || '（空）'
  if (typeof val !== 'object') return String(val)

  const lines = []

  // —— 输入侧 ——
  const isInput =
    role === 'input' ||
    val.kind === 'human' ||
    val.submitted != null ||
    val.prompt != null ||
    val.humanInput != null ||
    (val.paramsList && !val.summary && val.ok === undefined)

  if (isInput || role === 'auto') {
    if (val.prompt && val.kind === 'human') {
      lines.push(`说明：${clipText(val.prompt, 200)}`)
    }
    if (val.submitted != null && String(val.submitted).trim()) {
      lines.push(`用户输入：\n${String(val.submitted).trim()}`)
    } else if (val.humanInput != null && String(val.humanInput).trim()) {
      lines.push(`用户输入：\n${String(val.humanInput).trim()}`)
    }
    const pl = userParamsLines(val.paramsList, val.params)
    if (pl.length) {
      lines.push('项目参数：')
      pl.forEach((p) => lines.push(`  ${p}`))
    }
    if (val.waiting) lines.push('状态：等待用户输入')
  }

  // —— 输出侧 ——
  const isOutput =
    role === 'output' ||
    val.summary != null ||
    val.ok === true ||
    val.ok === false ||
    val.running === true

  if (isOutput || role === 'auto') {
    if (val.ok === true) lines.push('结果：成功')
    if (val.ok === false) lines.push('结果：失败')
    if (val.running) lines.push('结果：执行中…')

    // 审核三态：pending | approve | reject
    if (val.humanAction === 'pending') lines.push('审核：pending')
    else if (val.humanAction === 'approve') lines.push('审核：通过')
    else if (val.humanAction === 'reject') lines.push('审核：拒绝')

    // 用户审核备注
    if (val.humanNote != null && String(val.humanNote).trim()) {
      const act =
        val.humanAction === 'reject'
          ? '拒绝附言'
          : val.humanAction === 'approve'
            ? '通过附言'
            : val.humanAction === 'pending'
              ? 'pending 附言'
              : '附言'
      lines.push(`${act}：${String(val.humanNote).trim()}`)
    }

    // 额外产出：stdout / stderr（脚本真实输出，优先）
    const stdoutExtra = extractExtraOutput(val)
    if (stdoutExtra) {
      lines.push(`产出：\n${stdoutExtra}`)
    } else {
      // 业务摘要（无 stdout 时）
      const one = digestBusinessIo(
        { ...val, humanNote: undefined, data: val.data ? { ...val.data, stdout: '', stderr: '' } : val.data },
        { maxLen: 400 },
      )
      if (
        one &&
        one !== '—' &&
        one !== '已完成' &&
        one !== '执行中…' &&
        one !== '等待中…' &&
        !/^开始执行/.test(one)
      ) {
        lines.push(val.ok === false ? `说明：${one}` : `概况：${one}`)
      }
    }

    // 用户可见文本（echo 等）
    if (val.data?.echo != null && String(val.data.echo).trim()) {
      lines.push(`输出：${String(val.data.echo).trim()}`)
    } else if (val.text != null && String(val.text).trim() && !/^▶/.test(val.text)) {
      const t = String(val.text).trim()
      if (!/开始执行|已结束/.test(t) && (!val.summary || t !== String(val.summary).trim())) {
        if (t.length < 800 && !/目录:|命令:|脚本:/.test(t)) {
          lines.push(`输出：${t}`)
        }
      }
    }
  }

  // 若上面没抽到业务字段，再轻量回落（仍避免整包 JSON）
  if (!lines.length) {
    const one = digestBusinessIo(val, { maxLen: 300 })
    if (one && one !== '—') return one
    // 过滤技术键后展示剩余短字段
    for (const [k, v] of Object.entries(val)) {
      if (TECH_KEY.test(k)) continue
      if (v == null || v === '') continue
      if (typeof v === 'object') continue
      lines.push(`${k}：${clipText(v, 160)}`)
    }
  }

  return lines.length ? lines.join('\n') : '（暂无实质产出）'
}

/**
 * 抽取脚本额外输出（stdout 为主，stderr 失败时补充）
 * @returns {string}
 */
function extractExtraOutput(val) {
  if (!val || typeof val !== 'object') return ''
  const data = val.data && typeof val.data === 'object' ? val.data : {}
  const stdout = String(data.stdout ?? val.stdout ?? '').trim()
  const stderr = String(data.stderr ?? val.stderr ?? '').trim()
  const clean = (text, maxLines = 20, maxChars = 1200) => {
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+$/g, ''))
      .filter((l) => {
        const t = l.trim()
        if (!t) return false
        if (/^(cwd|pid|code|runtime|cmd)=/i.test(t)) return false
        if (/^ECW |^\[ecw\]/i.test(t)) return false
        if (/^Press Enter|^按任意键/i.test(t)) return false
        if (/控制台已结束|独立控制台完成/i.test(t)) return false
        return true
      })
    let body = lines.slice(-maxLines).join('\n').trim()
    if (body.length > maxChars) body = `…${body.slice(-maxChars)}`
    return body
  }
  const out = clean(stdout)
  if (out) return out
  if (val.ok === false) {
    const err = clean(stderr, 12, 800)
    if (err) return err
  }
  return ''
}

/**
 * 脚本执行结果 → 聊天/闸门用的短业务文案（不堆路径命令）
 */
export function formatScriptUserSummary({ ok, exitCode, stdout, stderr, label }) {
  const who = label || '脚本'
  const out = String(stdout || '').trim()
  const err = String(stderr || '').trim()

  if (ok) {
    // 取 stdout 末尾有信息量的几行，去掉技术噪音
    const lines = out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .filter(
        (l) =>
          !/^(cwd|pid|code|runtime|cmd)=/i.test(l) &&
          !/^ECW /i.test(l) &&
          !/^\[ecw\]/i.test(l) &&
          !/^Press Enter/i.test(l) &&
          !/^按任意键/i.test(l),
      )
    const tail = lines.slice(-4).join(' · ')
    if (tail) return clipText(`${who}：${tail}`, 280)
    return `${who}：已完成`
  }

  const errKey =
    err
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(
        (l) =>
          /Error:|Cannot find|Token expired|失败|ENOENT|MODULE_NOT_FOUND|fatal:|403|401/i.test(l) &&
          l.length < 240,
      ) ||
    out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => /失败|Error|Token expired|Cannot find/i.test(l) && l.length < 240)

  if (errKey) return clipText(`${who}失败：${errKey}`, 280)
  if (exitCode != null && exitCode !== 0) {
    // Windows 用户中止等
    if (Number(exitCode) === 3221225786 || Number(exitCode) === 0xc000013a) {
      return `${who}：已取消或窗口被关闭`
    }
    return `${who}失败（退出码 ${exitCode}）`
  }
  return `${who}失败`
}
