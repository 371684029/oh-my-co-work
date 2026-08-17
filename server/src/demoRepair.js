import { listMembers, updateMember } from './services.js'
import { MEMBER_KIND } from '@acw/shared'

/** 命令末尾留下交互式 shell 的写法（这类进程永远不会自己退出） */
const KEEP_ALIVE_COMMAND = /(&\s*cmd\b|exec\s+bash\b)/i

/**
 * 老库修复：早期演示成员的命令末尾留了交互式 shell（`& cmd` / `exec bash`），
 * 却没声明 waitForExit:false —— 这类节点永远等不到进程退出，只会撞 timeoutMs 判「执行超时」。
 *
 * 仅修满足全部条件的成员，幂等，绝不碰用户自建配置：
 * 1. kind 为 script；
 * 2. config.demo === true（演示数据）；
 * 3. command 确实是保活写法；
 * 4. 从未显式配置过 waitForExit / detach（用户已表态则尊重用户）。
 *
 * @returns {string[]} 被修复的成员 id
 */
export function repairDemoKeepAliveMembers() {
  const repaired = []
  for (const member of listMembers({ includeDemo: true })) {
    if (member.kind !== MEMBER_KIND.SCRIPT) continue
    const config = member.config || {}
    if (config.demo !== true) continue
    const script = config.script
    if (!script || !KEEP_ALIVE_COMMAND.test(String(script.command || ''))) continue
    if (script.waitForExit !== undefined || script.detach !== undefined) continue
    updateMember(member.id, {
      config: { ...config, script: { ...script, waitForExit: false } },
    })
    repaired.push(member.id)
  }
  return repaired
}
