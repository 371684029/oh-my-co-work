/**
 * 炼化契约：把 ACW_PARAM_1… 同步进 Node process.argv[2…]，
 * 避免成员命令只写 #1 #2 #3 时 CLI 脚本读不到 #4 #5。
 */
const REFINE_MARK = 'ACW-REFINE'

export const REFINE_ARGV_SYNC_MARK = 'acwSyncArgvFromEnv'

/** 插入到炼化契约块末尾（仅 .js/.mjs/.cjs/.ts） */
export function nodeRefineArgvSyncSnippet() {
  return [
    `;(function ${REFINE_ARGV_SYNC_MARK}() {`,
    "  if (!process.env.ACW_PARAM_1 && !process.env.ACW_PARAMS_JSON) return",
    '  const list = []',
    '  try {',
    "    const m = JSON.parse(process.env.ACW_PARAMS_JSON || '{}')",
    '    for (let i = 1; i <= 99; i++) {',
    "      const v = String(m['#' + i] ?? m[String(i)] ?? '').trim()",
    '      if (!v) break',
    '      list.push(v)',
    '    }',
    '  } catch {}',
    '  if (!list.length) {',
    '    for (let i = 1; i <= 99; i++) {',
    "      const v = String(process.env['ACW_PARAM_' + i] || '').trim()",
    '      if (!v) break',
    '      list.push(v)',
    '    }',
    '  }',
    '  if (!list.length) return',
    '  process.argv = process.argv.slice(0, 2).concat(list)',
    '})()',
  ].join('\n')
}

export function isNodeScript(filePath) {
  return /\.(mjs|cjs|js|ts|tsx|jsx)$/i.test(String(filePath || ''))
}

/**
 * 已有 ACW-REFINE 但缺 argv 同步时补插（幂等）。
 * @returns {{ ok: boolean, reason: string, next?: string }}
 */
export function ensureRefineArgvSyncInSource(text, filePath) {
  const src = String(text ?? '')
  if (!src.includes(REFINE_MARK)) return { ok: false, reason: 'no_mark' }
  if (src.includes(REFINE_ARGV_SYNC_MARK)) return { ok: false, reason: 'already' }
  if (!isNodeScript(filePath)) return { ok: false, reason: 'not_node' }
  const nl = src.includes('\r\n') ? '\r\n' : '\n'
  const lines = src.split(/\r?\n/)
  let insertAt = -1
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    if (lines[i].includes(REFINE_MARK)) {
      for (let j = i; j < Math.min(lines.length, i + 12); j++) {
        if (/console\.log\(\s*["']###/.test(lines[j]) || /console\.log\(`###/.test(lines[j])) {
          insertAt = j + 1
          break
        }
      }
      if (insertAt < 0) insertAt = i + 4
      break
    }
  }
  if (insertAt < 0) return { ok: false, reason: 'anchor_missing' }
  const snippet = nodeRefineArgvSyncSnippet()
  const nextLines = [...lines.slice(0, insertAt), snippet, ...lines.slice(insertAt)]
  return { ok: true, reason: 'ok', next: nextLines.join(nl) }
}
