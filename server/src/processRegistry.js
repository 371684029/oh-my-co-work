/**
 * 会话进程注册表：释放资源 / 归档时杀掉进程树，避免 bat 残留占内存
 * Start-Process 弹出的真实脚本 PID 也会写入会话 pid 文件，归档时一并杀
 */
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { DATA_ROOT } from './db.js'

/**
 * @type {Map<string, Map<string, {
 *   pid: number,
 *   kind: string,
 *   label: string,
 *   memberId?: string|null,
 *   startedAt: string,
 *   child?: import('node:child_process').ChildProcess
 * }>>}
 */
const bySession = new Map()

function ensureSession(sessionId) {
  if (!bySession.has(sessionId)) bySession.set(sessionId, new Map())
  return bySession.get(sessionId)
}

function sessionPidFile(sessionId) {
  return path.join(DATA_ROOT, 'console', `session_${sessionId}.pids`)
}

function runPidFile(sessionId, runId) {
  return path.join(DATA_ROOT, 'console', `run_${sessionId}_${runId}.pid`)
}

/** 会话级持久化 PID，避免仅内存表、或 Start-Process 子进程漏登 */
export function rememberSessionPid(sessionId, pid, tag = '') {
  if (!sessionId || !pid || pid <= 0) return
  try {
    const dir = path.join(DATA_ROOT, 'console')
    fs.mkdirSync(dir, { recursive: true })
    const line = `${pid}${tag ? `\t${tag}` : ''}\n`
    fs.appendFileSync(sessionPidFile(sessionId), line, 'utf8')
  } catch {
    /* ignore */
  }
}

function readSessionPidsFromDisk(sessionId) {
  const f = sessionPidFile(sessionId)
  if (!fs.existsSync(f)) return []
  try {
    const text = fs.readFileSync(f, 'utf8')
    const pids = []
    for (const line of text.split(/\r?\n/)) {
      const n = parseInt(String(line).split(/\s|\t/)[0], 10)
      if (Number.isFinite(n) && n > 0) pids.push(n)
    }
    return [...new Set(pids)]
  } catch {
    return []
  }
}

function clearSessionPidFile(sessionId) {
  try {
    const f = sessionPidFile(sessionId)
    if (fs.existsSync(f)) fs.unlinkSync(f)
  } catch {
    /* ignore */
  }
}

export function registerProcess(sessionId, runId, entry) {
  if (!sessionId || !runId || !entry?.pid) return
  const map = ensureSession(sessionId)
  map.set(runId, {
    pid: entry.pid,
    kind: entry.kind || 'script',
    label: entry.label || '',
    memberId: entry.memberId || null,
    startedAt: entry.startedAt || new Date().toISOString(),
    child: entry.child || null,
    /** 仅唤起：节点结束 / 待确认归档不要杀；真正归档仍杀 */
    detach: !!entry.detach,
  })
  rememberSessionPid(sessionId, entry.pid, entry.kind || runId)
}

export function unregisterProcess(sessionId, runId) {
  const map = bySession.get(sessionId)
  if (!map) return
  map.delete(runId)
  if (map.size === 0) bySession.delete(sessionId)
}

export function listSessionProcesses(sessionId, { includeDisk = true } = {}) {
  const out = []
  const seen = new Set()
  const map = bySession.get(sessionId)
  if (map) {
    for (const [runId, v] of map.entries()) {
      if (v.pid) seen.add(v.pid)
      out.push({
        runId,
        pid: v.pid,
        kind: v.kind,
        label: v.label,
        memberId: v.memberId || null,
        startedAt: v.startedAt,
        detach: !!v.detach,
        orphanRisk: !!v.detach,
        source: 'memory',
      })
    }
  }
  if (includeDisk) {
    for (const pid of readSessionPidsFromDisk(sessionId)) {
      if (seen.has(pid)) continue
      seen.add(pid)
      out.push({
        runId: null,
        pid,
        kind: 'disk',
        label: '磁盘登记（可能需手动关窗）',
        memberId: null,
        startedAt: null,
        detach: true,
        orphanRisk: true,
        source: 'disk',
      })
    }
  }
  return out
}

/** 清理已归档会话残留的 console pid 文件（启动对账） */
export function cleanupArchivedSessionPidFiles(sessionIds) {
  const ids = Array.isArray(sessionIds) ? sessionIds : []
  let cleared = 0
  for (const id of ids) {
    try {
      clearSessionPidFile(id)
      const dir = path.join(DATA_ROOT, 'console')
      if (!fs.existsSync(dir)) continue
      for (const name of fs.readdirSync(dir)) {
        if (name.startsWith(`run_${id}_`) && name.endsWith('.pid')) {
          try {
            fs.unlinkSync(path.join(dir, name))
          } catch {
            /* ignore */
          }
        }
      }
      cleared += 1
    } catch {
      /* ignore */
    }
  }
  return { cleared }
}

/**
 * 同一会话内同一成员只保留一个脚本进程：启动新 bat 前先清掉该成员旧进程（含控制窗）
 * @param {{ includeDetach?: boolean }} [opts] includeDetach=true 时连「仅唤起」窗口一并杀（新开前清旧）
 */
export function killMemberProcesses(sessionId, memberId, opts = {}) {
  if (!sessionId || !memberId) return { killed: 0, pids: [] }
  const map = bySession.get(sessionId)
  if (!map || map.size === 0) return { killed: 0, pids: [] }
  const includeDetach = opts.includeDetach === true

  const pids = []
  for (const [id, entry] of [...map.entries()]) {
    if (entry.memberId !== memberId) continue
    // 默认保留 detach 窗口，避免节点「已打开」后立刻被杀掉闪退
    if (entry.detach && !includeDetach) continue
    pids.push(entry.pid)
    killEntry(entry)
    map.delete(id)
  }
  if (map.size === 0) bySession.delete(sessionId)
  return { killed: pids.length, pids, scope: 'member', memberId }
}

/** 杀掉单个 PID 的进程树（Windows: taskkill /T /F，同步尽力） */
export function killProcessTree(pid) {
  if (!pid || pid <= 0) return
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
        timeout: 8000,
      })
    } catch {
      try {
        spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
          detached: true,
        }).unref()
      } catch {
        /* ignore */
      }
    }
    return
  }
  try {
    process.kill(-pid, 'SIGTERM')
  } catch {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      try {
        process.kill(pid, 'SIGKILL')
      } catch {
        /* ignore */
      }
    }
  }
}

function killEntry(entry) {
  if (!entry) return
  try {
    if (entry.child && !entry.child.killed) {
      try {
        entry.child.kill('SIGTERM')
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  killProcessTree(entry.pid)
}

/**
 * 释放资源：结束会话进程（内存表 + 磁盘 pid 清单）
 * 归档 / 超时归档 / 手动释放 均走此入口
 * @param {string} sessionId
 * @param {{ runId?: string, includeDetach?: boolean }} [opts]
 *   runId：只杀本次运行及其控制窗
 *   includeDetach：默认 true；false 时保留「仅唤起」窗口（待确认归档用）
 */
export function killSessionProcesses(sessionId, opts = {}) {
  if (!sessionId) return { killed: 0, pids: [] }
  const map = bySession.get(sessionId)
  const pids = []
  const runId = opts.runId
  const includeDetach = opts.includeDetach !== false
  const seen = new Set()
  /** @type {Set<number>} */
  const preservePids = new Set()

  const addKillPid = (pid) => {
    if (!pid || pid <= 0 || seen.has(pid) || preservePids.has(pid)) return
    seen.add(pid)
    pids.push(pid)
    killProcessTree(pid)
  }

  if (runId) {
    const keys = [runId, `${runId}_hta`, `${runId}_target`]
    if (map) {
      for (const key of keys) {
        const entry = map.get(key)
        if (!entry) continue
        if (!includeDetach && entry.detach) {
          preservePids.add(entry.pid)
          continue
        }
        addKillPid(entry.pid)
        killEntry(entry)
        map.delete(key)
      }
      if (map.size === 0) bySession.delete(sessionId)
    }
    // 本次 run 的目标 pid 文件（Start-Process 真实脚本）
    try {
      const rf = runPidFile(sessionId, runId)
      if (fs.existsSync(rf)) {
        const n = parseInt(fs.readFileSync(rf, 'utf8').trim(), 10)
        if (Number.isFinite(n) && (includeDetach || !preservePids.has(n))) addKillPid(n)
        if (includeDetach || !preservePids.has(n)) fs.unlinkSync(rf)
      }
    } catch {
      /* ignore */
    }
    return { killed: pids.length, pids, scope: 'run', preserved: [...preservePids] }
  }

  // 整会话：内存表
  if (map) {
    for (const [id, entry] of [...map.entries()]) {
      if (!includeDetach && entry.detach) {
        preservePids.add(entry.pid)
        continue
      }
      addKillPid(entry.pid)
      killEntry(entry)
      map.delete(id)
    }
    if (map.size === 0) bySession.delete(sessionId)
  }

  // 磁盘会话 pid 清单（含 Start-Process 子进程、HTA）；跳过保留的 detach
  for (const pid of readSessionPidsFromDisk(sessionId)) {
    addKillPid(pid)
  }
  if (preservePids.size > 0) {
    try {
      const dir = path.join(DATA_ROOT, 'console')
      fs.mkdirSync(dir, { recursive: true })
      const lines = [...preservePids].map((p) => `${p}\tdetach\n`).join('')
      fs.writeFileSync(sessionPidFile(sessionId), lines, 'utf8')
    } catch {
      /* ignore */
    }
  } else {
    clearSessionPidFile(sessionId)
  }

  // 清理该会话残留 run_*.pid（detach 的 target 文件保留，供真正归档杀）
  try {
    const dir = path.join(DATA_ROOT, 'console')
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        if (name.startsWith(`run_${sessionId}_`) && name.endsWith('.pid')) {
          try {
            const n = parseInt(fs.readFileSync(path.join(dir, name), 'utf8').trim(), 10)
            if (Number.isFinite(n) && preservePids.has(n)) continue
            if (Number.isFinite(n)) addKillPid(n)
            fs.unlinkSync(path.join(dir, name))
          } catch {
            /* ignore */
          }
        }
      }
    }
  } catch {
    /* ignore */
  }

  if (pids.length) {
    console.log(`[acw] killSessionProcesses ${sessionId}: ${pids.length} pid(s) ${pids.join(',')}`)
  }
  if (preservePids.size) {
    console.log(
      `[acw] killSessionProcesses ${sessionId}: preserved detach ${[...preservePids].join(',')}`,
    )
  }
  return { killed: pids.length, pids, scope: 'session', preserved: [...preservePids] }
}

/** 供 runners 写入 Start-Process 真实 PID */
export function writeRunTargetPid(sessionId, runId, pid) {
  if (!sessionId || !runId || !pid) return
  try {
    const dir = path.join(DATA_ROOT, 'console')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(runPidFile(sessionId, runId), String(pid), 'utf8')
    rememberSessionPid(sessionId, pid, 'target')
  } catch {
    /* ignore */
  }
}

export function getRunPidFilePath(sessionId, runId) {
  return runPidFile(sessionId, runId)
}

/**
 * Windows 左上角进程控制小窗
 * 主操作：释放资源（只杀进程，不归档）
 * 次操作：归档任务（杀进程 + 归档会话）
 */
export function launchArchiveControlWindow({ sessionId, runId, title, apiBase }) {
  if (process.platform !== 'win32') return null
  const dir = path.join(DATA_ROOT, 'console')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `ctl_${sessionId}_${runId}.hta`)
  const base = (
    apiBase || `http://127.0.0.1:${process.env.ACW_PORT || process.env.ECW_PORT || 3780}`
  ).replace(/\/$/, '')
  const safeTitle = String(title || '会话进程').replace(/[<>&"]/g, '')
  const rid = String(runId || '').replace(/"/g, '')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>ECW 释放资源 · ${safeTitle}</title>
<HTA:APPLICATION
  ID="ecwCtl"
  APPLICATIONNAME="apple-co-work-console"
  BORDER="thin"
  BORDERSTYLE="normal"
  CAPTION="yes"
  MAXIMIZEBUTTON="no"
  MINIMIZEBUTTON="yes"
  SHOWINTASKBAR="yes"
  SINGLEINSTANCE="no"
  SYSMENU="yes"
  SCROLL="no"
  WINDOWSTATE="normal"
/>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    width: 100%; height: 100%;
    background: #0f1115;
    color: #e8eaed;
    font-family: "Microsoft YaHei UI", "Segoe UI", sans-serif;
    overflow: hidden;
  }
  .wrap {
    padding: 10px 12px 12px;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }
  .label {
    font-size: 10.5px;
    color: #8b919a;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .title {
    margin-top: 3px;
    font-size: 12.5px;
    font-weight: 650;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 210px;
  }
  .dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #67c23a;
    box-shadow: 0 0 0 3px rgba(103,194,58,0.25);
    margin-top: 4px;
    flex-shrink: 0;
  }
  .btn-primary {
    border: none;
    border-radius: 9px;
    background: linear-gradient(180deg, #5cadff, #409eff);
    color: #fff;
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
    padding: 11px 10px;
  }
  .row-secondary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .link {
    border: none;
    background: transparent;
    color: #8b919a;
    font-size: 11.5px;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }
  .sub { font-size: 10.5px; color: #6b7280; }
  .status { font-size: 11px; color: #67c23a; min-height: 14px; }
</style>
<script language="JScript">
var busy = false;
function post(path, body) {
  try {
    var xhr = new ActiveXObject("MSXML2.XMLHTTP");
    xhr.open("POST", "${base}" + path, false);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(body || "{}");
    return xhr.status;
  } catch (e) {
    return -1;
  }
}
function setStatus(t, ok) {
  var el = document.getElementById("status");
  if (!el) return;
  el.innerText = t || "";
  el.style.color = ok ? "#67c23a" : "#f56c6c";
}
function freeResources() {
  if (busy) return;
  busy = true;
  var btn = document.getElementById("btnFree");
  if (btn) { btn.disabled = true; btn.innerText = "释放中…"; }
  var code = post("/api/sessions/${sessionId}/kill-processes", "{}");
  if (code >= 200 && code < 300) {
    if (btn) { btn.innerText = "已释放资源"; }
    setStatus("进程已结束，窗口即将关闭", true);
    window.setTimeout(function () { try { window.close(); } catch (e2) {} }, 650);
  } else {
    busy = false;
    if (btn) { btn.disabled = false; btn.innerText = "释放资源"; }
    setStatus("释放失败，请确认本机服务已启动", false);
  }
}
function archiveTask() {
  if (busy) return;
  if (!confirm("将结束进程并归档本任务，确定？")) return;
  busy = true;
  // 先杀进程再归档（归档接口也会再杀一次）
  post("/api/sessions/${sessionId}/kill-processes", "{}");
  post("/api/sessions/${sessionId}/archive", "{}");
  setStatus("已归档任务", true);
  window.setTimeout(function () { try { window.close(); } catch (e3) {} }, 400);
}
function onLoad() {
  try {
    window.moveTo(12, 12);
    window.resizeTo(268, 176);
  } catch (e) {}
}
</script>
</head>
<body onload="onLoad()">
  <div class="wrap">
    <div class="top">
      <div>
        <div class="label">ECW · 进程控制</div>
        <div class="title" title="${safeTitle}">${safeTitle}</div>
      </div>
      <div id="dot" class="dot" title="运行中"></div>
    </div>
    <button id="btnFree" type="button" class="btn-primary" onclick="freeResources()">释放资源</button>
    <div class="row-secondary">
      <span class="sub">只结束进程，不归档任务</span>
      <button type="button" class="link" onclick="archiveTask()">顺便归档任务</button>
    </div>
    <div id="status" class="status"></div>
  </div>
</body>
</html>
`
  fs.writeFileSync(file, html, 'utf8')
  try {
    const child = spawn('mshta.exe', [file], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    })
    child.unref()
    if (child.pid) rememberSessionPid(sessionId, child.pid, 'hta')
    return { htaPath: file, pid: child.pid }
  } catch {
    return null
  }
}

/** @deprecated 使用 launchArchiveControlWindow */
export const launchResourceControlWindow = launchArchiveControlWindow
