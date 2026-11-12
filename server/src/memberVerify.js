/**
 * 5.9.0：成员炼化/适配探针（保存后自动试跑 + 手动 verify API）。
 * 默认用 spawnSync + pipe（不弹窗），避免改动 createMember 同步契约。
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { applyParamPlaceholders, injectCallArgsParam, isFurnaceMember } from '@acw/shared'
import { consoleChildEnv } from './consoleEncoding.js'
import { decodeConsoleBytes } from './consoleEncoding.js'
import { enrichScriptConfig } from './runners/scriptMemberConfig.js'
import { getScriptWorkDir } from './runners/scriptWorkDir.js'
import { resolveCwdForScript, resolveScriptFilePath } from './runners/cwdResolve.js'
import { resolveLaunchSpec } from './runners/launchSpec.js'
import { collectAdaptSourcePaths } from './adaptBackup.js'
import { REFINE_MARK } from './refineContractStrip.js'

export const MEMBER_VERIFY_TIMEOUT_MS = 30_000

export const DEFAULT_PROBE_INPUT = 'acw-verify-probe'

function refineHeading(member) {
  const fmt = member?.config?.refine?.format
  const raw = fmt?.output?.heading || fmt?.title || ''
  return String(raw).replace(/^###\s*/, '').trim()
}

function headingNeedle(member) {
  const h = refineHeading(member)
  return h ? `### ${h}` : ''
}

export function shouldAutoVerifyRefine(member, prep) {
  if (!member?.config?.refine?.enabled) return false
  if (isFurnaceMember(member)) return false
  if (member.kind === 'echo') return true
  if (member.kind !== 'script') return false
  const script = member.config?.script
  if (!script?.command && !script?.filePath && !script?.path) return false
  if (prep?.reason === 'backup_failed' || prep?.reason === 'patch_failed') return false
  return true
}

function buildProbeLaunch(member, { humanInput = DEFAULT_PROBE_INPUT, param1 } = {}) {
  const config = member.config || {}
  const script = enrichScriptConfig({ ...(config.script || config) })
  const paramsMap = injectCallArgsParam({ '#1': String(param1 ?? humanInput) }, humanInput)
  const phExtra = {
    input: humanInput,
    folder: null,
    cwd: null,
    sessionId: '',
  }

  const mode = script.mode || (script.filePath || script.path ? 'file' : 'command')
  let filePath = null
  let command = null
  let args = Array.isArray(script.args) ? script.args.map(String) : []
  args = args.map((a) => applyParamPlaceholders(a, paramsMap, phExtra))

  if (mode === 'file') {
    const raw = script.filePath || script.path
    if (!raw) return { ok: false, reason: 'NO_FILE' }
    const expanded = applyParamPlaceholders(String(raw), paramsMap, phExtra)
    filePath = resolveScriptFilePath(expanded, { scriptWorkDir: getScriptWorkDir(script) })
    if (!filePath || !fs.existsSync(filePath)) return { ok: false, reason: 'FILE_MISSING', path: expanded }
    filePath = path.resolve(filePath)
  } else {
    command = script.command
    if (!command || !String(command).trim()) return { ok: false, reason: 'NO_COMMAND' }
    command = applyParamPlaceholders(String(command), paramsMap, phExtra)
  }

  const cwd = resolveCwdForScript(script, mode === 'file' ? filePath : null)
  if (!cwd) return { ok: false, reason: 'NO_SCRIPT_WORK_DIR' }

  phExtra.folder = cwd
  phExtra.cwd = cwd

  const env = consoleChildEnv({
    ...process.env,
    ACW_HUMAN_INPUT: String(humanInput),
    ACW_PARAM_1: String(param1 ?? humanInput),
    ACW_PARAMS_JSON: JSON.stringify(paramsMap || {}),
    ACW_SCRIPT_PATH: filePath || '',
    ACW_CWD: cwd || '',
    ACW_VERIFY: '1',
  })
  Object.keys(paramsMap || {}).forEach((k) => {
    const v = String(paramsMap[k] ?? '')
    if (k.startsWith('#')) {
      const n = k.slice(1)
      env[`ACW_PARAM_${n}`] = v
    }
  })
  if (cwd) env.ACW_FOLDER = String(cwd)

  const launch = resolveLaunchSpec({
    filePath,
    command,
    shell: script.shell,
    runtime: script.runtime,
    args,
  })

  const successCodes = Array.isArray(script.successCodes) ? script.successCodes.map(Number) : [0]
  return { ok: true, launch, cwd, env, successCodes, filePath, command, label: member.display_name || member.name || 'script' }
}

export function runScriptProbeSync(member, options = {}) {
  const timeoutMs = options.timeoutMs ?? MEMBER_VERIFY_TIMEOUT_MS
  const humanInput = options.humanInput ?? DEFAULT_PROBE_INPUT
  const built = buildProbeLaunch(member, {
    humanInput,
    param1: options.param1 ?? humanInput,
  })
  if (!built.ok) {
    return {
      exitCode: -1,
      exitOk: false,
      stdout: '',
      stderr: '',
      reason: built.reason,
      error: built,
    }
  }

  const { launch, cwd, env, successCodes } = built
  let child
  try {
    child = spawnSync(launch.cmd, launch.args || [], {
      cwd,
      env,
      windowsHide: true,
      shell: launch.shell === true,
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024,
    })
  } catch (e) {
    return {
      exitCode: -1,
      exitOk: false,
      stdout: '',
      stderr: String(e.message || e),
      reason: 'SPAWN',
    }
  }

  if (child.error) {
    const timedOut = child.error.code === 'ETIMEDOUT'
    return {
      exitCode: -1,
      exitOk: false,
      stdout: decodeConsoleBytes(child.stdout || Buffer.alloc(0)),
      stderr: decodeConsoleBytes(child.stderr || Buffer.alloc(0)),
      reason: timedOut ? 'TIMEOUT' : 'SPAWN',
      error: child.error,
    }
  }

  const exitCode = child.status == null ? -1 : child.status
  const stdout = decodeConsoleBytes(child.stdout || Buffer.alloc(0))
  const stderr = decodeConsoleBytes(child.stderr || Buffer.alloc(0))
  const exitOk = successCodes.includes(exitCode)
  return { exitCode, exitOk, stdout, stderr, reason: exitOk ? 'ok' : 'EXIT' }
}

export function verifyMemberSync(member, options = {}) {
  const t0 = Date.now()
  const runProbe = options.runProbe || runScriptProbeSync

  if (options.scope === 'refine' && !member?.config?.refine?.enabled) {
    return {
      ok: false,
      skipped: true,
      reason: 'refine_disabled',
      checks: [],
      elapsedMs: 0,
    }
  }

  if (isFurnaceMember(member)) {
    return {
      ok: true,
      skipped: true,
      reason: 'furnace_member',
      checks: [{ id: 'skip_furnace', ok: true, detail: '熔炉成员不自动试跑' }],
      elapsedMs: Date.now() - t0,
    }
  }

  const checks = []

  if (member.kind === 'echo') {
    const needle = headingNeedle(member)
    const ok = !!needle || !!refineHeading(member)
    checks.push({
      id: 'refine_echo_format',
      ok,
      detail: ok ? 'echo 成员已写入炼化规格' : '缺少炼化标题规格',
    })
    return { ok: checks.every((c) => c.ok), skipped: false, checks, elapsedMs: Date.now() - t0 }
  }

  if (member.kind !== 'script') {
    return {
      ok: false,
      skipped: true,
      reason: 'unsupported_kind',
      checks: [],
      elapsedMs: Date.now() - t0,
    }
  }

  const probe = runProbe(member, options)
  if (probe.reason && probe.reason !== 'ok' && !probe.exitOk) {
    const map = {
      NO_FILE: '未配置脚本文件',
      FILE_MISSING: '脚本文件不存在',
      NO_COMMAND: '未配置命令',
      NO_SCRIPT_WORK_DIR: '未配置脚本工作目录',
      TIMEOUT: `试跑超时（>${options.timeoutMs ?? MEMBER_VERIFY_TIMEOUT_MS}ms）`,
      SPAWN: '进程启动失败',
    }
    checks.push({
      id: 'probe_run',
      ok: false,
      detail: map[probe.reason] || probe.reason,
    })
    return {
      ok: false,
      skipped: false,
      checks,
      elapsedMs: Date.now() - t0,
      stdoutPreview: probe.stdout?.slice(0, 400) || '',
      stderrPreview: probe.stderr?.slice(0, 200) || '',
    }
  }

  checks.push({
    id: 'exit_code',
    ok: !!probe.exitOk,
    detail: probe.exitOk ? `退出码 ${probe.exitCode}` : `退出码 ${probe.exitCode}（非成功）`,
  })

  if (member.config?.refine?.enabled) {
    const needle = headingNeedle(member)
    const title = refineHeading(member)
  const strict =
      (needle && probe.stdout.includes(needle)) || (title && probe.stdout.includes(title))
    const relaxed = /^###\s+\S/m.test(probe.stdout)
    const has = strict || (relaxed && probe.exitOk)
    checks.push({
      id: 'refine_stdout_heading',
      ok: !!has,
      detail: has
        ? strict
          ? 'stdout 含炼化文档标题'
          : 'stdout 含 ### 标题行（编码与规格字面不完全一致时已放宽）'
        : needle
          ? `stdout 未找到「${needle}」`
          : '未配置炼化标题',
    })
  }

  const ok = checks.every((c) => c.ok)
  return {
    ok,
    skipped: false,
    checks,
    elapsedMs: Date.now() - t0,
    stdoutPreview: probe.stdout?.slice(0, 400) || '',
    stderrPreview: probe.stderr?.slice(0, 200) || '',
  }
}

/**
 * refine/plan 用：不落盘试跑。源文件尚无契约时返回模拟说明；已有契约则同步探针。
 */
export function previewRefineVerify(member) {
  const t0 = Date.now()
  if (!member?.config?.refine?.enabled) {
    return {
      ok: false,
      simulated: true,
      skipped: true,
      reason: 'refine_disabled',
      checks: [],
      elapsedMs: 0,
    }
  }
  if (isFurnaceMember(member)) {
    return {
      ok: true,
      simulated: true,
      skipped: true,
      reason: 'furnace_member',
      checks: [{ id: 'skip_furnace', ok: true, detail: '熔炉成员不自动试跑' }],
      elapsedMs: Date.now() - t0,
    }
  }
  const paths = collectAdaptSourcePaths(member)
  let pendingPatch = false
  for (const p of paths) {
    try {
      if (!fs.readFileSync(p, 'utf8').includes(REFINE_MARK)) {
        pendingPatch = true
        break
      }
    } catch {
      /* ignore */
    }
  }
  if (pendingPatch) {
    const title = refineHeading(member) || '炼化标题'
    return {
      ok: null,
      simulated: true,
      pendingPatch: true,
      checks: [
        {
          id: 'preview_pending_patch',
          ok: true,
          detail: `保存插入契约后将自动试跑（stdout 须含 ### ${title}）`,
        },
      ],
      elapsedMs: Date.now() - t0,
    }
  }
  const v = verifyMemberSync(member, { scope: 'refine' })
  return { ...v, simulated: false }
}

export async function verifyMember(member, options = {}) {
  return verifyMemberSync(member, options)
}

export function verifySummaryLine(verify) {
  if (!verify || verify.skipped) return ''
  if (verify.ok) return '炼化试跑验证通过'
  const failed = (verify.checks || []).filter((c) => !c.ok)
  if (!failed.length) return '炼化试跑验证未通过'
  return `炼化试跑未通过：${failed.map((c) => c.detail).join('；')}`
}
