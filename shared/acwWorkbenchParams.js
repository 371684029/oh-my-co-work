/** 从工作台子进程环境读取 #1…#n（与 runMember 注入一致） */

const MAX = 99

/**
 * @param {Record<string, string|undefined>} env
 * @returns {Record<string, string>}
 */
export function paramMapFromAcwEnv(env = {}) {
  const out = {}
  try {
    const raw = env.ACW_PARAMS_JSON || env.ECW_PARAMS_JSON
    if (raw) {
      const j = JSON.parse(String(raw))
      if (j && typeof j === 'object' && !Array.isArray(j)) {
        for (const [k, v] of Object.entries(j)) {
          const t = String(v ?? '').trim()
          if (!t) continue
          if (k.startsWith('#')) out[k] = t
          else if (/^\d+$/.test(k)) out[`#${k}`] = t
        }
      }
    }
  } catch {
    /* ignore bad JSON */
  }
  for (let i = 1; i <= MAX; i++) {
    const v = env[`ACW_PARAM_${i}`] ?? env[`ECW_PARAM_${i}`]
    if (v == null || String(v).trim() === '') break
    out[`#${i}`] = String(v).trim()
  }
  return out
}

/**
 * @param {Record<string, string>} map
 * @param {number} [start]
 * @returns {string[]}
 */
export function paramListFromMap(map = {}, start = 1) {
  const list = []
  for (let i = Math.max(1, start); i <= MAX; i++) {
    const v = map[`#${i}`]
    if (v == null || v === '') break
    list.push(v)
  }
  return list
}

/**
 * @param {Record<string, string|undefined>} env
 * @param {number} [start]
 * @returns {string[]}
 */
export function paramListFromAcwEnv(env = {}, start = 1) {
  return paramListFromMap(paramMapFromAcwEnv(env), start)
}

/** 是否由工作台注入了项目参数（区分本机裸跑 argv） */
export function hasAcwWorkbenchParams(env = {}) {
  if (String(env.ACW_PARAM_1 || env.ECW_PARAM_1 || '').trim()) return true
  const raw = env.ACW_PARAMS_JSON || env.ECW_PARAMS_JSON
  if (!raw) return false
  try {
    const j = JSON.parse(String(raw))
    return !!(j && typeof j === 'object' && Object.keys(j).length)
  } catch {
    return false
  }
}
