/**
 * 纯 Node 的 zip 读写与 tar.gz 解压，打包 / 校验 / 冒烟脚本共用。
 * 不调用系统 zip / unzip / tar / python：干净的 Windows 上没有前两个，PATH 里 Git 自带的
 * GNU tar 会把 `C:\...` 当成远程主机；这些都是本地打桌面包「老是失败」的根源。
 * 支持 zip64 读取、unix 权限与符号链接（Electron.app 的 framework 依赖符号链接）。
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const S_IFMT = 0o170000
const S_IFLNK = 0o120000
const S_IFDIR = 0o040000

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function readAt(fd, pos, len) {
  const buf = Buffer.alloc(len)
  let off = 0
  while (off < len) {
    const n = fs.readSync(fd, buf, off, len - off, pos + off)
    if (n === 0) throw new Error('zip 被截断（读到文件末尾）')
    off += n
  }
  return buf
}

function findEocd(fd, size) {
  const tailLen = Math.min(size, 0xffff + 22)
  const tail = readAt(fd, size - tailLen, tailLen)
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === 0x06054b50) return { buf: tail.subarray(i), pos: size - tailLen + i }
  }
  throw new Error('不是有效的 zip（找不到目录尾，可能下载不完整）')
}

/**
 * 读 zip 中央目录。
 * @returns {{ name: string, method: number, compSize: number, size: number, crc: number,
 *   localOffset: number, mode: number, isDir: boolean, isSymlink: boolean }[]}
 */
export function listZip(zipPath) {
  const fd = fs.openSync(zipPath, 'r')
  try {
    const size = fs.fstatSync(fd).size
    const { buf: eocd, pos: eocdPos } = findEocd(fd, size)
    let count = eocd.readUInt16LE(10)
    let cdSize = eocd.readUInt32LE(12)
    let cdOffset = eocd.readUInt32LE(16)
    if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
      const loc = readAt(fd, eocdPos - 20, 20)
      if (loc.readUInt32LE(0) !== 0x07064b50) throw new Error('zip64 定位记录缺失')
      const rec = readAt(fd, Number(loc.readBigUInt64LE(8)), 56)
      if (rec.readUInt32LE(0) !== 0x06064b50) throw new Error('zip64 目录尾损坏')
      count = Number(rec.readBigUInt64LE(32))
      cdSize = Number(rec.readBigUInt64LE(40))
      cdOffset = Number(rec.readBigUInt64LE(48))
    }
    if (cdOffset + cdSize > size) throw new Error('zip 中央目录越界（文件不完整）')
    const cd = readAt(fd, cdOffset, cdSize)
    const entries = []
    let p = 0
    for (let i = 0; i < count; i++) {
      if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error('zip 中央目录损坏')
      const madeBy = cd.readUInt16LE(p + 4)
      const flags = cd.readUInt16LE(p + 8)
      const method = cd.readUInt16LE(p + 10)
      const crc = cd.readUInt32LE(p + 16)
      let compSize = cd.readUInt32LE(p + 20)
      let uncompSize = cd.readUInt32LE(p + 24)
      const nameLen = cd.readUInt16LE(p + 28)
      const extraLen = cd.readUInt16LE(p + 30)
      const commentLen = cd.readUInt16LE(p + 32)
      const extAttr = cd.readUInt32LE(p + 38)
      let localOffset = cd.readUInt32LE(p + 42)
      const rawName = cd.subarray(p + 46, p + 46 + nameLen)
      const name = (flags & 0x800 ? rawName.toString('utf8') : rawName.toString('latin1')).replaceAll('\\', '/')
      const extra = cd.subarray(p + 46 + nameLen, p + 46 + nameLen + extraLen)
      for (let e = 0; e + 4 <= extra.length; ) {
        const id = extra.readUInt16LE(e)
        const len = extra.readUInt16LE(e + 2)
        if (id === 0x0001) {
          let q = e + 4
          if (uncompSize === 0xffffffff) (uncompSize = Number(extra.readBigUInt64LE(q))), (q += 8)
          if (compSize === 0xffffffff) (compSize = Number(extra.readBigUInt64LE(q))), (q += 8)
          if (localOffset === 0xffffffff) localOffset = Number(extra.readBigUInt64LE(q))
        }
        e += 4 + len
      }
      const mode = madeBy >> 8 === 3 ? (extAttr >>> 16) & 0xffff : 0
      entries.push({
        name,
        method,
        compSize,
        size: uncompSize,
        crc,
        localOffset,
        mode,
        isDir: name.endsWith('/') || (mode & S_IFMT) === S_IFDIR,
        isSymlink: (mode & S_IFMT) === S_IFLNK,
      })
      p += 46 + nameLen + extraLen + commentLen
    }
    return entries
  } finally {
    fs.closeSync(fd)
  }
}

function readEntryData(fd, entry) {
  const local = readAt(fd, entry.localOffset, 30)
  if (local.readUInt32LE(0) !== 0x04034b50) throw new Error(`zip 本地头损坏: ${entry.name}`)
  const start = entry.localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28)
  const raw = readAt(fd, start, entry.compSize)
  let data
  if (entry.method === 0) data = raw
  else if (entry.method === 8) data = zlib.inflateRawSync(raw)
  else throw new Error(`不支持的 zip 压缩方式 ${entry.method}: ${entry.name}`)
  if (data.length !== entry.size || crc32(data) !== entry.crc) {
    throw new Error(`zip 条目校验失败（文件损坏）: ${entry.name}`)
  }
  return data
}

/** 读取单个条目内容；找不到返回 null */
export function readZipEntry(zipPath, name, entries = listZip(zipPath)) {
  const entry = entries.find((e) => e.name === name)
  if (!entry) return null
  const fd = fs.openSync(zipPath, 'r')
  try {
    return readEntryData(fd, entry)
  } finally {
    fs.closeSync(fd)
  }
}

function safeJoin(destDir, name) {
  const out = path.resolve(destDir, name)
  const root = path.resolve(destDir)
  if (out !== root && !out.startsWith(root + path.sep)) throw new Error(`zip 条目路径越界: ${name}`)
  return out
}

/** 整包解压（逐条 CRC 校验）。符号链接在 Windows 宿主上无法可靠还原，直接报错。 */
export function extractZip(zipPath, destDir) {
  const entries = listZip(zipPath)
  fs.mkdirSync(destDir, { recursive: true })
  const fd = fs.openSync(zipPath, 'r')
  try {
    for (const entry of entries) {
      const out = safeJoin(destDir, entry.name)
      if (entry.isDir) {
        fs.mkdirSync(out, { recursive: true })
        continue
      }
      fs.mkdirSync(path.dirname(out), { recursive: true })
      const data = readEntryData(fd, entry)
      if (entry.isSymlink) {
        if (process.platform === 'win32') {
          throw new Error(`zip 含符号链接（${entry.name}），Windows 上无法还原；macOS 包请在 CI 或 macOS/Linux 上打`)
        }
        fs.rmSync(out, { force: true })
        fs.symlinkSync(data.toString('utf8'), out)
        continue
      }
      fs.writeFileSync(out, data)
      if (process.platform !== 'win32' && entry.mode & 0o111) fs.chmodSync(out, entry.mode & 0o777)
    }
  } finally {
    fs.closeSync(fd)
  }
  return entries.length
}

function dosDateTime(date) {
  const d = new Date(Math.max(date.getTime(), Date.UTC(1980, 0, 2)))
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  const day = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { time, day }
}

function collectEntries(srcDir, prefix) {
  const out = []
  const walk = (abs, rel) => {
    for (const name of fs.readdirSync(abs).sort()) {
      const full = path.join(abs, name)
      const relName = rel ? `${rel}/${name}` : name
      const st = fs.lstatSync(full)
      if (st.isDirectory()) {
        out.push({ name: `${relName}/`, full, st, kind: 'dir' })
        walk(full, relName)
      } else if (st.isSymbolicLink()) {
        out.push({ name: relName, full, st, kind: 'symlink' })
      } else if (st.isFile()) {
        out.push({ name: relName, full, st, kind: 'file' })
      }
    }
  }
  const base = prefix ? prefix.replace(/\/+$/, '') : ''
  walk(srcDir, base)
  if (base) out.unshift({ name: `${base}/`, full: srcDir, st: fs.lstatSync(srcDir), kind: 'dir' })
  return out
}

/**
 * 把 srcDir 打成 zip（条目前缀 prefix/，与 `zip -r -y prefix` 等价）：保留符号链接与 unix 权限。
 * executables：Windows 宿主上无法从文件系统读到可执行位，用相对路径列表显式标记（如 runtime/node）。
 */
export function createZip(srcDir, zipPath, { prefix = '', executables = [] } = {}) {
  const exec = new Set(executables.map((e) => e.replaceAll('\\', '/')))
  const base = prefix ? `${prefix.replace(/\/+$/, '')}/` : ''
  const items = collectEntries(srcDir, prefix)
  fs.mkdirSync(path.dirname(zipPath), { recursive: true })
  const tmp = `${zipPath}.part`
  const fd = fs.openSync(tmp, 'w')
  const central = []
  let offset = 0
  const write = (buf) => {
    fs.writeSync(fd, buf, 0, buf.length, offset)
    offset += buf.length
  }
  try {
    for (const item of items) {
      let data = Buffer.alloc(0)
      let mode
      if (item.kind === 'dir') mode = S_IFDIR | 0o755
      else if (item.kind === 'symlink') {
        data = Buffer.from(fs.readlinkSync(item.full), 'utf8')
        mode = S_IFLNK | 0o777
      } else {
        data = fs.readFileSync(item.full)
        const rel = item.name.slice(base.length)
        const perm = process.platform === 'win32' ? (exec.has(rel) ? 0o755 : 0o644) : item.st.mode & 0o777
        mode = 0o100000 | (exec.has(rel) ? perm | 0o111 : perm)
      }
      const crc = crc32(data)
      let method = 0
      let payload = data
      if (item.kind === 'file' && data.length > 0) {
        const deflated = zlib.deflateRawSync(data, { level: 6 })
        if (deflated.length < data.length) {
          method = 8
          payload = deflated
        }
      }
      if (data.length >= 0xffffffff || offset >= 0xffffffff) {
        throw new Error('打包体积超过 4GB，超出 zip32 上限')
      }
      const nameBuf = Buffer.from(item.name, 'utf8')
      const { time, day } = dosDateTime(item.st.mtime)
      const local = Buffer.alloc(30)
      local.writeUInt32LE(0x04034b50, 0)
      local.writeUInt16LE(20, 4)
      local.writeUInt16LE(0x800, 6)
      local.writeUInt16LE(method, 8)
      local.writeUInt16LE(time, 10)
      local.writeUInt16LE(day, 12)
      local.writeUInt32LE(crc, 14)
      local.writeUInt32LE(payload.length, 18)
      local.writeUInt32LE(data.length, 22)
      local.writeUInt16LE(nameBuf.length, 26)
      local.writeUInt16LE(0, 28)
      const localOffset = offset
      write(local)
      write(nameBuf)
      write(payload)
      const cdh = Buffer.alloc(46)
      cdh.writeUInt32LE(0x02014b50, 0)
      cdh.writeUInt16LE((3 << 8) | 20, 4)
      cdh.writeUInt16LE(20, 6)
      cdh.writeUInt16LE(0x800, 8)
      cdh.writeUInt16LE(method, 10)
      cdh.writeUInt16LE(time, 12)
      cdh.writeUInt16LE(day, 14)
      cdh.writeUInt32LE(crc, 16)
      cdh.writeUInt32LE(payload.length, 20)
      cdh.writeUInt32LE(data.length, 24)
      cdh.writeUInt16LE(nameBuf.length, 28)
      cdh.writeUInt32LE(((mode << 16) | (item.kind === 'dir' ? 0x10 : 0)) >>> 0, 38)
      cdh.writeUInt32LE(localOffset, 42)
      central.push(cdh, nameBuf)
    }
    if (items.length >= 0xffff) throw new Error('zip 条目数超过 65535，超出 zip32 上限')
    const cdStart = offset
    for (const buf of central) write(buf)
    const eocd = Buffer.alloc(22)
    eocd.writeUInt32LE(0x06054b50, 0)
    eocd.writeUInt16LE(items.length, 8)
    eocd.writeUInt16LE(items.length, 10)
    eocd.writeUInt32LE(offset - cdStart, 12)
    eocd.writeUInt32LE(cdStart, 16)
    write(eocd)
  } finally {
    fs.closeSync(fd)
  }
  fs.renameSync(tmp, zipPath)
  return items.length
}

function tarString(buf, start, len) {
  const end = buf.indexOf(0, start)
  return buf.toString('utf8', start, end >= 0 && end < start + len ? end : start + len)
}

function tarOctal(buf, start, len) {
  const s = tarString(buf, start, len).trim()
  return s ? parseInt(s, 8) : 0
}

/**
 * 解压 .tar.gz（ustar + GNU 长文件名 + pax path）。
 * filter(name) 返回 false 的条目跳过；Windows 宿主上符号链接一律跳过（只需要真实文件）。
 */
export function extractTarGz(tarGzPath, destDir, { filter = () => true } = {}) {
  const tar = zlib.gunzipSync(fs.readFileSync(tarGzPath))
  fs.mkdirSync(destDir, { recursive: true })
  let p = 0
  let longName = null
  let count = 0
  while (p + 512 <= tar.length) {
    const header = tar.subarray(p, p + 512)
    if (header.every((b) => b === 0)) break
    const size = tarOctal(header, 124, 12)
    const type = String.fromCharCode(header[156] || 48)
    const dataStart = p + 512
    const data = tar.subarray(dataStart, dataStart + size)
    p = dataStart + Math.ceil(size / 512) * 512
    if (type === 'L') {
      longName = tarString(data, 0, data.length)
      continue
    }
    if (type === 'x') {
      const m = data.toString('utf8').match(/^\d+ path=(.*)$/m)
      if (m) longName = m[1]
      continue
    }
    if (type === 'g') continue
    const prefix = tarString(header, 345, 155)
    let name = longName || (prefix ? `${prefix}/${tarString(header, 0, 100)}` : tarString(header, 0, 100))
    longName = null
    name = name.replace(/^\.\//, '')
    if (!name || !filter(name)) continue
    const out = safeJoin(destDir, name)
    if (type === '5') {
      fs.mkdirSync(out, { recursive: true })
    } else if (type === '0' || type === '\0' || type === '7') {
      fs.mkdirSync(path.dirname(out), { recursive: true })
      fs.writeFileSync(out, data)
      const mode = tarOctal(header, 100, 8)
      if (process.platform !== 'win32' && mode & 0o111) fs.chmodSync(out, mode & 0o777)
      count++
    } else if (type === '2' && process.platform !== 'win32') {
      fs.mkdirSync(path.dirname(out), { recursive: true })
      fs.rmSync(out, { force: true })
      fs.symlinkSync(tarString(header, 157, 100), out)
    }
  }
  return count
}

/** 下载缓存完整性：zip 读得出中央目录、tar.gz 能完整解压，才算可用 */
export function archiveLooksValid(file) {
  try {
    if (file.endsWith('.zip')) return listZip(file).length > 0
    if (file.endsWith('.tar.gz') || file.endsWith('.tgz')) return zlib.gunzipSync(fs.readFileSync(file)).length > 512
    return true
  } catch {
    return false
  }
}
