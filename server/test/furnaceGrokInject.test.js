import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-grok-inject-'))
process.env.ACW_DATA_ROOT = dataRoot
process.env.ACW_GROK_WORKSPACE = path.join(dataRoot, 'grok-ws')

const { FURNACE_ROLE } = await import('@acw/shared')
const { activateFurnaceRole, furnaceHomeDir } = await import('../src/furnaceContext.js')
const {
  FURNACE_AGENTS_BEGIN,
  upsertMarkedBlock,
  maybeInjectGrokFurnace,
  buildGrokLaunchPrompt,
  defaultGrokWorkspaceDir,
  resolveGrokWorkspaceDir,
  grokPtyLaunch,
  tokenizeCommand,
} = await import('../src/furnaceGrokInject.js')
const { grokHomeDir: grokHome } = await import('../src/grokStatus.js')

test('launch prompt stays short so grok does not eat ACTIVE.md', () => {
  for (const role of Object.values(FURNACE_ROLE)) {
    const p = buildGrokLaunchPrompt(role)
    assert.ok(p.length < 160, p)
    assert.ok(p.includes('勿复述'))
  }
})

test('inject writes a compact AGENTS block, including the launch instruction (no CLI --prompt anymore)', () => {
  const pack = activateFurnaceRole(FURNACE_ROLE.SESSION, {
    situation: { intent: '先把数据拉下来', groupTitle: '采集' },
  })
  const cwd = path.join(dataRoot, 'inject-cwd')
  const r = maybeInjectGrokFurnace(pack, {
    grok: { writeRules: true, command: 'grok' },
    cwd,
  })
  assert.equal(r.wrote, true)
  const agents = fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8')
  assert.ok(agents.includes(FURNACE_AGENTS_BEGIN))
  assert.ok(agents.includes('oh-my-co-work'))
  assert.ok(agents.includes('先把数据拉下来'))
  assert.ok(!agents.includes('## Prompt'))
  // 官方 grok CLI 没有能给交互式会话预填第一句话的参数（-p/--single/
  // --prompt-file/--prompt-json 都是单轮问答就退出的无头模式），短启动词
  // 只能跟着规则一起写进 AGENTS.md，交给 grok 自己按目录发现。
  assert.ok(agents.includes(buildGrokLaunchPrompt(FURNACE_ROLE.SESSION)))
  const sessionRule = fs.readFileSync(path.join(cwd, '.grok', 'rules', 'session.md'), 'utf8')
  assert.ok(sessionRule.includes(buildGrokLaunchPrompt(FURNACE_ROLE.SESSION)))
})

test('refuses ~/.grok and respects writeRules off', () => {
  const pack = activateFurnaceRole(FURNACE_ROLE.SESSION)
  assert.equal(
    maybeInjectGrokFurnace(pack, { grok: { writeRules: true }, cwd: grokHome() }).skipped,
    'refuse_grok_home',
  )
  const cwd = path.join(dataRoot, 'off')
  fs.mkdirSync(cwd, { recursive: true })
  const agents = path.join(cwd, 'AGENTS.md')
  fs.writeFileSync(agents, 'keep\n', 'utf8')
  const r = maybeInjectGrokFurnace(pack, { grok: { writeRules: false }, cwd })
  assert.equal(r.wrote, false)
  assert.equal(fs.readFileSync(agents, 'utf8'), 'keep\n')
})

test('upsert keeps handwritten notes', () => {
  const file = path.join(dataRoot, 'notes.md')
  fs.writeFileSync(file, '# mine\n', 'utf8')
  upsertMarkedBlock(file, 'a')
  upsertMarkedBlock(file, 'b')
  const text = fs.readFileSync(file, 'utf8')
  assert.ok(text.startsWith('# mine'))
  assert.ok(text.includes('b'))
  assert.equal(text.includes('\na\n'), false)
})

test('grok spawn uses argv, no --prompt (real CLI has no such flag; it errors "unexpected argument")', () => {
  const spec = grokPtyLaunch('grok')
  assert.equal(spec.shell, false)
  assert.equal(spec.cmd, 'grok')
  assert.deepEqual(spec.args, [])
  assert.equal(tokenizeCommand('grok --allow read').join('|'), 'grok|--allow|read')
})

test('grokPtyLaunch keeps any user-configured extra args (e.g. --cwd) untouched', () => {
  const spec = grokPtyLaunch('grok --cwd "/my project"')
  assert.equal(spec.cmd, 'grok')
  assert.deepEqual(spec.args, ['--cwd', '/my project'])
})

test('default cwd is furnace home', () => {
  const prev = process.env.ACW_GROK_WORKSPACE
  delete process.env.ACW_GROK_WORKSPACE
  try {
    assert.equal(defaultGrokWorkspaceDir(), furnaceHomeDir())
    assert.equal(resolveGrokWorkspaceDir({}), furnaceHomeDir())
  } finally {
    process.env.ACW_GROK_WORKSPACE = prev
  }
})
