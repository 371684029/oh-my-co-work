#!/usr/bin/env node
/* global process, console, URL, Buffer */
/**
 * 熔炉管理协同台的官方 CLI（写到 data/furnace/acw-ctl.mjs，并在 AGENTS.md 声明）。
 *
 * 之前熔炉要「添加群成员 / 建群 / 加步骤」时，只能自己翻源码、猜 SQLite 表结构，
 * 既慢又容易写错 config_json（缺 scriptWorkDir、写错 kind/executionMode）。
 * 现在统一调本机 HTTP API，走与前端设置页完全同一套校验、参数补全与炼化逻辑。
 */
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'

const BASE = (process.env.ACW_API_URL || `http://127.0.0.1:${process.env.ACW_PORT || 3780}`).replace(/\/+$/, '')

function httpJson(method, fullUrl, headers = {}, body) {
  const u = new URL(fullUrl)
  const lib = u.protocol === 'https:' ? https : http
  const payload = body !== undefined ? Buffer.from(JSON.stringify(body), 'utf8') : null
  return new Promise((resolve, reject) => {
    const req = lib.request(
      u,
      {
        method,
        headers: {
          ...headers,
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': String(payload.length) } : {}),
        },
        timeout: 15000,
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          resolve({ status: res.statusCode || 0, text })
        })
      },
    )
    req.on('timeout', () => req.destroy(new Error(`请求超时: ${fullUrl}`)))
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

let cachedToken = process.env.ACW_API_TOKEN || ''
async function token() {
  if (cachedToken) return cachedToken
  const r = await httpJson('GET', `${BASE}/api/bootstrap`, { Origin: BASE })
  if (r.status !== 200) {
    throw new Error(`获取本地令牌失败 (${r.status})，请确认 oh-my-co-work 服务正在运行 (${BASE})`)
  }
  cachedToken = JSON.parse(r.text || '{}').token || ''
  return cachedToken
}

async function api(method, urlPath, body) {
  const tk = await token()
  const r = await httpJson(
    method,
    `${BASE}/api${urlPath}`,
    { 'X-ACW-Token': tk, Origin: BASE },
    body,
  )
  if (r.status === 204) return { ok: true }
  let data
  try {
    data = r.text ? JSON.parse(r.text) : {}
  } catch {
    data = { raw: r.text }
  }
  if (r.status < 200 || r.status >= 300) {
    throw new Error(data?.error || `HTTP ${r.status}: ${r.text}`)
  }
  return data
}

function parseFlags(argv) {
  const pos = []
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) {
      pos.push(a)
      continue
    }
    const eq = a.indexOf('=')
    if (eq > 0) {
      flags[a.slice(2, eq)] = a.slice(eq + 1)
    } else {
      const k = a.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        flags[k] = next
        i++
      } else {
        flags[k] = 'true'
      }
    }
  }
  return { pos, flags }
}

const bool = (v, d = false) =>
  v === undefined ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase())

function inferCwdFromCommand(cmd) {
  const m = String(cmd || '').match(/([A-Za-z]:[\\/][^\s"']+|\/[^\s"']+)/)
  if (!m) return ''
  return path.dirname(m[1])
}

function buildMemberPayload(flags) {
  const name = flags.name || flags.display || flags['display-name']
  if (!name) throw new Error('缺少 --name <成员名称>')
  const kind = flags.kind || (flags.cmd || flags.command || flags.file ? 'script' : 'echo')
  const cwd = path.resolve(
    flags.cwd || flags.dir || flags['work-dir'] || inferCwdFromCommand(flags.cmd || flags.command || flags.file) || process.cwd(),
  )
  const config = {}
  if (kind === 'script') {
    const mode = flags.file ? 'file' : 'command'
    const cmd = flags.cmd || flags.command || ''
    if (mode === 'command' && !cmd) {
      throw new Error('脚本成员必须传 --cmd "<命令>"（支持 #1 #2 参数占位）或 --file "<脚本路径>"')
    }
    config.script = {
      mode,
      command: cmd,
      filePath: flags.file ? path.resolve(flags.file) : '',
      args: flags.args || '',
      scriptWorkDir: cwd,
      scriptDir: cwd,
      executionMode: flags.pipe === 'true' || flags.exec === 'pipe' ? 'pipe' : 'terminal',
      waitForExit: flags.keepalive === 'true' ? false : true,
    }
  } else if (flags.text) {
    config.defaultText = flags.text
  }
  if (bool(flags.refine)) config.refine = { enabled: true }
  return {
    name: flags.slug || String(name).replace(/\s+/g, '_'),
    displayName: name,
    kind,
    workFolder: cwd,
    config,
  }
}

function parseStepSpec(spec, index, members) {
  if (spec && typeof spec === 'object') return spec
  // 简写：human:标题  或  成员名或ID:步骤标题[:gate|:auto]
  const parts = String(spec).split(':')
  const head = parts[0]?.trim()
  if (head === 'human' || head === '人工') {
    return {
      title: parts[1]?.trim() || `人工输入 ${index + 1}`,
      type: 'human',
      captureParams: index === 0,
      gate: true,
      flow: { human: true, admin: false, auto: false },
    }
  }
  const m = members.find(
    (x) => x.id === head || x.display_name === head || x.name === head,
  )
  if (!m) {
    throw new Error(
      `找不到成员「${head}」，现有成员：${members.map((x) => `${x.display_name}(${x.id})`).join('、')}`,
    )
  }
  const mode = (parts[2] || '').trim().toLowerCase()
  const needHuman = mode === 'gate' || mode === 'human' || mode === '人工'
  return {
    title: parts[1]?.trim() || m.display_name,
    type: 'member',
    memberId: m.id,
    gate: needHuman,
    flow: needHuman
      ? { human: true, admin: false, auto: false }
      : { human: false, admin: false, auto: true },
  }
}

const HELP = `用法：node acw-ctl.mjs <动作> [参数]

成员（Member）：
  members                                    列出全部成员
  add-member --name "名称" --cmd "命令 #1" --cwd "D:\\work\\tool" [--pipe] [--keepalive] [--refine]
  add-member --name "名称" --file "D:\\work\\run.bat" [--args "#1"] [--cwd "D:\\work"]
  update-member --id <mem_id|名称> [--name ..] [--cmd ..] [--cwd ..] [--pipe|--terminal]
  delete-member --id <mem_id|名称>

源码备份（改成员脚本前必须先调，文档中心「节点炼化与还原」可查看 diff 并一键还原）：
  backup-source --member <mem_id|名称> [--files "D:/work/a.js,D:/work/b.js"] [--kind refine|adapt]

群模板 / 工作流（Group）：
  groups                                     列出全部群模板及步骤
  add-group --title "群名称" [--desc "简介"] [--cwd "D:\\work"] --steps "human:输入参数,newBranch:新建分支,cursor:完成开发:gate"
  append-step --group <grp_id|群名> --member <mem_id|成员名> [--title "步骤标题"] [--gate]

说明：
  • #1 #2 #3… 是工作流参数占位符（同时注入 ACW_PARAM_1…n、ACW_PARAMS_JSON、ACW_HUMAN_INPUT；成员命令可少写几个 #，其余仍走环境变量）
  • 默认在「内嵌终端（terminal）」跑并等待退出（waitForExit=true）；常驻 TUI 加 --keepalive；纯后台静默跑加 --pipe
  • --steps 逗号分隔，每项格式：「human:标题」或「成员名或ID:步骤标题[:gate]」（加 :gate 表示跑完需人工确认）`

async function main() {
  const { pos, flags } = parseFlags(process.argv.slice(2))
  const cmd = pos[0]
  if (!cmd || cmd === 'help' || flags.help) {
    console.log(HELP)
    return
  }
  if (cmd === 'members' || cmd === 'list-members') {
    const list = await api('GET', '/members')
    for (const m of list) {
      const s = m.config?.script
      console.log(
        `${m.id}\t${m.display_name}\tkind=${m.kind}\tmode=${s?.executionMode || '-'}\tcwd=${s?.scriptWorkDir || m.work_folder || '-'}\tcmd=${s?.command || s?.filePath || '-'}`,
      )
    }
    return
  }
  if (cmd === 'add-member') {
    const payload = buildMemberPayload(flags)
    // 同名成员已存在时直接更新，避免重复建出一堆同名项
    const existing = (await api('GET', '/members')).find(
      (m) => m.display_name === payload.displayName || m.name === payload.displayName,
    )
    if (existing) {
      payload.config = { ...(existing.config || {}), ...(payload.config || {}) }
    }
    const out = existing
      ? await api('PATCH', `/members/${existing.id}`, payload)
      : await api('POST', '/members', payload)
    console.log(JSON.stringify({ action: existing ? 'updated' : 'created', member: out }, null, 2))
    return
  }
  if (cmd === 'update-member') {
    const key = flags.id || pos[1]
    const list = await api('GET', '/members')
    const target = list.find((m) => m.id === key || m.display_name === key || m.name === key)
    if (!target) throw new Error(`找不到成员：${key}`)
    const mergedFlags = {
      name: flags.name || target.display_name,
      kind: flags.kind || target.kind,
      cmd: flags.cmd || flags.command || target.config?.script?.command,
      file: flags.file || target.config?.script?.filePath,
      cwd: flags.cwd || target.config?.script?.scriptWorkDir || target.work_folder,
      pipe: flags.pipe ?? (target.config?.script?.executionMode === 'pipe' ? 'true' : 'false'),
      keepalive: flags.keepalive ?? (target.config?.script?.waitForExit === false ? 'true' : 'false'),
    }
    const nextPayload = buildMemberPayload(mergedFlags)
    nextPayload.config = { ...(target.config || {}), ...(nextPayload.config || {}) }
    const out = await api('PATCH', `/members/${target.id}`, nextPayload)
    console.log(JSON.stringify({ action: 'updated', member: out }, null, 2))
    return
  }
  if (cmd === 'backup-source') {
    const key = flags.member || flags.id || pos[1]
    const list = await api('GET', '/members')
    const target = list.find((m) => m.id === key || m.display_name === key || m.name === key)
    if (!target) throw new Error(`找不到成员：${key}`)
    const files = flags.files
      ? String(flags.files)
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
      : []
    const out = await api('POST', `/members/${target.id}/source-backup`, {
      files,
      kind: flags.kind || 'refine',
    })
    console.log(JSON.stringify(out, null, 2))
    return
  }
  if (cmd === 'delete-member') {
    const key = flags.id || pos[1]
    const list = await api('GET', '/members')
    const target = list.find((m) => m.id === key || m.display_name === key || m.name === key)
    if (!target) throw new Error(`找不到成员：${key}`)
    await api('DELETE', `/members/${target.id}`)
    console.log(JSON.stringify({ action: 'deleted', id: target.id, name: target.display_name }))
    return
  }
  if (cmd === 'groups' || cmd === 'list-groups') {
    const list = await api('GET', '/groups')
    for (const g of list) {
      const steps = (g.steps || []).map((s, i) => `${i + 1}.${s.title}(${s.type}:${s.memberId || 'human'})`).join(' -> ')
      console.log(`${g.id}\t${g.title}\t${steps}`)
    }
    return
  }
  if (cmd === 'add-group') {
    const title = flags.title || flags.name
    if (!title) throw new Error('缺少 --title <群名称>')
    const members = await api('GET', '/members')
    const rawSteps = flags.stepsJson
      ? JSON.parse(flags.stepsJson)
      : String(flags.steps || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s, i) => parseStepSpec(s, i, members))
    const payload = {
      title,
      description: flags.desc || flags.description || '',
      workFolder: flags.cwd ? path.resolve(flags.cwd) : null,
      steps: rawSteps,
    }
    const existing = (await api('GET', '/groups')).find((g) => g.title === title)
    const out = existing
      ? await api('PATCH', `/groups/${existing.id}`, payload)
      : await api('POST', '/groups', payload)
    console.log(JSON.stringify({ action: existing ? 'updated' : 'created', group: out }, null, 2))
    return
  }
  if (cmd === 'append-step') {
    const gKey = flags.group || pos[1]
    const mKey = flags.member || pos[2]
    const groups = await api('GET', '/groups')
    const group = groups.find((g) => g.id === gKey || g.title === gKey)
    if (!group) throw new Error(`找不到群模板：${gKey}`)
    const members = await api('GET', '/members')
    const spec = `${mKey}:${flags.title || ''}${bool(flags.gate) ? ':gate' : ''}`
    const step = parseStepSpec(spec, (group.steps || []).length, members)
    const steps = [...(group.steps || []), step]
    const out = await api('PATCH', `/groups/${group.id}`, { steps })
    console.log(JSON.stringify({ action: 'appended', group: out }, null, 2))
    return
  }
  throw new Error(`未知动作：${cmd}\n\n${HELP}`)
}

main().catch((e) => {
  console.error('[acw-ctl] ERROR:', e.message || e)
  process.exit(1)
})
