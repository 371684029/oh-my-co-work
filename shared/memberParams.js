/** 成员运行前缺参校验：仅用户声明的 # 槽位，不与群模板默认耦合。 */

const PARAM_KEY_RE = /(?:\{#(\d+)\}|#\{(\d+)\}|#(\d+)\b|\{(\d+)\})/g

function memberConfig(member) {
  if (!member) return {}
  if (member.config && typeof member.config === 'object' && !Array.isArray(member.config)) {
    return member.config
  }
  if (member.config_json != null) {
    try {
      const j = JSON.parse(String(member.config_json))
      return j && typeof j === 'object' ? j : {}
    } catch {
      return {}
    }
  }
  return {}
}

export function normalizeProjectParamKey(k) {
  const s = String(k ?? '').trim()
  if (!s) return ''
  if (/^#\d+$/.test(s)) return s
  if (/^\d+$/.test(s)) return `#${s}`
  return s
}

/** 从成员配置文本里扫描占位符编号（不表示「默认必填」）。 */
export function scanParamKeysInMemberConfig(config = {}) {
  const script = config.script && typeof config.script === 'object' ? config.script : {}
  const envVals =
    script.env && typeof script.env === 'object' ? Object.values(script.env) : []
  const blobs = [
    config.defaultText,
    script.command,
    script.filePath,
    script.path,
    ...(Array.isArray(script.args) ? script.args : []),
    ...(typeof script.argsText === 'string' ? [script.argsText] : []),
    ...envVals,
  ]
    .filter((x) => x != null && String(x).length)
    .map(String)
    .join('\n')
  const keys = new Set()
  let m
  const re = new RegExp(PARAM_KEY_RE.source, 'g')
  while ((m = re.exec(blobs)) !== null) {
    const n = m[1] || m[2] || m[3] || m[4]
    if (n) keys.add(`#${n}`)
  }
  return [...keys].sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10))
}

/**
 * 成员执行前要具备的 # 槽位。
 * - requiresParams: false / skipParamsCheck → 不拦
 * - requiresParams: 'command' → 按命令里出现的 #n 推断（显式 opt-in，非默认）
 * - requiresParams: ['#1','#3'] → 仅用声明列表
 * - 未配置 → []（不再因命令含 #1 就默认拦）
 */
export function memberRequiredParamKeys(member) {
  const config = memberConfig(member)
  if (config.requiresParams === false || config.skipParamsCheck === true) return []
  if (config.requiresParams === 'command') {
    return scanParamKeysInMemberConfig(config)
  }
  if (Array.isArray(config.requiresParams)) {
    return config.requiresParams
      .map(normalizeProjectParamKey)
      .filter((k) => /^#\d+$/.test(k))
  }
  if (Number(config.minParams) > 0) {
    const n = Math.min(Number(config.minParams), 99)
    return Array.from({ length: n }, (_, i) => `#${i + 1}`)
  }
  return []
}

export function memberNeedsProjectParams(member) {
  return memberRequiredParamKeys(member).length > 0
}

/** 会话上下文是否已填齐声明的槽位 */
export function hasRequiredProjectParams(ctx, keys) {
  const need = (Array.isArray(keys) ? keys : []).filter((k) => /^#\d+$/.test(k))
  if (!need.length) return true
  const c = ctx || {}
  const p = c.params && typeof c.params === 'object' ? c.params : {}
  const list = Array.isArray(c.paramsList) ? c.paramsList : []
  return need.every((key) => {
    const idx = parseInt(key.slice(1), 10)
    const v = p[key] ?? (idx > 0 ? list[idx - 1] : undefined)
    return v != null && String(v).trim() !== ''
  })
}

export function missingProjectParamKeys(ctx, keys) {
  const need = (Array.isArray(keys) ? keys : []).filter((k) => /^#\d+$/.test(k))
  const c = ctx || {}
  const p = c.params && typeof c.params === 'object' ? c.params : {}
  const list = Array.isArray(c.paramsList) ? c.paramsList : []
  return need.filter((key) => {
    const idx = parseInt(key.slice(1), 10)
    const v = p[key] ?? (idx > 0 ? list[idx - 1] : undefined)
    return v == null || String(v).trim() === ''
  })
}
