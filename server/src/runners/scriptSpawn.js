import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { formatScriptUserSummary } from '@acw/shared'

export function psSingleQuote(s) {
  return `'${String(s).replace(/'/g, "''")}'`
}

/** 脚本结果摘要：业务向短文案 */
export function buildScriptSummary({ ok, exitCode, stdout, stderr, label }) {
  return formatScriptUserSummary({ ok, exitCode, stdout, stderr, label })
}

/**
 * 启动脚本进程（Windows 弹窗用 Start-Process）。
 */
export function spawnScriptChild({
  launch,
  cwd,
  env,
  showConsole,
  isWin,
  filePath,
  targetPidFile,
  detach = false,
}) {
  const baseCwd = cwd && fs.existsSync(cwd) ? cwd : process.cwd()
  const baseEnv = env

  if (showConsole && isWin) {
    const pidWrite = targetPidFile
      ? `if ($p -ne $null) { Set-Content -LiteralPath ${psSingleQuote(targetPidFile)} -Value $p.Id -Encoding ascii }`
      : ''

    const directDetach =
      detach && filePath && /\.(cmd|bat)$/i.test(String(filePath)) && fs.existsSync(filePath)

    const args = launch.args || []
    const argPart =
      args.length > 0 ? `-ArgumentList @(${args.map((a) => psSingleQuote(a)).join(',')})` : ''
    const startCore = directDetach
      ? [
          `$p = Start-Process -FilePath ${psSingleQuote(path.resolve(filePath))}`,
          `-WorkingDirectory ${psSingleQuote(baseCwd)}`,
          '-PassThru',
        ].join(' ')
      : [
          `$p = Start-Process -FilePath ${psSingleQuote(launch.cmd)}`,
          argPart,
          `-WorkingDirectory ${psSingleQuote(baseCwd)}`,
          '-PassThru',
        ]
          .filter(Boolean)
          .join(' ')
    console.log(
      `[acw] popup: ${directDetach ? filePath : `${launch.cmd} ${(args || []).join(' ').slice(0, 100)}`} cwd=${baseCwd} detach=${!!detach}`,
    )

    const ps = detach
      ? [startCore, pidWrite, 'if ($null -eq $p) { exit 1 }', 'exit 0'].filter(Boolean).join('; ')
      : [
          startCore,
          pidWrite,
          'if ($null -eq $p) { exit 1 }',
          '$p.WaitForExit()',
          'exit $p.ExitCode',
        ]
          .filter(Boolean)
          .join('; ')

    return spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      {
        cwd: baseCwd,
        env: baseEnv,
        windowsHide: true,
        shell: false,
      },
    )
  }

  return spawn(launch.cmd, launch.args || [], {
    cwd: baseCwd,
    env: baseEnv,
    windowsHide: !showConsole,
    shell: launch.shell === true,
  })
}
