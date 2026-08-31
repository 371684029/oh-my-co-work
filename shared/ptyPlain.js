/**
 * 把 PTY 字节流画成可见屏幕再导出文本。
 * 只去 CSI 会丢掉光标/擦行语义，Grok TUI 的竖线和中文会叠成乱码。
 */

function clamp(n, lo, hi, fallback) {
  const v = Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.min(hi, Math.max(lo, Math.round(v)))
}

function wcwidth(cp) {
  if (!cp) return 0
  if (cp < 32 || (cp >= 0x7f && cp < 0xa0)) return 0
  if (
    cp >= 0x1100 &&
    (cp <= 0x115f ||
      cp === 0x2329 ||
      cp === 0x232a ||
      (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe10 && cp <= 0xfe19) ||
      (cp >= 0xfe30 && cp <= 0xfe6f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x1f300 && cp <= 0x1f64f) ||
      (cp >= 0x1f900 && cp <= 0x1f9ff) ||
      (cp >= 0x20000 && cp <= 0x3fffd))
  ) {
    return 2
  }
  return 1
}

const BOX_CHARS = /[\u2500-\u257F\u2580-\u259F]/g

const CHROME_LINE = [
  /enter\s*:\s*send/i,
  /alt\s*\+\s*enter/i,
  /shift\s*\+\s*enter/i,
  /shift\s*\+\s*tab/i,
  /ctrl\s*\+\s*x\s*:/i,
  /logged in with/i,
  /always-approve/i,
  /grok build beta/i,
  /waiting for response/i,
  /^\s*thinking\b/i,
  /api key\s*\|/i,
  /^\s*beta\s*$/i,
  /^\s*(deepseek|claude|gpt-?4|grok)(\s|$)/i,
]

const HISTORY_MAX_LINES = 3000

function hasCjk(s) {
  return /[\u3400-\u9fff]/.test(s)
}

function isChromeLine(line) {
  const stripped = line.replace(BOX_CHARS, '').replace(/[-+|═\s]/g, '')
  if (!stripped) return true
  const trimmed = line.replace(BOX_CHARS, '').trim()
  if (!trimmed) return true
  if (hasCjk(trimmed) && trimmed.length > 12) return false
  if (CHROME_LINE.some((re) => re.test(line) || re.test(trimmed))) return true
  if (!hasCjk(trimmed) && !/[a-zA-Z]{2,}/.test(trimmed) && trimmed.length < 12) return true
  return false
}

/** 屏幕文本去掉 Grok TUI 壳，给 GUI 当正文 */
export function sanitizeFurnaceGuiText(text) {
  const src = String(text || '')
  if (!src.trim()) return ''
  const kept = []
  for (const line of src.split('\n')) {
    const noBox = line.replace(BOX_CHARS, ' ').replace(/[ \t]+/g, ' ').trim()
    if (!noBox) continue
    if (isChromeLine(line) || isChromeLine(noBox)) continue
    if (!hasCjk(noBox) && noBox.length <= 3 && !/^[A-Za-z]{2,}$/.test(noBox)) continue
    kept.push(noBox)
  }
  const out = []
  for (const line of kept) {
    if (!line) {
      if (out.length && out[out.length - 1] !== '') out.push('')
      continue
    }
    out.push(line)
  }
  while (out.length && !out[0]) out.shift()
  while (out.length && !out[out.length - 1]) out.pop()
  return out.join('\n')
}

/** 是否够当 GUI 正文（有中文句子或较长英文）。壳残片不当正文。 */
export function furnaceGuiReadable(text) {
  const t = String(text || '').trim()
  if (!t) return false
  const compact = t.replace(/\s+/g, '')
  if (hasCjk(t) && compact.length >= 6) return true
  if (t.length >= 28 && /[A-Za-z]{4,}/.test(t) && /\s/.test(t)) return true
  return false
}

function keepHistoryFrame(text) {
  const t = String(text || '').trim()
  if (!t) return false
  if (furnaceGuiReadable(t)) return true
  const compact = t.replace(/\s+/g, '')
  return hasCjk(t) && compact.length >= 4
}

function mergeHistoryLines(prev, nextLines) {
  const next = (nextLines || []).map((l) => String(l || '').replace(/[ \t]+$/g, '')).filter((l) => l.length)
  if (!next.length) return prev
  if (!prev.length) return next.slice()
  const prevText = prev.join('\n')
  const nextText = next.join('\n')
  if (prevText.includes(nextText)) return prev
  if (nextText.includes(prevText)) return next.slice()
  const maxK = Math.min(prev.length, next.length)
  for (let k = maxK; k >= 1; k -= 1) {
    let ok = true
    for (let i = 0; i < k; i += 1) {
      if (prev[prev.length - k + i] !== next[i]) {
        ok = false
        break
      }
    }
    if (ok) return [...prev, ...next.slice(k)]
  }
  const last = prev[prev.length - 1]
  const idx = next.indexOf(last)
  if (idx >= 0) return [...prev, ...next.slice(idx + 1)]
  const first = next[0]
  const pidx = prev.lastIndexOf(first)
  if (pidx >= 0) return [...prev.slice(0, pidx), ...next]
  return [...prev, ...next]
}

function capHistory(lines) {
  if (lines.length <= HISTORY_MAX_LINES) return lines
  return lines.slice(-HISTORY_MAX_LINES)
}

function commitVisibleFrame(screen) {
  const raw = screen.grid.map(rowToString).join('\n')
  const clean = sanitizeFurnaceGuiText(raw)
  if (!keepHistoryFrame(clean)) return
  screen.historyLines = capHistory(mergeHistoryLines(screen.historyLines, clean.split('\n')))
}

function makeRow(cols) {
  return Array.from({ length: cols }, () => ' ')
}

function rowToString(row) {
  return row.join('').replace(/[ \t]+$/g, '')
}

function createScreen(cols, rows) {
  return {
    cols,
    rows,
    grid: Array.from({ length: rows }, () => makeRow(cols)),
    scrollback: [],
    historyLines: [],
    cx: 0,
    cy: 0,
    alt: false,
    saved: null,
  }
}

function snapshotScreen(screen) {
  return {
    grid: screen.grid.map((row) => row.slice()),
    scrollback: screen.scrollback.slice(),
    cx: screen.cx,
    cy: screen.cy,
  }
}

function enterAltScreen(screen) {
  if (screen.alt) return
  commitVisibleFrame(screen)
  screen.saved = snapshotScreen(screen)
  screen.grid = Array.from({ length: screen.rows }, () => makeRow(screen.cols))
  screen.scrollback = []
  screen.cx = 0
  screen.cy = 0
  screen.alt = true
}

function leaveAltScreen(screen) {
  if (!screen.alt || !screen.saved) return
  screen.grid = screen.saved.grid
  screen.scrollback = screen.saved.scrollback
  screen.cx = screen.saved.cx
  screen.cy = screen.saved.cy
  screen.saved = null
  screen.alt = false
}

function putChar(screen, ch) {
  const w = wcwidth(ch.codePointAt(0))
  if (w <= 0) return
  if (screen.cx + w > screen.cols) newline(screen)
  if (screen.cx + w > screen.cols) return
  screen.grid[screen.cy][screen.cx] = ch
  for (let i = 1; i < w && screen.cx + i < screen.cols; i += 1) {
    screen.grid[screen.cy][screen.cx + i] = ''
  }
  screen.cx += w
}

function newline(screen) {
  screen.cx = 0
  screen.cy += 1
  if (screen.cy < screen.rows) return
  const scrolled = rowToString(screen.grid[0])
  screen.scrollback.push(scrolled)
  const clean = sanitizeFurnaceGuiText(scrolled)
  if (keepHistoryFrame(clean)) {
    screen.historyLines = capHistory(mergeHistoryLines(screen.historyLines, clean.split('\n')))
  }
  screen.grid.shift()
  screen.grid.push(makeRow(screen.cols))
  screen.cy = screen.rows - 1
}

function setCursor(screen, x, y) {
  screen.cx = Math.min(screen.cols - 1, Math.max(0, x))
  screen.cy = Math.min(screen.rows - 1, Math.max(0, y))
}

function eraseLine(screen, mode) {
  const row = screen.grid[screen.cy]
  const from = mode === 1 ? 0 : screen.cx
  const to = mode === 1 ? screen.cx + 1 : mode === 2 ? screen.cols : screen.cols
  const start = mode === 2 ? 0 : from
  for (let i = start; i < to; i += 1) row[i] = ' '
}

function eraseDisplay(screen, mode) {
  if (mode === 2 || mode === 3) {
    commitVisibleFrame(screen)
    screen.grid = Array.from({ length: screen.rows }, () => makeRow(screen.cols))
    screen.cx = 0
    screen.cy = 0
    if (mode === 3) screen.scrollback = []
    return
  }
  if (mode === 0) {
    eraseLine(screen, 0)
    for (let y = screen.cy + 1; y < screen.rows; y += 1) screen.grid[y] = makeRow(screen.cols)
    return
  }
  if (mode === 1) {
    for (let y = 0; y < screen.cy; y += 1) screen.grid[y] = makeRow(screen.cols)
    eraseLine(screen, 1)
  }
}

function applyCsi(screen, priv, params, cmd) {
  if (priv === '?') {
    if (cmd === 'h' || cmd === 'l') {
      const codes = String(params || '').split(';')
      const alt = codes.some((c) => c === '1049' || c === '1047' || c === '47')
      if (alt) {
        if (cmd === 'h') enterAltScreen(screen)
        else leaveAltScreen(screen)
      }
    }
    return
  }
  const p = params.split(';').map((n) => {
    const v = Number.parseInt(n, 10)
    return Number.isFinite(v) ? v : 0
  })
  const a = p[0] || 0
  switch (cmd) {
    case 'A':
      setCursor(screen, screen.cx, screen.cy - (a || 1))
      break
    case 'B':
      setCursor(screen, screen.cx, screen.cy + (a || 1))
      break
    case 'C':
      setCursor(screen, screen.cx + (a || 1), screen.cy)
      break
    case 'D':
      setCursor(screen, screen.cx - (a || 1), screen.cy)
      break
    case 'G':
      setCursor(screen, Math.max(0, (a || 1) - 1), screen.cy)
      break
    case 'H':
    case 'f': {
      const row = Math.max(0, (p[0] || 1) - 1)
      const col = Math.max(0, (p[1] || 1) - 1)
      setCursor(screen, col, row)
      break
    }
    case 'J':
      eraseDisplay(screen, a)
      break
    case 'K':
      eraseLine(screen, a)
      break
    case 'X': {
      const n = a || 1
      for (let i = 0; i < n && screen.cx + i < screen.cols; i += 1) {
        screen.grid[screen.cy][screen.cx + i] = ' '
      }
      break
    }
    default:
      break
  }
}

function skipOsc(raw, i) {
  const n = raw.length
  let j = i + 2
  while (j < n) {
    const c = raw[j]
    if (c === '\u0007') return j + 1
    if (c === '\u001b' && raw[j + 1] === '\\') return j + 2
    j += 1
  }
  return n
}

function parse(raw, screen) {
  const n = raw.length
  let i = 0
  while (i < n) {
    const ch = raw[i]
    if (ch === '\u001b') {
      const next = raw[i + 1]
      if (next === ']') {
        i = skipOsc(raw, i)
        continue
      }
      if (next === '[') {
        let j = i + 2
        let priv = ''
        if (raw[j] === '?' || raw[j] === '>') {
          priv = raw[j]
          j += 1
        }
        const start = j
        while (j < n && ((raw[j] >= '0' && raw[j] <= '9') || raw[j] === ';')) j += 1
        const params = raw.slice(start, j)
        const cmd = raw[j] || ''
        if (cmd) applyCsi(screen, priv, params, cmd)
        i = cmd ? j + 1 : n
        continue
      }
      if (next === '(' || next === ')' || next === '*' || next === '+') {
        i += 3
        continue
      }
      if (next === '7' || next === '8' || next === 'c' || next === 'M' || next === 'D' || next === 'E') {
        i += 2
        continue
      }
      i += next ? 2 : 1
      continue
    }
    if (ch === '\r') {
      screen.cx = 0
      i += 1
      continue
    }
    if (ch === '\n') {
      newline(screen)
      i += 1
      continue
    }
    if (ch === '\b') {
      setCursor(screen, screen.cx - 1, screen.cy)
      i += 1
      continue
    }
    if (ch === '\t') {
      const next = Math.min(screen.cols - 1, (Math.floor(screen.cx / 8) + 1) * 8)
      setCursor(screen, next, screen.cy)
      i += 1
      continue
    }
    if (ch === '\u0007') {
      i += 1
      continue
    }
    const cp = raw.codePointAt(i)
    const glyph = String.fromCodePoint(cp)
    putChar(screen, glyph)
    i += glyph.length
  }
}

function tidyLines(lines, maxLines) {
  const out = lines.map((l) => l.replace(/[ \t]+$/g, ''))
  while (out.length && !out[0]) out.shift()
  while (out.length && !out[out.length - 1]) out.pop()
  return out.slice(-maxLines).join('\n')
}

export function renderPtyPlainText(value, opts = {}) {
  const cols = clamp(opts.cols, 20, 300, 120)
  const rows = clamp(opts.rows, 8, 80, 40)
  const maxLines = clamp(opts.maxLines, 8, 400, 80)
  const raw = String(value || '')
  if (!raw) return ''
  const screen = createScreen(cols, rows)
  parse(raw, screen)
  const lines = opts.lastScreenOnly
    ? screen.grid.map(rowToString)
    : [...screen.scrollback, ...screen.grid.map(rowToString)]
  return tidyLines(lines, maxLines)
}

/** GUI 用：累积各次清屏前的可读正文，再去壳。不再只留当前一屏。 */
export function furnaceGuiTranscript(value, opts = {}) {
  const cols = clamp(opts.cols, 20, 300, 120)
  const rows = clamp(opts.rows, 8, 80, 40)
  const maxLines = clamp(opts.maxLines, 8, 8000, 2000)
  const raw = String(value || '')
  if (!raw) return ''
  const screen = createScreen(cols, rows)
  parse(raw, screen)
  commitVisibleFrame(screen)
  return tidyLines(screen.historyLines, maxLines)
}

/**
 * 从整段累积正文里扣掉已经展示过的助手内容，得到本轮增量。
 * Grok 全屏 TUI 会整屏重绘，所以不能只靠 startsWith。
 */
export function takeFurnaceAssistantDelta(fullText, alreadyShown) {
  const curr = String(fullText || '').trim()
  const prev = String(alreadyShown || '').trim()
  if (!curr) return ''
  if (!prev) return curr
  if (curr === prev) return ''
  if (curr.startsWith(prev)) return curr.slice(prev.length).replace(/^\s+/, '')
  if (prev.startsWith(curr)) return ''
  if (prev.includes(curr) && curr.length < prev.length) return ''
  const currLines = curr.split('\n')
  const prevLines = prev.split('\n')
  const maxK = Math.min(currLines.length, prevLines.length)
  for (let k = maxK; k >= 1; k -= 1) {
    if (prevLines.slice(-k).join('\n') === currLines.slice(0, k).join('\n')) {
      return currLines.slice(k).join('\n').trim()
    }
  }
  const prevSet = new Set(prevLines.filter(Boolean))
  const fresh = currLines.filter((line) => line && !prevSet.has(line))
  return fresh.join('\n').trim()
}

/** 把累积正文和用户已发送文本拆成对话轮次（用户原文若出现在正文里则按出现位置切开） */
export function buildFurnaceChatTurns(transcript, userMessages = []) {
  const body = String(transcript || '').trim()
  const users = (Array.isArray(userMessages) ? userMessages : [])
    .map((m) => String(m || '').trim())
    .filter(Boolean)
  const turns = []
  if (!users.length) {
    if (body) turns.push({ role: 'assistant', text: body })
    return turns
  }
  let rest = body
  let split = false
  for (const user of users) {
    if (rest) {
      const idx = rest.indexOf(user)
      if (idx >= 0) {
        const before = rest.slice(0, idx).trim()
        if (before) turns.push({ role: 'assistant', text: before })
        rest = rest.slice(idx + user.length).replace(/^\s+/, '')
        split = true
      }
    }
    turns.push({ role: 'user', text: user })
  }
  const after = rest.trim()
  if (after) turns.push({ role: 'assistant', text: after })
  else if (!split && body) turns.push({ role: 'assistant', text: body })
  return turns
}
