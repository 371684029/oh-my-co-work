import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-demo-repair-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb } = await import('../src/db.js')
initDb()
const { createMember, getMember } = await import('../src/services.js')
const { repairDemoKeepAliveMembers } = await import('../src/demoRepair.js')
const { MEMBER_KIND } = await import('@acw/shared')

function makeScriptMember(name, script, extraConfig = {}) {
  return createMember({
    name,
    displayName: name,
    kind: MEMBER_KIND.SCRIPT,
    workFolder: process.cwd(),
    config: {
      ...extraConfig,
      script: { mode: 'command', scriptWorkDir: process.cwd(), ...script },
    },
  })
}

test('repairs demo members whose command leaves an interactive shell alive', () => {
  const member = makeScriptMember(
    'demo-keepalive',
    { command: 'echo ECW-OK #1 & cmd', timeoutMs: 600_000 },
    { demo: true },
  )
  assert.equal(getMember(member.id).config.script.waitForExit, undefined)

  const repaired = repairDemoKeepAliveMembers()
  assert.ok(repaired.includes(member.id))
  assert.equal(getMember(member.id).config.script.waitForExit, false)
  // 其余配置不能被改坏
  assert.equal(getMember(member.id).config.script.command, 'echo ECW-OK #1 & cmd')
  assert.equal(getMember(member.id).config.script.timeoutMs, 600_000)
})

test('repair is idempotent and leaves already-fixed members untouched', () => {
  const first = repairDemoKeepAliveMembers()
  const second = repairDemoKeepAliveMembers()
  assert.equal(first.length, 0, '第一次已在上一个用例修完，这里应无待修项')
  assert.equal(second.length, 0)
})

test('never touches non-demo members, plain commands, or explicit user choices', () => {
  // 非 demo：即使命令保活也不动（用户自建配置由用户负责）
  const userOwned = makeScriptMember('user-keepalive', { command: 'echo hi & cmd' })
  // demo 但命令会正常退出：不该被加 waitForExit
  const plainDemo = makeScriptMember('demo-plain', { command: 'echo hi' }, { demo: true })
  // demo 且用户显式要求等待退出：必须尊重用户
  const explicit = makeScriptMember(
    'demo-explicit',
    { command: 'echo hi & cmd', waitForExit: true },
    { demo: true },
  )

  const repaired = repairDemoKeepAliveMembers()
  assert.equal(repaired.includes(userOwned.id), false)
  assert.equal(repaired.includes(plainDemo.id), false)
  assert.equal(repaired.includes(explicit.id), false)

  assert.equal(getMember(userOwned.id).config.script.waitForExit, undefined)
  assert.equal(getMember(plainDemo.id).config.script.waitForExit, undefined)
  assert.equal(getMember(explicit.id).config.script.waitForExit, true)
})

test('linux-style keep-alive commands are recognised too', () => {
  const member = makeScriptMember(
    'demo-bash',
    { command: 'echo ECW-OK #1; exec bash' },
    { demo: true },
  )
  const repaired = repairDemoKeepAliveMembers()
  assert.ok(repaired.includes(member.id))
  assert.equal(getMember(member.id).config.script.waitForExit, false)
})
