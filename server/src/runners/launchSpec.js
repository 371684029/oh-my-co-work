import path from 'node:path'

export function winBatCallCommand(absPath, userArgs = []) {
  const bat = `"${String(absPath).replace(/"/g, '')}"`
  const extra = (userArgs || [])
    .map((a) => {
      const s = String(a)
      if (!s.length) return '""'
      if (/[\s"&<>|^]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    })
    .join(' ')
  return extra
    ? `chcp 65001>nul & call ${bat} ${extra}`
    : `chcp 65001>nul & call ${bat}`
}

/** @returns {{ cmd: string, args: string[], shell?: boolean, label: string }} */
export function resolveLaunchSpec({ filePath, command, shell, runtime, args = [] }) {
  const isWin = process.platform === 'win32'
  const extraArgs = Array.isArray(args) ? args.map(String) : []

  if (!filePath && command) {
    let sh = (shell || runtime || 'auto').toLowerCase()
    if (sh === 'auto' && /\$env:|\$PSVersionTable|Set-Location\b|Write-Host\b/i.test(command)) {
      sh = 'powershell'
    }
    if (sh === 'powershell' || sh === 'ps' || sh === 'pwsh') {
      const exe = sh === 'pwsh' ? 'pwsh' : 'powershell.exe'
      return {
        cmd: exe,
        args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
        label: 'powershell',
      }
    }
    if (sh === 'bash' || sh === 'sh') {
      const exe = sh === 'sh' ? 'sh' : 'bash'
      return { cmd: exe, args: ['-lc', command], label: exe }
    }
    if (sh === 'cmd' || (sh === 'auto' && isWin)) {
      return {
        cmd: process.env.ComSpec || 'cmd.exe',
        args: ['/d', '/s', '/c', command],
        label: 'cmd',
      }
    }
    return { cmd: command, args: [], shell: true, label: 'shell' }
  }

  const abs = filePath
  const ext = path.extname(abs).toLowerCase()
  const rt = (runtime || 'auto').toLowerCase()

  if (rt && rt !== 'auto') {
    if (rt === 'python' || rt === 'python3' || rt === 'py') {
      const py = isWin ? 'python' : 'python3'
      return { cmd: py, args: [abs, ...extraArgs], label: 'python' }
    }
    if (rt === 'node' || rt === 'nodejs') {
      return { cmd: 'node', args: [abs, ...extraArgs], label: 'node' }
    }
    if (rt === 'powershell' || rt === 'ps1') {
      return {
        cmd: 'powershell.exe',
        args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', abs, ...extraArgs],
        label: 'powershell',
      }
    }
    if (rt === 'pwsh') {
      return {
        cmd: 'pwsh',
        args: ['-NoProfile', '-File', abs, ...extraArgs],
        label: 'pwsh',
      }
    }
    if (rt === 'bash' || rt === 'sh') {
      return { cmd: rt === 'sh' ? 'sh' : 'bash', args: [abs, ...extraArgs], label: rt }
    }
    if (rt === 'cmd' || rt === 'bat') {
      return {
        cmd: process.env.ComSpec || 'cmd.exe',
        args: ['/d', '/s', '/c', `"${abs}"${extraArgs.length ? ' ' + extraArgs.map((a) => `"${a}"`).join(' ') : ''}`],
        label: 'cmd',
      }
    }
    return { cmd: runtime, args: [abs, ...extraArgs], label: path.basename(runtime) }
  }

  switch (ext) {
    case '.ps1':
      return {
        cmd: 'powershell.exe',
        args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', abs, ...extraArgs],
        label: 'powershell',
      }
    case '.bat':
    case '.cmd':
      return {
        cmd: process.env.ComSpec || 'cmd.exe',
        args: isWin
          ? ['/d', '/s', '/c', winBatCallCommand(abs, extraArgs)]
          : ['/d', '/s', '/c', 'call', abs, ...extraArgs],
        label: 'bat',
      }
    case '.sh':
    case '.bash':
      return {
        cmd: isWin ? 'bash' : ext === '.bash' ? 'bash' : 'bash',
        args: [abs, ...extraArgs],
        label: 'bash',
      }
    case '.py':
    case '.pyw':
      return {
        cmd: isWin ? 'python' : 'python3',
        args: [abs, ...extraArgs],
        label: 'python',
      }
    case '.js':
    case '.mjs':
    case '.cjs':
      return { cmd: 'node', args: [abs, ...extraArgs], label: 'node' }
    case '.ts':
    case '.tsx':
      return { cmd: 'npx', args: ['--yes', 'tsx', abs, ...extraArgs], label: 'tsx' }
    case '.rb':
      return { cmd: 'ruby', args: [abs, ...extraArgs], label: 'ruby' }
    case '.pl':
      return { cmd: 'perl', args: [abs, ...extraArgs], label: 'perl' }
    case '.php':
      return { cmd: 'php', args: [abs, ...extraArgs], label: 'php' }
    case '.vbs':
      return { cmd: 'cscript.exe', args: ['//Nologo', abs, ...extraArgs], label: 'vbs' }
    case '.wsf':
      return { cmd: 'cscript.exe', args: ['//Nologo', abs, ...extraArgs], label: 'wsf' }
    case '.exe':
    case '.com':
      return { cmd: abs, args: extraArgs, label: 'exe' }
    case '.jar':
      return { cmd: 'java', args: ['-jar', abs, ...extraArgs], label: 'java' }
    default: {
      if (isWin) {
        return {
          cmd: process.env.ComSpec || 'cmd.exe',
          args: ['/d', '/s', '/c', abs, ...extraArgs],
          label: 'exec',
        }
      }
      return { cmd: abs, args: extraArgs, label: 'exec' }
    }
  }
}
