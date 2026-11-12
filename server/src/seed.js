import fs from 'node:fs'
import path from 'node:path'
import { initDb } from './db.js'
import { createMember, createGroup, listMembers, listGroups } from './services.js'
import { MEMBER_KIND } from '@acw/shared'

const REFINE_PROBE_SRC = path.join(process.cwd(), 'server/test/fixtures/refine-verify-probe.mjs')
const probeDir = path.join(process.cwd(), 'data', 'demo-fixtures')
fs.mkdirSync(probeDir, { recursive: true })
const REFINE_PROBE = path.join(probeDir, 'refine-verify-probe.mjs')
if (!fs.existsSync(REFINE_PROBE)) {
  fs.copyFileSync(REFINE_PROBE_SRC, REFINE_PROBE)
}

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

const refineDemo = createMember({
  name: 'demo_refine_verify',
  displayName: '炼化验证示例',
  kind: MEMBER_KIND.SCRIPT,
  workFolder: path.dirname(REFINE_PROBE),
  config: {
    demo: true,
    refine: { enabled: true },
    script: {
      mode: 'file',
      filePath: REFINE_PROBE,
      scriptWorkDir: path.dirname(REFINE_PROBE),
      executionMode: 'pipe',
    },
  },
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
  title: '炼化验证演示',
  description: '5.9.0：绑定炼化验证示例成员，保存后试跑 → 开聊一步 → 文档中心',
  workFolder: path.dirname(REFINE_PROBE),
  steps: [
    { title: '炼化探针', type: 'member', memberId: refineDemo.id, gate: true, refine: true },
  ],
})

createGroup({
  title: '演示流',
  description: 'MVP 演示：人工输入 → 回声+闸门 → 命令',
  workFolder: process.cwd(),
  paramBindSlots: ['#1'],
  steps: [
    {
      title: '输入项目信息',
      type: 'human',
      captureParams: true,
      paramBindSlots: ['#1'],
      gate: false,
    },
    { title: '示例回声', type: 'member', memberId: echo.id, gate: true },
    { title: '跑一段命令', type: 'member', memberId: scriptCmd.id, gate: true },
  ],
})

console.log('Seed OK')
console.log('成员:', listMembers().map((m) => m.display_name).join(', '))
console.log('群模板:', listGroups().map((g) => g.title).join(', '))
