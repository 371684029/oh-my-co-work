import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-furnace-focus-'))
process.env.ACW_DATA_ROOT = dataRoot

const { FURNACE_ROLE } = await import('@acw/shared')
const {
  applyFurnaceFocus,
  furnaceRoleForPin,
  nextFurnaceFocus,
  stampFurnaceSeen,
} = await import('../src/furnaceFocus.js')
const { activateFurnaceRole, furnaceHomeDir, renderFurnaceToolSection } = await import('../src/furnaceContext.js')

function memberStub() {
  return {
    id: 'mem_run',
    display_name: 'runServe',
    config: {
      refine: { enabled: false, verifyLast: { ok: false, stale: true, checks: [] }, verifyFailed: true },
      script: { filePath: '/tmp/runServe.mjs', scriptWorkDir: '/tmp/runServe', mode: 'file' },
    },
  }
}

test('tool section keeps a quoted member name on one line', () => {
  const text = renderFurnaceToolSection({
    stance: 'active',
    memberId: 'mem',
    displayName: 'say "hi"\nnext',
    filePath: '/tmp/a.js',
  })
  const memberLine = text.split('\n').find((line) => line.startsWith('- 成员：'))
  assert.equal(memberLine.includes('"'), false)
  assert.match(memberLine, /next/)
})

test('nextFurnaceFocus: pause and resume keep generation; a different member bumps it', () => {
  const bound = nextFurnaceFocus({}, 'bind', {
    memberId: 'm1',
    displayName: 'run',
    filePath: '/a.bat',
  })
  assert.equal(bound.toolPin.stance, 'active')
  assert.equal(bound.toolPin.generation, 1)
  const paused = nextFurnaceFocus(bound, 'pause')
  assert.equal(paused.toolPin.stance, 'paused')
  assert.equal(paused.toolPin.memberId, 'm1')
  assert.equal(paused.toolPin.generation, 1)
  const resumed = nextFurnaceFocus(paused, 'resume')
  assert.equal(resumed.toolPin.stance, 'active')
  assert.equal(resumed.toolPin.generation, 1)
  const other = nextFurnaceFocus(resumed, 'bind', { memberId: 'm2', filePath: '/b.js' })
  assert.equal(other.toolPin.generation, 2)
  const cleared = nextFurnaceFocus(other, 'clear')
  assert.equal(cleared.toolPin.stance, 'none')
  assert.equal(cleared.toolPin.memberId, null)
  assert.equal(cleared.lastTool.memberId, 'm2')
  const opened = nextFurnaceFocus(
    { toolPin: { stance: 'active', memberId: 'm1', generation: 3, displayName: 'A', filePath: '/a' } },
    'open-free',
  )
  assert.equal(opened.toolPin.stance, 'none')
  assert.equal(opened.lastTool.memberId, 'm1')
  assert.equal(opened.lastTool.generation, undefined)
})

test('bind, workflow refresh, pause, clear, and open-free keep one pin file consistent', async () => {
  const focus = await applyFurnaceFocus(
    { action: 'bind', memberId: 'mem_run', draft: { filePath: '/tmp/runServe.mjs', refine: false } },
    { getMember: memberStub },
  )
  assert.equal(focus.stance, 'active')
  assert.equal(focus.displayName, 'runServe')
  const home = furnaceHomeDir()
  const activeMd = fs.readFileSync(path.join(home, 'ACTIVE.md'), 'utf8')
  assert.match(activeMd, /本轮要改的工具/)
  assert.match(activeMd, /runServe\.mjs/)
  const agents = fs.readFileSync(path.join(home, 'AGENTS.md'), 'utf8')
  assert.match(agents, /本轮要改的工具/)
  assert.match(activeMd, /试跑：无/)
  const before = JSON.parse(fs.readFileSync(path.join(home, 'active.json'), 'utf8'))
  assert.equal(before.role, FURNACE_ROLE.REFINE)
  activateFurnaceRole(FURNACE_ROLE.SESSION, {
    sessionId: 's-workflow',
    situation: '节点一览\n当前：第二步',
  })
  const after = JSON.parse(fs.readFileSync(path.join(home, 'active.json'), 'utf8'))
  assert.equal(after.toolPin.memberId, 'mem_run')
  assert.equal(after.toolPin.stance, 'active')
  const text = fs.readFileSync(path.join(home, 'ACTIVE.md'), 'utf8')
  assert.match(text, /本轮要改的工具/)
  assert.match(text, /第二步/)
  assert.equal(furnaceRoleForPin(FURNACE_ROLE.SESSION, after.toolPin), FURNACE_ROLE.REFINE)
  assert.equal(furnaceRoleForPin(FURNACE_ROLE.REVIEW, after.toolPin), FURNACE_ROLE.REVIEW)

  const paused = await applyFurnaceFocus({ action: 'pause' })
  assert.equal(paused.stance, 'paused')
  const pausedText = fs.readFileSync(path.join(home, 'ACTIVE.md'), 'utf8')
  assert.match(pausedText, /已挂起的工具/)
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, 'active.json'), 'utf8')).role, FURNACE_ROLE.SESSION)
  const cleared = await applyFurnaceFocus({ action: 'clear' })
  assert.equal(cleared.stance, 'none')
  assert.equal(cleared.lastTool.memberId, 'mem_run')
  const clearedText = fs.readFileSync(path.join(home, 'ACTIVE.md'), 'utf8')
  assert.equal(clearedText.includes('本轮要改的工具'), false)
  assert.equal(clearedText.includes('已挂起的工具'), false)
  await applyFurnaceFocus({ action: 'resume' })
  await applyFurnaceFocus({ action: 'open-free' })
  const freed = JSON.parse(fs.readFileSync(path.join(home, 'active.json'), 'utf8'))
  assert.equal(freed.toolPin.stance, 'none')
  assert.equal(freed.lastTool.memberId, 'mem_run')
  const seen = stampFurnaceSeen('grok')
  assert.equal(seen.memberId, null)
  assert.equal(seen.stance, 'none')

  const armed = await applyFurnaceFocus({ action: 'arm-free' })
  assert.equal(armed.stance, 'none')
  const raw = JSON.parse(fs.readFileSync(path.join(home, 'active.json'), 'utf8'))
  assert.equal(raw.armFree, true)
  await applyFurnaceFocus({ action: 'disarm-free' })
  const again = JSON.parse(fs.readFileSync(path.join(home, 'active.json'), 'utf8'))
  assert.equal(again.armFree, undefined)
})
