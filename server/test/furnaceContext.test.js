import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-furnace-ctx-'))
process.env.ACW_DATA_ROOT = dataRoot

const { FURNACE_ROLE } = await import('@acw/shared')
const {
  composeFurnaceContext,
  composeFurnaceSituation,
  activateFurnaceRole,
  resolveAdaptFurnaceRole,
  loadFurnaceMemory,
  furnaceMemoryDir,
  ensureFurnaceWorkspace,
  clipFurnaceText,
} = await import('../src/furnaceContext.js')

test('three roles compose in isolation', () => {
  const member = composeFurnaceContext(FURNACE_ROLE.MEMBER_ADAPT)
  const node = composeFurnaceContext(FURNACE_ROLE.NODE_ADAPT)
  const review = composeFurnaceContext(FURNACE_ROLE.REVIEW)
  assert.ok(member.includes('熔炉本轮：成员适配'))
  assert.ok(member.includes('把**当前成员**接到工作台'))
  assert.ok(!member.includes('按闸门政策'))
  assert.ok(node.includes('熔炉本轮：节点适配'))
  assert.ok(node.includes('把**当前步骤**接到工作台'))
  assert.ok(!node.includes('按闸门政策'))
  assert.ok(review.includes('熔炉本轮：系统审核'))
  assert.ok(review.includes('通过或拒绝'))
  assert.ok(!review.includes('ACW-ADAPT'))
  assert.ok(!review.includes('ACW_ADAPTER_EVENTS'))
})

test('activating one role writes ACTIVE.md without mixing memories', () => {
  const pack = activateFurnaceRole(FURNACE_ROLE.REVIEW, { sessionId: 's1' })
  const text = fs.readFileSync(pack.activeMd, 'utf8')
  assert.ok(text.includes('系统审核'))
  assert.equal(text.includes('把当前成员接到工作台'), false)
  const json = JSON.parse(fs.readFileSync(path.join(path.dirname(pack.activeMd), 'active.json'), 'utf8'))
  assert.equal(json.role, FURNACE_ROLE.REVIEW)
})

test('memory seed is copied once and not overwritten', () => {
  ensureFurnaceWorkspace()
  const file = path.join(furnaceMemoryDir(), 'review.md')
  fs.writeFileSync(file, '# 用户已写记忆\n', 'utf8')
  ensureFurnaceWorkspace()
  assert.equal(loadFurnaceMemory(FURNACE_ROLE.REVIEW), '# 用户已写记忆')
})

test('step adapt prefers node role over member role', () => {
  assert.equal(
    resolveAdaptFurnaceRole({ stepAdapt: true, memberAdapt: true }),
    FURNACE_ROLE.NODE_ADAPT,
  )
  assert.equal(
    resolveAdaptFurnaceRole({ stepAdapt: false, memberAdapt: true }),
    FURNACE_ROLE.MEMBER_ADAPT,
  )
  assert.equal(resolveAdaptFurnaceRole({}), null)
})

test('situation slots copy user intent and group agenda', () => {
  const text = composeFurnaceSituation({
    intent: '把本周做的事收成一段给老板',
    groupTitle: '周报工作总结',
    groupDescription: '根据本周节点产出写一段给老板',
    sessionTitle: '#1 · 周报',
    workFolder: '/tmp/week',
    agenda: [{ title: '收集材料' }, { title: '熔炉整理' }, { title: '人确认' }],
    nowIndex: 1,
    now: { title: '熔炉整理', status: 'running' },
    params: [{ key: '#1', value: '本周完成适配闸' }],
    announcementPath: 'journals/sessions/s1/ANNOUNCEMENT.md',
  })
  assert.ok(text.includes('意图：把本周做的事收成一段给老板'))
  assert.ok(text.includes('周报工作总结'))
  assert.ok(text.includes('2. 熔炉整理 ← 现在'))
  assert.ok(text.includes('#1'))
  const packed = composeFurnaceContext(FURNACE_ROLE.SESSION, {
    situation: { intent: '做工作总结', groupTitle: '周报工作总结' },
  })
  assert.ok(packed.includes('熔炉本轮：群聊主持'))
  assert.ok(packed.includes('此刻在做什么'))
  assert.ok(packed.includes('做工作总结'))
  assert.ok(!packed.includes('按闸门政策'))
})

test('situation clips oversized intent', () => {
  const huge = '总结'.repeat(3000)
  const clipped = clipFurnaceText(huge, 20)
  assert.ok(clipped.includes('截断'))
  assert.ok(clipped.length < huge.length)
})

test('switching role keeps situation in ACTIVE.md', () => {
  const situation = { intent: '做工作总结', groupTitle: '周报工作总结' }
  activateFurnaceRole(FURNACE_ROLE.SESSION, { sessionId: 's2', situation })
  const pack = activateFurnaceRole(FURNACE_ROLE.REVIEW, { sessionId: 's2', situation })
  const text = fs.readFileSync(pack.activeMd, 'utf8')
  assert.ok(text.includes('熔炉本轮：系统审核'))
  assert.ok(text.includes('做工作总结'))
  assert.ok(fs.readFileSync(pack.situationMd, 'utf8').includes('做工作总结'))
})
