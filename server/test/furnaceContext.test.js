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
  activateFurnaceRole,
  resolveAdaptFurnaceRole,
  loadFurnaceMemory,
  furnaceMemoryDir,
  ensureFurnaceWorkspace,
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
