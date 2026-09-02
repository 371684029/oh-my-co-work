// 文档中心 Markdown 渲染工厂（4.0）——纯逻辑，node 可直测。
// 安全底线：html:false（MD 内嵌 HTML 一律转义）；链接三类行为见 docs-4x-plan.md §3.4。
// 路径识别基于「原始文本」：markdown 会把 D:\work\a 的 \b 当转义吞掉，
// 所以必须用 markdown-it 自定义规则在原始 text token 上做，不能渲染后补链接。
import MarkdownIt from 'markdown-it'

// Windows 盘符路径：到行尾/全角标点为止，允许空格与中文；尾随标点/引号/反斜杠后续修剪
const WIN_PATH = /[A-Za-z]:\\[^，。！？；、（）《》""''\r\n"]*/g
// UNC 路径：markdown 转义会先吃掉成对反斜杠（\\nas→\nas），故按「转义后」文本识别，
// 单个前导反斜杠 + 至少两级段
const UNC_PATH = /\\[^\\，。！？；、（）《》""''\r\n]+(?:\\[^\\，。！？；、（）《》""''\r\n]+)+/g
// POSIX：只认「整行恰好是一个绝对路径」（多行模式），避免把 /api/docs 这类词误判
const POSIX_LINE = /^\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+\/?$/gm

// 尾随噪音：句读、引号、括号、反斜杠、空白
const TRAILING_NOISE = /[\\.,;:!?"'”’、）】」》\s]+$/
// 路径后的中文句子（空白 + CJK/全角标点）视为路径结束——目录名后直接跟说明文字时截断
const CJK_SENTENCE_CUT = /\s+(?=[\u4e00-\u9fff（）《》""''、，。：；！？·])/

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeMatch(raw) {
  let p = String(raw)
  const cut = p.search(CJK_SENTENCE_CUT)
  if (cut >= 0) p = p.slice(0, cut)
  return p.replace(TRAILING_NOISE, '')
}

/**
 * 扫描一段原始文本，产出路径匹配（保守策略）：
 * 1. workFolder 精确/前缀出现（本会话已知工作目录，零误报）
 * 2. Windows 盘符 / UNC 路径（句内可出现）
 * 3. POSIX 绝对路径：仅整段独立 token
 * @returns {Array<{ start: number, end: number, path: string }>}
 */
export function findPathsInText(text, workFolders = []) {
  const hits = []
  const taken = []
  const overlaps = (s, e) => taken.some(([ts, te]) => s < te && e > ts)
  const push = (start, end, path) => {
    if (end > start && !overlaps(start, end)) {
      hits.push({ start, end, path })
      taken.push([start, end])
    }
  }

  const folders = [...workFolders]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  for (const folder of folders) {
    const re = new RegExp(escapeRegExp(folder), 'g')
    for (const m of String(text).matchAll(re)) push(m.index, m.index + m[0].length, m[0])
  }
  for (const re of [WIN_PATH, UNC_PATH]) {
    re.lastIndex = 0
    for (const m of String(text).matchAll(re)) {
      const p = normalizeMatch(m[0])
      // 盘符根 "C:" 太短没意义；UNC 已强制两级
      if (p.length >= 3) push(m.index, m.index + p.length, p)
    }
  }
  POSIX_LINE.lastIndex = 0
  for (const m of String(text).matchAll(POSIX_LINE)) {
    push(m.index, m.index + m[0].length, m[0])
  }
  return hits.sort((a, b) => a.start - b.start)
}

function isExternalHref(href) {
  return /^(https?:|mailto:)/i.test(String(href || ''))
}

function isDocRelativeHref(href) {
  const h = String(href || '')
  return !isExternalHref(h) && /\.md$/i.test(h)
}

/**
 * @param {{ workFolders?: string[] }} [opts]
 * @returns {MarkdownIt} 渲染 → HTML 字符串；外链带 target/_rel；文档互链带 data-docs-link；
 *   本地路径带 data-docs-path（点击由页面事件委托接管）。
 */
export function createDocsMarkdown({ workFolders = [] } = {}) {
  const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

  // —— 路径识别：core 规则遍历 inline 子 token 的原始 text ——
  // 注意：markdown-it 的转义规则会把 C:\work 切成多个相邻 text token（反斜杠单独成 token），
  // 所以必须把「连续的 text token」串接后整体识别，再按偏移重组。
  md.core.ruler.after('inline', 'docs_paths', (state) => {
    for (const block of state.tokens) {
      if (block.type !== 'inline' || !block.children) continue
      const children = block.children
      const out = []
      let insideLink = 0
      let runStart = -1
      const flushRun = (endExclusive) => {
        if (runStart < 0) return
        const joined = children
          .slice(runStart, endExclusive)
          .map((t) => t.content)
          .join('')
        const hits = joined ? findPathsInText(joined, workFolders) : []
        if (!hits.length) {
          for (let i = runStart; i < endExclusive; i++) out.push(children[i])
        } else {
          let cursor = 0
          for (const hit of hits) {
            if (hit.start > cursor) {
              const plain = new state.Token('text', '', 0)
              plain.content = joined.slice(cursor, hit.start)
              out.push(plain)
            }
            const open = new state.Token('link_open', 'a', 1)
            open.attrSet('href', '#')
            open.attrSet('data-docs-path', hit.path)
            open.attrSet('class', 'docs-path-link')
            const text = new state.Token('text', '', 0)
            text.content = hit.path
            const close = new state.Token('link_close', 'a', -1)
            out.push(open, text, close)
            cursor = hit.end
          }
          if (cursor < joined.length) {
            const rest = new state.Token('text', '', 0)
            rest.content = joined.slice(cursor)
            out.push(rest)
          }
        }
        runStart = -1
      }
      for (let i = 0; i < children.length; i++) {
        const tok = children[i]
        if (tok.type === 'link_open') insideLink += 1
        if (tok.type === 'link_close') insideLink = Math.max(0, insideLink - 1)
        // text_special 是转义序列（如 \w 的反斜杠），内容即原文，必须并入连续段
        const isPlain =
          (tok.type === 'text' || tok.type === 'text_special') && insideLink === 0
        if (isPlain) {
          if (runStart < 0) runStart = i
        } else {
          flushRun(i)
          out.push(tok)
        }
      }
      flushRun(children.length)
      block.children = out
    }
    return true
  })

  // —— 链接属性：外链新标签；journals 内 .md 互链转页内跳转 ——
  const defaultLinkOpen =
    md.renderer.rules.link_open ||
    ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const href = token.attrGet('href') || ''
    if (isDocRelativeHref(href)) {
      token.attrSet('data-docs-link', href)
      token.attrSet('class', 'docs-doc-link')
      token.attrSet('href', '#')
    } else if (isExternalHref(href)) {
      token.attrSet('target', '_blank')
      token.attrSet('rel', 'noopener noreferrer')
    }
    return defaultLinkOpen(tokens, idx, options, env, self)
  }

  return md
}
