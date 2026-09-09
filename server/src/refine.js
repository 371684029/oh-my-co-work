/**
 * 4.5 熔炉炼化（refine）——把成员的「输入/输出」格式化成文档友好形态。
 *
 * 与「适配(adapt)」解耦：适配 = 接工作台（advance.js 执行前）；炼化 = 文档化（执行后 + 成员级规格）。
 * 本模块是纯逻辑 + 可注入 formatter，熔炉(REFINE 角色)只负责产 format 规格，测试用确定性 formatter 替身。
 */
import { stripAnsi } from '@acw/shared'
import { getDb, parseJson } from './db.js'

function stdoutOf(output) {
  if (!output || typeof output !== 'object') return ''
  const data = output.data && typeof output.data === 'object' ? output.data : null
  if (data && data.stdout != null && String(data.stdout).trim()) return String(data.stdout)
  if (typeof output.stdout === 'string' && output.stdout.trim()) return output.stdout
  return ''
}

/** 从执行结果里抽取可文档化的文本（脚本 stdout 优先于短摘要） */
export function extractMessageText(output) {
  if (output == null) return ''
  if (typeof output === 'string') return output
  const stdout = stdoutOf(output)
  if (stdout) return stdout
  if (typeof output.text === 'string') return output.text
  if (Array.isArray(output.choices)) {
    return output.choices
      .filter(Boolean)
      .map((c) => (typeof c === 'string' ? c : c?.text || ''))
      .join('\n')
  }
  if (typeof output.summary === 'string') return output.summary
  if (typeof output.data === 'string') return output.data
  return ''
}

/**
 * 按格式规格应用到底层产出文本。format 为 config.refine.format（可空）。
 * 最小规格：`{ title }` → 以「### 标题」包裹并清 ANSI；无规格则仅清 ANSI 保原样。
 */
export function applyRefineFormat(output, format) {
  const raw = stripAnsi(extractMessageText(output)).trim()
  if (!raw) return raw
  const title = format && typeof format.title === 'string' ? format.title.trim() : ''
  return title ? `### ${title}\n\n${raw}` : raw
}

/** 无熔炉规格时的确定性兜底格式化节点：`### <成员> 产出\n\n<文本>` */
export function defaultRefineFormat(output, member = {}) {
  const raw = stripAnsi(extractMessageText(output)).trim()
  if (!raw) return raw
  const who = member.display_name || member.displayName || member.name || ''
  return `### ${who} 产出\n\n${raw}`
}

/**
 * 节点完成后的炼化决策与格式化。
 * @param {object} output 执行结果（result）
 * @param {object} member 成员（含 config.refine）
 * @param {{ forceRefine?: boolean, formatter?: (output, member)=>string }} [opts]
 *        forceRefine: 该步已勾选炼化（step.refine）
 * @returns {{ source: 'spec'|'formatter'|'none', formatted: string, format: object|null, refined: boolean, fallback: boolean }}
 *  - source 'spec'：成员已有炼化规格 → applyRefineFormat
 *  - source 'formatter'：未炼化但 step 勾了炼化 → 走格式化节点（opts.formatter 或 defaultRefineFormat）
 *  - source 'none'：未开启炼化 → 原样文本
 */
export function refineOutputForNode(output, member = {}, opts = {}) {
  const refine = member.config?.refine || {}
  const format = refine.format && typeof refine.format === 'object' && !Array.isArray(refine.format)
    ? refine.format
    : null
  const hasSpec = !!(format && typeof format.title === 'string' && format.title.trim())
  if (hasSpec) {
    return {
      source: 'spec',
      formatted: applyRefineFormat(output, format),
      format,
      refined: true,
      fallback: false,
    }
  }
  const doRefine = !!(refine.enabled || opts.forceRefine)
  if (!doRefine) {
    return {
      source: 'none',
      formatted: extractMessageText(output),
      format: null,
      refined: false,
      fallback: false,
    }
  }
  const fmt = (opts.formatter || defaultRefineFormat)(output, member)
  return {
    source: 'formatter',
    formatted: fmt,
    format: null,
    refined: false,
    fallback: true,
  }
}

/** 默认 REFINE 规格作者：从成员名派生一个最小 `{ title }` 规格（熔炉 REFINE 角色未接入时的兜底）。 */
export function defaultRefineSpecAuthor(member = {}) {
  const who = member.display_name || member.displayName || member.name || '成员'
  return { title: `${who} 产出台账` }
}

/**
 * 产生成员炼化格式规格。opts.author 可注入（熔炉 REFINE 角色或测试替身）。
 * @returns {object} 格式规格（如 `{ title }`）
 */
export function produceRefineSpec(member = {}, opts = {}) {
  const author = opts.author || defaultRefineSpecAuthor
  const spec = author(member)
  const fallback = defaultRefineSpecAuthor(member)
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return fallback
  if (typeof spec.title !== 'string' || !spec.title.trim()) {
    return { ...spec, title: fallback.title }
  }
  return spec
}

/**
 * 将已产出的格式规格回写成员 `config.refine.format` 并置 status=done/refinedAt。
 * saveMember 可注入（默认直接写库）；返回更新后的 member 对象（含 config.refine）。
 */
export function persistRefineSpec(member, spec, { saveMember } = {}) {
  const refinePatch = {
    enabled: true,
    status: 'done',
    format: spec,
    refinedAt: new Date().toISOString(),
  }
  if (saveMember) {
    const live = { ...(member.config || {}) }
    const refine = { ...(live.refine || {}), ...refinePatch }
    const updated = { ...member, config: { ...live, refine } }
    saveMember(member.id, { config: updated.config })
    return updated
  }
  const db = getDb()
  const row = db.prepare('SELECT config_json FROM members WHERE id = ?').get(member.id)
  const live = parseJson(row?.config_json, member.config || {})
  const refine = { ...(live.refine || {}), ...refinePatch }
  const nextConfig = { ...live, refine }
  db.prepare(`UPDATE members SET config_json = ?, updated_at = ? WHERE id = ?`).run(
    JSON.stringify(nextConfig),
    new Date().toISOString(),
    member.id,
  )
  return { ...member, config: nextConfig }
}
