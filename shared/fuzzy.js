/**
 * @acw/shared/fuzzy — 统一模糊 / 拼音匹配工具。
 *
 * 用途：聊天 / 文档 / 成员 / 群模板四维度的搜索共用一套匹配器，避免各处散落
 * `toLowerCase()+includes()`。纯函数，server 与 web 都可复用（@acw/shared workspace）。
 *
 * 匹配策略（依序取最高分）：
 *  1. 精确相等
 *  2. 前缀
 *  3. 子串包含
 *  4. 目标全拼音（无调无声母空格）前缀/包含
 *  5. 目标拼音首字母 前缀/包含
 *  6. 子序列容错（query 的字符按序出现在 target 中）
 *
 * 对中文目标 "成员"：
 *  - 输入 "成员"   → 子串包含命中
 *  - 输入 "chengyuan" → 全拼音命中
 *  - 输入 "cy"     → 首字母命中（"cheng"/"yuan" → "cy"）
 *  - 输入 "chyu"   → 子序列/首字母容错
 *
 * 依赖 pinyin-pro（安装包含测试资源约 1.2MB，dist 主文件约 320KB；随 @acw/shared
 * 被 server 直接调用，进 web 打包时会增大前端体积）。此依赖是硬依赖：若缺失，
 * 本模块在 import 时即抛错（不会降级为纯子串匹配）——因此 pinyin-pro 必须在依赖表中。
 */

import { pinyin } from 'pinyin-pro'

/** 小写归一（不掐首尾空白以外字符，保留原貌用于 contains） */
function norm(s) {
  return String(s ?? '').toLowerCase()
}

/** 去除所有空白（用于拼音串拼接） */
function stripWs(s) {
  return String(s ?? '').replace(/\s+/g, '')
}

/** 全拼音（无调 + 无空格）："成员" -> "chengyuan"；ASCII 原样保留 */
function pinyinFull(text) {
  try {
    return stripWs(pinyin(text, { toneType: 'none' }))
  } catch {
    return ''
  }
}

/** 拼音首字母（无空格）："成员" -> "cy" */
function pinyinFirst(text) {
  try {
    return stripWs(pinyin(text, { pattern: 'first', toneType: 'none' }))
  } catch {
    return ''
  }
}

/** 判断 query 是否为 target 的子序列（字符按序出现），返回 0/1 */
function subseq(needle, hay) {
  if (!needle) return 0
  let i = 0
  for (const ch of hay) {
    if (ch === needle[i] && ++i === needle.length) return 1
  }
  return 0
}

/**
 * 单目标打分。返回值：>=0 表示命中（分数越高越贴近），-1 表示未命中。
 * @param {string} query
 * @param {string|number} target
 */
export function fuzzyScore(query, target) {
  const q = norm(query)
  const t = norm(target)
  if (!q) return 1000 // 空查询 = 不过滤：命中全部（高分保证超过任意阈值）
  if (!t) return -1

  let best = -1
  if (q === t) best = 100
  else if (t.startsWith(q)) best = 90
  if (best < 0 && t.includes(q)) best = 70

  const tp = pinyinFull(t)
  if (tp && best < 95) {
    if (tp === q) best = Math.max(best, 95)
    else if (tp.startsWith(q)) best = Math.max(best, 80)
    else if (tp.includes(q)) best = Math.max(best, 60)
  }

  const tf = pinyinFirst(t)
  if (tf && best < 85) {
    if (tf === q) best = Math.max(best, 85)
    else if (tf.startsWith(q)) best = Math.max(best, 65)
    else if (tf.includes(q)) best = Math.max(best, 50)
  }

  if (best < 30) {
    if (subseq(q, t)) best = Math.max(best, 30)
    else if (tp && subseq(q, tp)) best = Math.max(best, 25)
  }
  return best
}

/** 命中与否（threshold 可调，默认 30 即子序列即可命中） */
export function isFuzzyMatch(query, target, threshold = 30) {
  return fuzzyScore(query, target) >= threshold
}

/**
 * 对一组目标字段打分，取最优。fields 可为单个字段或数组。
 * @returns {number} 命中分数或 -1
 */
export function fuzzyScoreFields(query, fields) {
  if (!fields) return -1
  const q = norm(query)
  if (!q) return 1000
  const list = Array.isArray(fields) ? fields : [fields]
  let best = -1
  for (const f of list) {
    const s = fuzzyScore(q, f)
    if (s > best) best = s
  }
  return best
}

/**
 * 对 items 做模糊检索，返回带分数的命中列表（按分降序、稳定）。
 * @param {Array} items
 * @param {string} query
 * @param {(item)=>Array|string|number} fieldSelector 取目标字段（可返回数组→多字段取最优）
 * @param {{ threshold?:number, limit?:number }} [opts]
 * @returns {{ items: Array<{item, score, matched}>, total: number }}
 */
export function fuzzySearch(items = [], query, fieldSelector, opts = {}) {
  const { threshold = 30, limit } = opts
  const q = norm(query)
  const sel = fieldSelector || ((x) => x)
  const hits = []
  for (const item of items) {
    const score = fuzzyScoreFields(q, sel(item))
    if (score >= threshold) hits.push({ item, score, matched: true })
  }
  hits.sort((a, b) => b.score - a.score)
  const out = limit && limit > 0 ? hits.slice(0, limit) : hits
  return { items: out, total: hits.length }
}

/** 简化布尔封装：query 是否命中该 target（单个目标） */
export function fuzzyMatch(query, target, threshold = 30) {
  return isFuzzyMatch(query, target, threshold)
}
