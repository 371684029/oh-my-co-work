/**
 * Step / session param specs and conditional skip (5.3.0 FLW-04 / FLW-05).
 */

export function normalizeParamSpecs(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((s) => s && s.key)
    .map((s) => {
      const key = String(s.key).trim()
      const type = String(s.type || 'string').toLowerCase()
      const options = Array.isArray(s.options) ? s.options.map(String) : []
      return {
        key,
        label: String(s.label || key).slice(0, 120),
        type: ['string', 'number', 'enum', 'boolean'].includes(type) ? type : 'string',
        required: s.required === true,
        default: s.default != null ? String(s.default) : '',
        example: s.example != null ? String(s.example) : '',
        options,
      }
    })
}

/**
 * @param {ReturnType<typeof normalizeParamSpecs>} specs
 * @param {Record<string, string>} paramsMap
 */
export function validateAndFillSessionParams(specs, paramsMap = {}) {
  const filled = { ...(paramsMap && typeof paramsMap === 'object' ? paramsMap : {}) }
  /** @type {Array<{ key: string, message: string }>} */
  const errors = []
  for (const spec of specs) {
    let val = filled[spec.key]
    if ((val == null || String(val).trim() === '') && spec.default !== '') {
      val = spec.default
      filled[spec.key] = val
    }
    const str = val != null ? String(val).trim() : ''
    if (spec.required && !str) {
      errors.push({ key: spec.key, message: `${spec.label}（${spec.key}）为必填` })
      continue
    }
    if (!str) continue
    if (spec.type === 'number' && !Number.isFinite(Number(str))) {
      errors.push({ key: spec.key, message: `${spec.label}（${spec.key}）须为数字` })
    }
    if (spec.type === 'boolean' && !/^(true|false|0|1|yes|no)$/i.test(str)) {
      errors.push({ key: spec.key, message: `${spec.label}（${spec.key}）须为 true/false` })
    }
    if (spec.type === 'enum' && spec.options.length && !spec.options.includes(str)) {
      errors.push({
        key: spec.key,
        message: `${spec.label}（${spec.key}）须为：${spec.options.join(' | ')}`,
      })
    }
  }
  return { ok: errors.length === 0, errors, params: filled }
}

export function resolveGroupParamSpecs(group) {
  if (!group) return []
  const cfg =
    group.config && typeof group.config === 'object'
      ? group.config
      : typeof group.config_json === 'string'
        ? JSON.parse(group.config_json || '{}')
        : {}
  return normalizeParamSpecs(cfg.paramSpecs || cfg.paramsSpec)
}

/**
 * @param {object} step
 * @param {object} ctx session context
 * @param {object|null} prevOutput previous node output_json parsed
 */
export function evalStepSkipWhen(step, ctx, prevOutput = null) {
  const sw = step?.skipWhen
  if (!sw || typeof sw !== 'object') return false
  const params = ctx?.params && typeof ctx.params === 'object' ? ctx.params : {}
  if (sw.param) {
    const key = String(sw.param).trim()
    const val = params[key] ?? ''
    if (sw.empty === true) return !String(val).trim()
    if (sw.notEmpty === true) return !!String(val).trim()
    if (sw.value !== undefined) return String(val) === String(sw.value)
    if (sw.notValue !== undefined) return String(val) !== String(sw.notValue)
  }
  if (sw.lastOk === true && prevOutput) return prevOutput.ok === true
  if (sw.lastOk === false && prevOutput) return prevOutput.ok === false
  if (sw.lastFailed === true && prevOutput) return prevOutput.ok === false
  return false
}
