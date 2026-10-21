import { furnaceGuiTranscript } from './ptyPlain.js'

const DEFAULT_CONTEXT_TOKENS = 128_000

/**
 * Rough context usage from PTY replay (5.2.0 FUR-05).
 * @returns {{ chars: number, tokensApprox: number, contextTokens: number, percent: number }}
 */
export function estimateFurnaceContext(replay, opts = {}) {
  const contextTokens = Number(opts.contextTokens) > 0 ? Number(opts.contextTokens) : DEFAULT_CONTEXT_TOKENS
  const profile = opts.profile === 'cursor' ? 'cursor' : opts.profile === 'grok' ? 'grok' : opts.profile
  const text = furnaceGuiTranscript(String(replay || ''), {
    cols: opts.cols,
    rows: opts.rows,
    profile,
  })
  const chars = text.length || String(replay || '').length
  const tokensApprox = Math.max(0, Math.ceil(chars / 4))
  const percent = contextTokens > 0 ? Math.min(100, Math.round((tokensApprox / contextTokens) * 100)) : 0
  return { chars, tokensApprox, contextTokens, percent }
}

/** User-facing one-liner for confirm dialogs. */
export function formatFurnaceContextHint(estimate) {
  if (!estimate || !estimate.chars) return '当前对话尚无可用正文（可能还在启动）。'
  const pct = estimate.percent
  const level =
    pct >= 85 ? '上下文可能接近上限' : pct >= 60 ? '对话已较长' : '上下文用量正常'
  return `${level}：约 ${estimate.tokensApprox.toLocaleString()} token（${estimate.chars.toLocaleString()} 字符，估算值）。`
}
