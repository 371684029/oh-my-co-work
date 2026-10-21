import {
  resolveWorkFolderCandidates,
  getScriptWorkDir,
  assertScriptWorkDirConfigured,
} from './runners/scriptWorkDir.js'
import {
  resolveCwd,
  resolveCwdForScript,
  resolveScriptFilePath,
  extractScriptPathFromCommand,
} from './runners/cwdResolve.js'
import { resolveLaunchSpec, winBatCallCommand } from './runners/launchSpec.js'
import {
  enrichScriptConfig,
  usesKeepAlive,
  usesTerminalExecution,
} from './runners/scriptMemberConfig.js'
import { runMember } from './runners/runMember.js'

export { resolveWorkFolderCandidates, getScriptWorkDir, assertScriptWorkDirConfigured }
export {
  resolveCwd,
  resolveCwdForScript,
  resolveScriptFilePath,
  extractScriptPathFromCommand,
  resolveLaunchSpec,
  winBatCallCommand,
}
export { enrichScriptConfig, usesKeepAlive, usesTerminalExecution }
export { runMember }

/** 供设置页 / 文档展示 */
export const SUPPORTED_SCRIPT_HINTS = {
  fileExt: [
    '.bat',
    '.cmd',
    '.ps1',
    '.sh',
    '.bash',
    '.py',
    '.js',
    '.mjs',
    '.cjs',
    '.ts',
    '.rb',
    '.pl',
    '.php',
    '.vbs',
    '.jar',
    '.exe',
  ],
  runtimes: ['auto', 'cmd', 'powershell', 'pwsh', 'bash', 'python', 'node', '自定义解释器路径'],
  placeholders: ['#a', '{#a}', '{a}', '{input}', '{human}', '{folder}', '{cwd}', '{sessionId}'],
}
