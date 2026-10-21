/**
 * Script cwd / work-folder resolution (SRV-04 split from runners.js).
 */
export function resolveWorkFolderCandidates({ member, group, sessionContext, scriptCfg }) {
  const list = []
  const push = (p) => {
    if (p && typeof p === 'string' && p.trim() && !list.includes(p)) list.push(p)
  }
  push(scriptCfg?.cwd)
  push(member?.work_folder)
  push(sessionContext?.primaryWorkFolder)
  push(sessionContext?.workFolders?.[0])
  push(group?.work_folder)
  push(process.cwd())
  return list
}

export function getScriptWorkDir(script) {
  if (!script || typeof script !== 'object') return ''
  const w = script.scriptWorkDir || script.scriptDir || ''
  return String(w).trim()
}

export function assertScriptWorkDirConfigured(script) {
  const w = getScriptWorkDir(script)
  if (!w) {
    const err = new Error('请填写脚本工作目录')
    err.code = 'NO_SCRIPT_WORK_DIR'
    throw err
  }
  return w
}
