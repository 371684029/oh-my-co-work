/**
 * Windows 控制台 / 脚本输出解码
 * 常见：cmd/bat 用 GBK(CP936)，按 UTF-8 读会乱码（� / 怪字 / ????）
 */
import fs from 'node:fs'
import path from 'node:path'

const DECODERS = ['utf-8', 'gbk', 'gb18030']

function getDecoder(label) {
  try {
    return new TextDecoder(label)
  } catch {
    return null
  }
}

/** 文本质量分：中文/可打印越高越好，替换符与连续 ? 越差 */
export function scoreDecodedText(s) {
  if (!s) return -1
  let sc = 0
  sc -= (s.match(/\uFFFD/g) || []).length * 8
  const q = s.match(/\?{3,}/g)
  if (q) sc -= q.reduce((n, m) => n + m.length, 0) * 2
  sc -= (s.match(/[\u00C0-\u00FF]{4,}/g) || []).length * 3
  // 韩文音节：UTF-8 被误解时常见
  sc -= (s.match(/[\uAC00-\uD7AF]/g) || []).length * 2
  sc += (s.match(/[\u4e00-\u9fff]/g) || []).length * 3
  sc += (s.match(/[\u3040-\u30ff]/g) || []).length
  sc += Math.min(40, (s.match(/[A-Za-z0-9_.:\\/-]/g) || []).length) * 0.02
  if (/Error:|Cannot find|MODULE_NOT_FOUND|ENOENT|fatal:|at Function/i.test(s)) sc += 5
  return sc
}

/**
 * @param {Buffer|Uint8Array|string|null|undefined} input
 * @returns {string}
 */
export function decodeConsoleBytes(input) {
  if (input == null) return ''
  if (typeof input === 'string') return input
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  if (!buf.length) return ''

  let ascii = true
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] > 0x7f) {
      ascii = false
      break
    }
  }
  if (ascii) return buf.toString('ascii')

  const candidates = []
  for (const enc of DECODERS) {
    const dec = getDecoder(enc)
    if (!dec) continue
    try {
      const text = dec.decode(buf)
      candidates.push({ enc, text, score: scoreDecodedText(text) })
    } catch {
      /* ignore */
    }
  }
  if (!candidates.length) return buf.toString('utf8')
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0].text
}

/** 子进程环境：Python 尽量 UTF-8；不强行改系统 chcp */
export function consoleChildEnv(base = {}) {
  return {
    ...base,
    PYTHONIOENCODING: base.PYTHONIOENCODING || 'utf-8',
    PYTHONUTF8: base.PYTHONUTF8 || '1',
  }
}

/**
 * 写 cmd 包装：ASCII 用 ascii；含中文则 UTF-8 BOM
 */
export function writeConsoleWrapperFile(filePath, lines) {
  let body = Array.isArray(lines) ? lines.join('\r\n') : String(lines)
  body = body.replace(/\r?\n/g, '\r\n')
  if (!body.endsWith('\r\n')) body += '\r\n'
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const hasNonAscii = /[^\x00-\x7F]/.test(body)
  if (hasNonAscii) {
    fs.writeFileSync(
      filePath,
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(body, 'utf8')]),
    )
  } else {
    fs.writeFileSync(filePath, body, 'ascii')
  }
}
