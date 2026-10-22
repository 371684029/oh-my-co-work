import fs from 'node:fs'
import path from 'node:path'
import { lstat, realpath, readdir } from 'node:fs/promises'

function confinedUnder(root, candidate) {
  const r = path.resolve(root)
  const c = path.resolve(candidate)
  return c === r || c.startsWith(r + path.sep)
}

export function assertRegularFile(abs, label = '文件') {
  const st = fs.lstatSync(abs)
  if (st.isSymbolicLink()) {
    throw Object.assign(new Error(`${label}不能是符号链接`), { code: 'SYMLINK' })
  }
  if (!st.isFile()) {
    throw Object.assign(new Error(`${label}不是普通文件`), { code: 'BAD_FILE' })
  }
}

/**
 * 拒绝符号链接及逃出 root 的路径，防止备份/恢复把 journals 种到 DATA_ROOT 外。
 */
export function assertTreeNoSymlinks(root) {
  if (!fs.existsSync(root)) return
  const rootReal = fs.realpathSync(root)
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name)
      if (e.isSymbolicLink()) {
        throw Object.assign(new Error(`备份含符号链接：${path.relative(root, abs) || e.name}`), {
          code: 'SYMLINK',
        })
      }
      if (e.isDirectory()) {
        const real = fs.realpathSync(abs)
        if (!confinedUnder(rootReal, real)) {
          throw Object.assign(new Error(`备份路径越界：${path.relative(root, abs) || e.name}`), {
            code: 'ESCAPE',
          })
        }
        walk(abs)
      } else if (e.isFile()) {
        const real = fs.realpathSync(abs)
        if (!confinedUnder(rootReal, real)) {
          throw Object.assign(new Error(`备份路径越界：${path.relative(root, abs) || e.name}`), {
            code: 'ESCAPE',
          })
        }
      }
    }
  }
  walk(root)
}

export async function assertRegularFileAsync(abs, label = '文件') {
  const st = await lstat(abs)
  if (st.isSymbolicLink()) {
    throw Object.assign(new Error(`${label}不能是符号链接`), { code: 'SYMLINK' })
  }
  if (!st.isFile()) {
    throw Object.assign(new Error(`${label}不是普通文件`), { code: 'BAD_FILE' })
  }
}

export async function assertTreeNoSymlinksAsync(root) {
  let rootStat
  try {
    rootStat = await lstat(root)
  } catch (e) {
    if (e.code === 'ENOENT') return
    throw e
  }
  if (rootStat.isSymbolicLink()) {
    throw Object.assign(new Error('备份含符号链接：.'), { code: 'SYMLINK' })
  }
  const rootReal = await realpath(root)
  const pending = [root]
  while (pending.length) {
    const dir = pending.pop()
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name)
      if (e.isSymbolicLink()) {
        throw Object.assign(new Error(`备份含符号链接：${path.relative(root, abs)}`), {
          code: 'SYMLINK',
        })
      }
      if (e.isDirectory() || e.isFile()) {
        const real = await realpath(abs)
        if (!confinedUnder(rootReal, real)) {
          throw Object.assign(new Error(`备份路径越界：${path.relative(root, abs)}`), {
            code: 'ESCAPE',
          })
        }
        if (e.isDirectory()) pending.push(abs)
      }
    }
  }
}
