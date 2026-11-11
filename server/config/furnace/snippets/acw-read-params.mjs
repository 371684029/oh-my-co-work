/**
 * 复制到业务脚本目录（或 readUserInput 里内联同逻辑）。
 * 工作台注入：ACW_PARAM_1…#n、ACW_PARAMS_JSON（与成员命令里写了几个 #占位 无关）。
 */

function acwEnv(input) {
  if (input) return input
  return globalThis.process?.env ?? {}
}

export function acwParamMap(env) {
  const e = acwEnv(env)
  const out = {}
  try {
    const m = JSON.parse(e.ACW_PARAMS_JSON || '{}')
    for (let i = 1; i <= 99; i++) {
      const v = String(m['#' + i] ?? m[String(i)] ?? '').trim()
      if (!v) break
      out['#' + i] = v
    }
  } catch {
    /* fall through */
  }
  if (Object.keys(out).length) return out
  for (let i = 1; i <= 99; i++) {
    const v = String(e['ACW_PARAM_' + i] || '').trim()
    if (!v) break
    out['#' + i] = v
  }
  return out
}

export function acwParamList(env, start = 1) {
  const map = acwParamMap(env)
  const list = []
  for (let i = start; i <= 99; i++) {
    const v = map['#' + i]
    if (!v) break
    list.push(v)
  }
  return list
}

/** 与 readline「需求 + 分支 + 其余索引」对齐 */
export function acwSplitReqBranchTail(env) {
  const all = acwParamList(env, 1)
  const req = all[0] || ''
  const branch = all[1] || ''
  const gitIndexes = all.slice(2)
  return { req, branch, gitIndexes }
}
