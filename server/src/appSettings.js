import fs from 'node:fs'
import path from 'node:path'
import { ROOT, getDb, parseJson } from './db.js'
import { killSessionProcesses } from './processRegistry.js'
import { defaultStepFlow, normalizeFurnaceSurface } from '@acw/shared'

const SETTINGS_PATH = path.join(ROOT, 'server/config/app-settings.json')

const DEMO_MEMBER_NAMES = new Set(['echo', 'script_cmd'])
const DEMO_GROUP_TITLES = new Set(['演示流'])

export function isDemoMember(m) {
  if (!m) return false
  if (m.config?.demo === true || m.config?.isDemo === true) return true
  if (DEMO_MEMBER_NAMES.has(m.name)) return true
  if (String(m.display_name || '').startsWith('示例')) return true
  return false
}

export function isDemoGroup(g) {
  if (!g) return false
  if (g.demo === true || g.config?.demo === true) return true
  if (DEMO_GROUP_TITLES.has(g.title)) return true
  if (String(g.description || '').startsWith('MVP 演示')) return true
  return false
}

export function defaultAdaptSettings() {
  return { backup: true }
}

function normalizeAdapt(raw) {
  const d = defaultAdaptSettings()
  if (!raw || typeof raw !== 'object') return d
  return { backup: raw.backup !== false }
}

/** 本机 Grok TUI（默认已开启；关掉则熔炉不接 grok 命令） */
export function defaultGrokSettings() {
  return {
    command: 'grok',
    configured: true,
    /** chat=满屏气泡皮；tui=满屏原终端 */
    surface: 'chat',
  }
}

function normalizeGrok(raw) {
  const d = defaultGrokSettings()
  if (!raw || typeof raw !== 'object') return d
  const command = String(raw.command || d.command).trim() || d.command
  const off =
    raw.configured === false ||
    raw.configured === 'false' ||
    raw.configured === 0 ||
    raw.configured === '0'
  const surface = normalizeFurnaceSurface(raw.surface)
  return {
    command,
    configured: raw.configured === undefined || raw.configured === null ? d.configured : !off,
    surface,
  }
}

/** 全局熔炉（内部仍为 admin）默认配置 */
export function defaultAdminSettings() {
  return {
    /** 成员 name 键，优先匹配 */
    memberKey: 'unified_admin',
    /** 显式成员 id（可选，优先于 memberKey） */
    memberId: null,
    /** 新建步骤默认流转 */
    defaultFlow: defaultStepFlow(),
  }
}

function normalizeAdmin(raw) {
  const d = defaultAdminSettings()
  if (!raw || typeof raw !== 'object') return d
  const flow = raw.defaultFlow && typeof raw.defaultFlow === 'object' ? raw.defaultFlow : d.defaultFlow
  return {
    memberKey: raw.memberKey != null ? String(raw.memberKey) : d.memberKey,
    memberId: raw.memberId || null,
    defaultFlow: {
      admin: flow.admin !== false,
      auto: flow.auto !== false,
      human: flow.human !== false,
    },
  }
}

export function defaultTerminalSettings() {
  return {
    theme: 'project-dark',
    fontSize: 13,
    cursorBlink: true,
    pastePolicy: 'confirm',
    autoCollapseOnExit: false,
    scrollback: 5000,
  }
}

export function defaultQuotaSettings() {
  return {
    maxConcurrentTerminals: 8,
    maxLogMiB: 10,
    maxReplayKiB: 256,
  }
}

export function defaultRedactSettings() {
  return {
    enabled: true,
    patternsText: '',
  }
}

function clampInt(v, fallback, min, max) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

function normalizeTerminal(raw) {
  const d = defaultTerminalSettings()
  if (!raw || typeof raw !== 'object') return d
  const theme = ['project-dark', 'native', 'high-contrast'].includes(raw.theme)
    ? raw.theme
    : d.theme
  const pastePolicy = raw.pastePolicy === 'allow' ? 'allow' : 'confirm'
  return {
    theme,
    fontSize: clampInt(raw.fontSize, d.fontSize, 10, 22),
    cursorBlink: raw.cursorBlink !== false,
    pastePolicy,
    autoCollapseOnExit: !!raw.autoCollapseOnExit,
    scrollback: clampInt(raw.scrollback, d.scrollback, 200, 20000),
  }
}

function normalizeQuota(raw) {
  const d = defaultQuotaSettings()
  if (!raw || typeof raw !== 'object') return d
  return {
    maxConcurrentTerminals: clampInt(raw.maxConcurrentTerminals, d.maxConcurrentTerminals, 1, 32),
    maxLogMiB: clampInt(raw.maxLogMiB, d.maxLogMiB, 1, 200),
    maxReplayKiB: clampInt(raw.maxReplayKiB, d.maxReplayKiB, 32, 2048),
  }
}

function normalizeRedact(raw) {
  const d = defaultRedactSettings()
  if (!raw || typeof raw !== 'object') return d
  return {
    enabled: raw.enabled !== false,
    patternsText: String(raw.patternsText || '').slice(0, 4000),
  }
}

function ensureSettingsFile() {
  if (!fs.existsSync(SETTINGS_PATH)) {
    fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })
    fs.writeFileSync(
      SETTINGS_PATH,
      JSON.stringify(
        {
          showDemo: true,
          admin: defaultAdminSettings(),
          grok: defaultGrokSettings(),
          adapt: defaultAdaptSettings(),
          autoArchiveHours: 3,
          /** 脚本运行时是否弹出系统控制台 + 释放资源小窗（默认开） */
          showScriptPopup: true,
          terminal: defaultTerminalSettings(),
          quota: defaultQuotaSettings(),
          redact: defaultRedactSettings(),
        },
        null,
        2,
      ),
      'utf8',
    )
  }
}

/** 未人工确认归档时，超时自动归档（小时）；默认 3 */
export function normalizeAutoArchiveHours(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return 3
  // 0.1h～720h（30 天）
  return Math.min(720, Math.max(0.1, Math.round(n * 10) / 10))
}

export function getAppSettings() {
  ensureSettingsFile()
  try {
    const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'))
    return {
      showDemo: raw.showDemo !== false,
      admin: normalizeAdmin(raw.admin),
      grok: normalizeGrok(raw.grok),
      adapt: normalizeAdapt(raw.adapt),
      /** 归档确认超时（小时），超时系统自动归档释放资源；默认 3 */
      autoArchiveHours: normalizeAutoArchiveHours(
        raw.autoArchiveHours != null ? raw.autoArchiveHours : 3,
      ),
      /** 脚本弹窗：系统控制台 +「释放资源」HTA，默认 true */
      showScriptPopup: raw.showScriptPopup !== false,
      terminal: normalizeTerminal(raw.terminal),
      quota: normalizeQuota(raw.quota),
      redact: normalizeRedact(raw.redact),
    }
  } catch {
    return {
      showDemo: true,
      admin: defaultAdminSettings(),
      grok: defaultGrokSettings(),
      adapt: defaultAdaptSettings(),
      autoArchiveHours: 3,
      showScriptPopup: true,
      terminal: defaultTerminalSettings(),
      quota: defaultQuotaSettings(),
      redact: defaultRedactSettings(),
    }
  }
}

/**
 * 是否展示脚本弹窗（优先级从高到低）
 * 1. 局部显式 showScriptPopup true/false（成员 script / 快捷指令）
 * 2. 局部遗留 showConsole / hideWindow
 * 3. 全局设置 showScriptPopup（默认 true）
 *
 * @param {object|null|undefined} local 成员 script 配置或 slash 指令对象
 * @returns {boolean}
 */
export function resolveShowScriptPopup(local) {
  const globalOn = getAppSettings().showScriptPopup !== false
  if (!local || typeof local !== 'object') return globalOn

  const v = local.showScriptPopup
  if (v === true || v === 'true' || v === 'yes' || v === 1) return true
  if (v === false || v === 'false' || v === 'no' || v === 0) return false
  // inherit / global / null / undefined → 看遗留字段再回落全局
  if (local.hideWindow === true) return false
  if (local.showConsole === true) return true
  if (local.showConsole === false) return false
  return globalOn
}

export function updateAppSettings(patch = {}) {
  const cur = getAppSettings()
  const next = {
    showDemo: patch.showDemo !== undefined ? !!patch.showDemo : cur.showDemo,
    admin:
      patch.admin !== undefined
        ? normalizeAdmin({ ...cur.admin, ...patch.admin })
        : cur.admin,
    grok:
      patch.grok !== undefined
        ? normalizeGrok({ ...cur.grok, ...patch.grok })
        : cur.grok,
    adapt:
      patch.adapt !== undefined
        ? normalizeAdapt({ ...cur.adapt, ...patch.adapt })
        : cur.adapt,
    autoArchiveHours:
      patch.autoArchiveHours !== undefined
        ? normalizeAutoArchiveHours(patch.autoArchiveHours)
        : cur.autoArchiveHours,
    showScriptPopup:
      patch.showScriptPopup !== undefined
        ? !!patch.showScriptPopup
        : cur.showScriptPopup !== false,
    terminal:
      patch.terminal !== undefined
        ? normalizeTerminal({ ...cur.terminal, ...patch.terminal })
        : cur.terminal,
    quota:
      patch.quota !== undefined ? normalizeQuota({ ...cur.quota, ...patch.quota }) : cur.quota,
    redact:
      patch.redact !== undefined
        ? normalizeRedact({ ...cur.redact, ...patch.redact })
        : cur.redact,
  }
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), 'utf8')
  return next
}

/**
 * 解析全局默认管理员成员（可不存在）
 */
export function resolveGlobalAdminMember() {
  const { admin } = getAppSettings()
  const db = getDb()
  if (admin.memberId) {
    const row = db.prepare('SELECT * FROM members WHERE id = ?').get(admin.memberId)
    if (row) {
      return {
        id: row.id,
        name: row.name,
        display_name: row.display_name,
        kind: row.kind,
      }
    }
  }
  if (admin.memberKey) {
    const row = db.prepare('SELECT * FROM members WHERE name = ?').get(admin.memberKey)
    if (row) {
      return {
        id: row.id,
        name: row.name,
        display_name: row.display_name,
        kind: row.kind,
      }
    }
  }
  // 回落：熔炉 / 旧称统一管理员
  const all = db.prepare('SELECT * FROM members').all()
  const hit = all.find(
    (m) =>
      m.name === 'unified_admin' ||
      String(m.display_name || '') === '熔炉' ||
      String(m.display_name || '').includes('管理员'),
  )
  if (hit) {
    return {
      id: hit.id,
      name: hit.name,
      display_name: hit.display_name,
      kind: hit.kind,
    }
  }
  return null
}

/**
 * 解析群模板管理员：继承全局 / 指定成员 / 空
 * @returns {{ inherit: boolean, member: object|null, memberId: string|null, defaultFlow: object }}
 */
export function resolveGroupAdmin(group) {
  const global = getAppSettings().admin
  const gAdmin = group?.config?.admin
  const inherit = !gAdmin || gAdmin.inherit !== false
  let member = null
  let memberId = null

  if (inherit) {
    member = resolveGlobalAdminMember()
    memberId = member?.id || null
  } else if (gAdmin.memberId) {
    const row = getDb().prepare('SELECT * FROM members WHERE id = ?').get(gAdmin.memberId)
    if (row) {
      member = {
        id: row.id,
        name: row.name,
        display_name: row.display_name,
        kind: row.kind,
      }
      memberId = row.id
    }
  }
  // 不填 memberId 且不继承 → member 为空，允许

  const flowSrc =
    !inherit && gAdmin?.defaultFlow && typeof gAdmin.defaultFlow === 'object'
      ? gAdmin.defaultFlow
      : global.defaultFlow

  return {
    inherit,
    member,
    memberId,
    defaultFlow: {
      admin: flowSrc.admin !== false,
      auto: flowSrc.auto !== false,
      human: flowSrc.human !== false,
    },
  }
}

/**
 * 一键删除演示数据（不可还原）
 */
export function purgeDemoData() {
  const db = getDb()
  const members = db.prepare('SELECT * FROM members').all()
  const groups = db.prepare('SELECT * FROM groups').all()

  const demoMemberIds = members
    .filter((r) =>
      isDemoMember({
        ...r,
        config: parseJson(r.config_json, {}),
      }),
    )
    .map((r) => r.id)

  const demoGroupIds = groups
    .filter((r) =>
      isDemoGroup({
        ...r,
        steps: parseJson(r.steps_json, []),
        config: parseJson(r.config_json, {}),
      }),
    )
    .map((r) => r.id)

  let sessionsKilled = 0
  for (const gid of demoGroupIds) {
    const sessions = db.prepare('SELECT id FROM sessions WHERE group_id = ?').all(gid)
    for (const s of sessions) {
      try {
        killSessionProcesses(s.id)
      } catch {
        /* ignore */
      }
      sessionsKilled++
      db.prepare('DELETE FROM messages WHERE session_id = ?').run(s.id)
      db.prepare('DELETE FROM node_instances WHERE session_id = ?').run(s.id)
      db.prepare('DELETE FROM sessions WHERE id = ?').run(s.id)
    }
    db.prepare('DELETE FROM groups WHERE id = ?').run(gid)
  }

  let membersDeleted = 0
  for (const mid of demoMemberIds) {
    // 仍被非演示群引用则跳过
    const used = db
      .prepare('SELECT id, title, steps_json FROM groups')
      .all()
      .some((g) => {
        const steps = parseJson(g.steps_json, [])
        return steps.some((s) => s.memberId === mid)
      })
    if (used) continue
    db.prepare('DELETE FROM members WHERE id = ?').run(mid)
    membersDeleted++
  }

  return {
    ok: true,
    message: `已删除演示群 ${demoGroupIds.length} 个、会话约 ${sessionsKilled} 个、演示成员 ${membersDeleted} 个`,
    groups: demoGroupIds.length,
    sessions: sessionsKilled,
    members: membersDeleted,
  }
}
