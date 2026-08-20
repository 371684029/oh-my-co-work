import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-furnace-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb } = await import('../src/db.js')
initDb()

const {
  isFurnaceMember,
  FURNACE_DISPLAY_NAME,
  FURNACE_MEMBER_KEY,
  MEMBER_KIND,
} = await import('@acw/shared')
const {
  createMember,
  listMembers,
  updateMember,
  createGroup,
  createSessionFromMember,
  createSessionFromGroup,
  getSessionDetail,
  handleGateAction,
} = await import('../src/services.js')
const { ensureAdminMember } = await import('../src/slashCommands.js')
const { getAppSettings, updateAppSettings, defaultGrokSettings } = await import('../src/appSettings.js')

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

test('isFurnaceMember matches key and old/new display names', () => {
  assert.equal(isFurnaceMember({ name: FURNACE_MEMBER_KEY }), true)
  assert.equal(isFurnaceMember({ display_name: FURNACE_DISPLAY_NAME }), true)
  assert.equal(isFurnaceMember({ display_name: '统一管理员' }), true)
  assert.equal(isFurnaceMember({ name: 'echo', display_name: '示例回声' }), false)
})

test('getAppSettings exposes grok defaults without requiring configured', () => {
  const s = getAppSettings()
  assert.equal(typeof s.grok.command, 'string')
  assert.ok(s.grok.command.length > 0)
  assert.equal(typeof s.grok.configured, 'boolean')
  assert.equal(s.grok.surface, 'chat')
  assert.equal(s.grok.writeRules, true)
})

test('grok.configured defaults on', () => {
  assert.equal(defaultGrokSettings().configured, true)
  assert.equal(defaultGrokSettings().surface, 'chat')
  assert.equal(defaultGrokSettings().writeRules, true)
})

test('grok.surface tui persists', () => {
  updateAppSettings({ grok: { surface: 'tui' } })
  assert.equal(getAppSettings().grok.surface, 'tui')
  updateAppSettings({ grok: { surface: 'chat' } })
  assert.equal(getAppSettings().grok.surface, 'chat')
})

test('ensureAdminMember seeds 熔炉 with stable unified_admin key', () => {
  updateAppSettings({ grok: { command: 'grok', configured: false } })
  const m = ensureAdminMember()
  assert.equal(m.name, FURNACE_MEMBER_KEY)
  assert.equal(m.display_name, FURNACE_DISPLAY_NAME)
  assert.equal(m.kind, MEMBER_KIND.ECHO)
  const again = ensureAdminMember()
  assert.equal(again.id, m.id)
  assert.equal(again.display_name, FURNACE_DISPLAY_NAME)
})

test('ensureAdminMember wires grok script after grok.configured is saved', () => {
  const m = ensureAdminMember()
  assert.equal(m.kind, MEMBER_KIND.ECHO)
  updateAppSettings({ grok: { command: 'grok', configured: true } })
  const wired = ensureAdminMember()
  assert.equal(wired.id, m.id)
  assert.equal(wired.kind, MEMBER_KIND.SCRIPT)
  assert.equal(wired.config?.script?.command, 'grok')
  assert.equal(wired.config?.script?.executionMode, 'terminal')
  updateAppSettings({ grok: { command: 'grok', configured: false } })
  const config = { ...(wired.config || {}) }
  delete config.script
  updateMember(wired.id, { kind: MEMBER_KIND.ECHO, config })
})

test('ensureAdminMember renames legacy 统一管理员 display name', () => {
  const leftover = listMembers().find((x) => x.name === FURNACE_MEMBER_KEY)
  if (leftover) {
    updateMember(leftover.id, {
      displayName: '统一管理员',
      config: { ...(leftover.config || {}), defaultText: '【统一管理员】收到。' },
    })
  } else {
    createMember({
      name: FURNACE_MEMBER_KEY,
      displayName: '统一管理员',
      kind: MEMBER_KIND.ECHO,
      config: { role: 'admin', defaultText: '【统一管理员】收到。' },
    })
  }
  const m = ensureAdminMember()
  assert.equal(m.display_name, FURNACE_DISPLAY_NAME)
  assert.equal(m.name, FURNACE_MEMBER_KEY)
  assert.ok(!String(m.config?.defaultText || '').includes('统一管理员'))
})

test('group steps persist adapt without changing step type', () => {
  const echo = createMember({
    name: `echo-adapt-${Date.now()}`,
    displayName: '适配回声',
    kind: MEMBER_KIND.ECHO,
    workFolder: process.cwd(),
    config: { defaultText: 'ok' },
  })
  const group = createGroup({
    title: '无熔炉适配群',
    workFolder: process.cwd(),
    steps: [
      {
        title: '输入',
        type: 'human',
        captureParams: true,
        flow: { admin: false, auto: false, human: true },
      },
      {
        title: '回声',
        type: 'member',
        memberId: echo.id,
        adapt: true,
        flow: { admin: false, auto: true, human: false },
      },
    ],
  })
  assert.equal(group.steps[0].adapt, undefined)
  assert.equal(group.steps[1].adapt, true)
  assert.equal(group.steps[1].type, 'member')
  const session = createSessionFromGroup(group.id)
  const detail = getSessionDetail(session.id)
  const node = detail.nodes.find((n) => n.title === '回声')
  assert.equal(node.step_type, 'member')
  assert.equal(node.input?.adapt, true)
})

test('plain member chat still opens after furnace exists', () => {
  ensureAdminMember()
  const echo = createMember({
    name: `echo-plain-${Date.now()}`,
    displayName: '普通回声',
    kind: MEMBER_KIND.ECHO,
    workFolder: process.cwd(),
    config: { defaultText: 'ok' },
  })
  const session = createSessionFromMember(echo.id)
  assert.ok(session?.id)
  assert.equal(session.reused, undefined)
})

test('furnace member gate stays waiting_human and uses 熔炉 copy', async () => {
  const furnace = ensureAdminMember()
  const session = createSessionFromMember(furnace.id)
  let detail
  for (let i = 0; i < 40; i++) {
    await wait(25)
    detail = getSessionDetail(session.id)
    if (detail.nodes?.[0]?.status === 'waiting_human') break
  }
  assert.equal(detail.nodes[0].status, 'waiting_human')
  const gate = [...detail.messages].reverse().find((m) => m.type === 'gate')
  const text = String(gate?.content?.text || '')
  assert.ok(text.includes('熔炉') || text.includes('审核'))
  assert.equal(text.includes('管理员'), false)
})

test('starting a group injects a node map so furnace sees each step', () => {
  const echo = createMember({
    name: `echo-map-${Date.now()}`,
    displayName: '采集器',
    kind: MEMBER_KIND.ECHO,
    workFolder: process.cwd(),
    config: { defaultText: 'ok' },
  })
  const group = createGroup({
    title: '采集流水线',
    description: '任意场景',
    workFolder: process.cwd(),
    steps: [
      {
        title: '填参',
        type: 'human',
        captureParams: true,
        flow: { admin: false, auto: false, human: true },
      },
      {
        title: '拉数据',
        type: 'member',
        memberId: echo.id,
        adapt: true,
        flow: { admin: false, auto: true, human: false },
      },
    ],
  })
  createSessionFromGroup(group.id)
  const sit = fs.readFileSync(path.join(dataRoot, 'furnace', 'SITUATION.md'), 'utf8')
  assert.ok(sit.includes('节点一览'))
  assert.ok(sit.includes('#1 [人工'))
  assert.ok(sit.includes('填参'))
  assert.ok(sit.includes('#2 [成员 · 采集器 · 适配]'))
  assert.ok(sit.includes('拉数据'))
  assert.ok(sit.includes('当前节点'))
  const active = fs.readFileSync(path.join(dataRoot, 'furnace', 'ACTIVE.md'), 'utf8')
  assert.ok(active.includes('群聊主持'))
  assert.ok(active.includes('节点一览'))
})

test('starting a group run refreshes current node as it executes', async () => {
  const echo = createMember({
    name: `echo-run-${Date.now()}`,
    displayName: '采集器',
    kind: MEMBER_KIND.ECHO,
    workFolder: process.cwd(),
    config: { defaultText: '采集完成' },
  })
  const group = createGroup({
    title: '采集流水线',
    description: '任意场景',
    workFolder: process.cwd(),
    steps: [
      {
        title: '拉数据',
        type: 'member',
        memberId: echo.id,
        flow: { admin: false, auto: false, human: false },
      },
    ],
  })
  const session = createSessionFromGroup(group.id)
  await handleGateAction(session.id, { action: 'approve_start', text: '开始跑采集' })
  let detail
  for (let i = 0; i < 40; i++) {
    await wait(25)
    detail = getSessionDetail(session.id)
    if (detail.nodes?.[0]?.status === 'succeeded') break
  }
  assert.equal(detail.nodes[0].status, 'succeeded')
  const sit = fs.readFileSync(path.join(dataRoot, 'furnace', 'SITUATION.md'), 'utf8')
  assert.ok(sit.includes('意图：开始跑采集'))
  assert.ok(sit.includes('#1 [成员 · 采集器]'))
  assert.ok(sit.includes('拉数据'))
  assert.ok(sit.includes('完成'))
  assert.ok(sit.includes('当前节点：#1 拉数据'))
})
