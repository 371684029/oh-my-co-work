/**
 * 本机路径浏览（本地单机工具：供设置里选工作目录 / 脚本文件）
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'

const isWin = process.platform === 'win32'

/** 盘符 / 根目录列表 */
export function listRoots() {
  const roots = []
  if (isWin) {
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i)
      const p = `${letter}:\\`
      try {
        if (fs.existsSync(p)) {
          roots.push({
            name: `${letter}:`,
            path: p,
            type: 'drive',
          })
        }
      } catch {
        /* ignore */
      }
    }
  } else {
    roots.push({ name: '/', path: '/', type: 'drive' })
  }

  const home = os.homedir()
  if (home && fs.existsSync(home)) {
    roots.unshift({
      name: '用户目录',
      path: home,
      type: 'home',
    })
  }

  const cwd = process.cwd()
  if (cwd && fs.existsSync(cwd)) {
    roots.unshift({
      name: '项目目录',
      path: cwd,
      type: 'cwd',
    })
  }

  return roots
}

function safeResolve(input) {
  if (!input || typeof input !== 'string') return null
  let p = input.trim()
  if (!p) return null
  // 统一分隔符展示，内部用系统 path
  try {
    p = path.resolve(p)
  } catch {
    return null
  }
  return p
}

/**
 * @param {string} dirPath
 * @param {{ mode?: 'folder'|'file'|'all', extensions?: string[] }} opts
 */
export function listDir(dirPath, opts = {}) {
  const mode = opts.mode || 'all'
  const exts = (opts.extensions || [])
    .map((e) => String(e).toLowerCase().replace(/^\./, ''))
    .filter(Boolean)

  const abs = safeResolve(dirPath)
  if (!abs) throw new Error('无效路径')
  if (!fs.existsSync(abs)) throw new Error('路径不存在')

  const st = fs.statSync(abs)
  if (!st.isDirectory()) throw new Error('不是文件夹')

  let names
  try {
    names = fs.readdirSync(abs)
  } catch (e) {
    throw new Error(e.message || '无法读取目录')
  }

  const parent = path.dirname(abs)
  const entries = []

  // 上级（根盘符时 parent 可能等于自身）
  if (parent && parent !== abs) {
    entries.push({
      name: '..',
      path: parent,
      type: 'dir',
      isParent: true,
    })
  }

  const dirs = []
  const files = []

  for (const name of names) {
    if (name === '.' || name === '..') continue
    // 隐藏项：Windows 可略过以 . 开头的（可选保留）
    const full = path.join(abs, name)
    let stat
    try {
      stat = fs.statSync(full)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      dirs.push({
        name,
        path: full,
        type: 'dir',
        isParent: false,
      })
    } else if (stat.isFile()) {
      if (mode === 'folder') continue
      if (exts.length) {
        const ext = path.extname(name).toLowerCase().replace(/^\./, '')
        if (!exts.includes(ext)) continue
      }
      files.push({
        name,
        path: full,
        type: 'file',
        size: stat.size,
      })
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  files.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))

  const list =
    mode === 'folder' ? [...entries, ...dirs] : [...entries, ...dirs, ...files]

  return {
    path: abs,
    parent: parent !== abs ? parent : null,
    entries: list,
  }
}

export function pathExists(p) {
  const abs = safeResolve(p)
  if (!abs) return { ok: false }
  try {
    const st = fs.statSync(abs)
    return {
      ok: true,
      path: abs,
      isDirectory: st.isDirectory(),
      isFile: st.isFile(),
    }
  } catch {
    return { ok: false, path: abs }
  }
}

/**
 * 用系统默认程序打开本机文件/文件夹（Windows start / macOS open / xdg-open）
 * @param {string} targetPath
 * @returns {Promise<{ ok: true, path: string }>}
 */
export function openLocalPath(targetPath) {
  const abs = safeResolve(targetPath)
  if (!abs) return Promise.reject(new Error('无效路径'))
  if (!fs.existsSync(abs)) return Promise.reject(new Error('路径不存在'))

  return new Promise((resolve, reject) => {
    let child
    if (process.platform === 'win32') {
      child = spawn('cmd', ['/c', 'start', '', abs], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
    } else if (process.platform === 'darwin') {
      child = spawn('open', [abs], { detached: true, stdio: 'ignore' })
    } else {
      child = spawn('xdg-open', [abs], { detached: true, stdio: 'ignore' })
    }
    child.on('error', reject)
    child.unref()
    setTimeout(() => resolve({ ok: true, path: abs }), 80)
  })
}
