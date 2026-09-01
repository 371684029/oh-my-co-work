import { initDb } from './db.js'
import { createMember, createGroup, listMembers, listGroups } from './services.js'
import { MEMBER_KIND } from '@acw/shared'

initDb()

const existing = listMembers()
if (existing.length) {
  console.log('已有成员，跳过 seed（如需重来请删除 data/ 目录）')
  process.exit(0)
}

const echo = createMember({
  name: 'echo',
  displayName: '示例回声',
  kind: MEMBER_KIND.ECHO,
  config: { demo: true, defaultText: 'hello from echo' },
})

const scriptCmd = createMember({
  name: 'script_cmd',
  displayName: '示例命令',
  kind: MEMBER_KIND.SCRIPT,
  workFolder: process.cwd(),
  config: {
    demo: true,
    script: {
      mode: 'command',
      scriptWorkDir: process.cwd(),
      scriptDir: process.cwd(),
      command:
        process.platform === 'win32'
          ? 'echo ECW-OK #1 & cmd'
          : 'echo ECW-OK #1; exec bash',
      // 命令末尾保留交互式 shell，需声明不等待退出
      waitForExit: false,
    },
  },
})

createGroup({
  title: '演示流',
  description: 'MVP 演示：人工输入 → 回声+闸门 → 命令',
  workFolder: process.cwd(),
  steps: [
    {
      title: '输入项目信息',
      type: 'human',
      captureParams: true,
      gate: false,
    },
    { title: '示例回声', type: 'member', memberId: echo.id, gate: true },
    { title: '跑一段命令', type: 'member', memberId: scriptCmd.id, gate: true },
  ],
})

console.log('Seed OK')
console.log('成员:', listMembers().map((m) => m.display_name).join(', '))
console.log('群模板:', listGroups().map((g) => g.title).join(', '))
