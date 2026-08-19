import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-grok-inject-'))
process.env.ACW_DATA_ROOT = dataRoot
process.env.ACW_GROK_WORKSPACE = path.join(dataRoot, 'grok-ws')

const { FURNACE_ROLE } = await import('@acw/shared')
const { activateFurnaceRole } = await import('../src/furnaceContext.js')
const {
  FURNACE_AGENTS_BEGIN,
  FURNACE_AGENTS_END,
  upsertMarkedBlock,
  removeMarkedBlock,
  maybeInjectGrokFurnace,
  withGrokPrompt,
  buildGrokLaunchPrompt,
  resolveGrokWorkspaceDir,
} = await import('../src/furnaceGrokInject.js')
const { grokHomeDir: grokHome } = await import('../src/grokStatus.js')

test('upsert keeps user text outside the furnace markers', () => {
  const file = path.join(dataRoot, 'AGENTS.md')
  fs.writeFileSync(file, '# mine\nkeep me\n', 'utf8')
  upsertMarkedBlock(file, 'first role')
  upsertMarkedBlock(file, 'second role')
  const text = fs.readFileSync(file, 'utf8')
  assert.ok(text.startsWith('# mine'))
  assert.ok(text.includes('keep me'))
  assert.ok(text.includes('second role'))
  assert.equal(text.includes('first role'), false)
  assert.ok(text.includes(FURNACE_AGENTS_BEGIN))
  assert.ok(text.includes(FURNACE_AGENTS_END))
})

test('malformed markers backup then reset the block', () => {
  const file = path.join(dataRoot, 'broken.md')
  fs.writeFileSync(file, `${FURNACE_AGENTS_BEGIN}\nno end\n`, 'utf8')
  const r = upsertMarkedBlock(file, 'repaired')
  assert.equal(r.mode, 'reset')
  assert.ok(fs.existsSync(`${file}.bak-furnace`))
  const text = fs.readFileSync(file, 'utf8')
  assert.ok(text.includes('repaired'))
  assert.ok(text.includes(FURNACE_AGENTS_END))
})

test('removeMarkedBlock leaves handwritten notes', () => {
  const file = path.join(dataRoot, 'notes.md')
  fs.writeFileSync(file, 'hello\n', 'utf8')
  upsertMarkedBlock(file, 'temp')
  const r = removeMarkedBlock(file)
  assert.equal(r.ok, true)
  const text = fs.readFileSync(file, 'utf8')
  assert.ok(text.includes('hello'))
  assert.equal(text.includes(FURNACE_AGENTS_BEGIN), false)
})

test('inject writes AGENTS block and ACTIVE, never global grok home', () => {
  const pack = activateFurnaceRole(FURNACE_ROLE.REVIEW, {
    sessionId: 's-inject',
    situation: { intent: '审核当前格', groupTitle: '任意群' },
  })
  const cwd = path.join(dataRoot, 'inject-cwd')
  const r = maybeInjectGrokFurnace(pack, {
    ready: true,
    grok: { writeRules: true, command: 'grok' },
    cwd,
  })
  assert.equal(r.wrote, true)
  const agents = fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8')
  assert.ok(agents.includes('本轮角色：系统审核'))
  assert.ok(agents.includes('审核当前格'))
  assert.ok(fs.readFileSync(path.join(cwd, 'ACTIVE.md'), 'utf8').includes('系统审核'))
  assert.ok(fs.existsSync(path.join(cwd, '.grok', 'rules', 'session.md')))
  assert.notEqual(path.resolve(cwd), path.resolve(grokHome()))
})

test('writeRules off does not rewrite user AGENTS.md', () => {
  const cwd = path.join(dataRoot, 'off-cwd')
  fs.mkdirSync(cwd, { recursive: true })
  const agents = path.join(cwd, 'AGENTS.md')
  fs.writeFileSync(agents, 'user only\n', 'utf8')
  const pack = activateFurnaceRole(FURNACE_ROLE.SESSION)
  const r = maybeInjectGrokFurnace(pack, {
    ready: true,
    grok: { writeRules: false, command: 'grok' },
    cwd,
  })
  assert.equal(r.wrote, false)
  assert.equal(fs.readFileSync(agents, 'utf8'), 'user only\n')
})

test('refuses to treat ~/.grok as cwd', () => {
  const pack = activateFurnaceRole(FURNACE_ROLE.SESSION)
  const r = maybeInjectGrokFurnace(pack, {
    ready: true,
    grok: { writeRules: true },
    cwd: grokHome(),
  })
  assert.equal(r.wrote, false)
  assert.equal(r.skipped, 'refuse_grok_home')
})

test('withGrokPrompt quotes and is idempotent', () => {
  const line = withGrokPrompt('grok', '读 ACTIVE；只对当前格通过或拒绝')
  assert.ok(line.startsWith('grok --prompt '))
  assert.ok(line.includes('"'))
  assert.equal(withGrokPrompt(line, 'again'), line)
})

test('launch prompt follows role', () => {
  assert.ok(buildGrokLaunchPrompt(FURNACE_ROLE.SESSION).includes('主持'))
  assert.ok(buildGrokLaunchPrompt(FURNACE_ROLE.MEMBER_ADAPT).includes('执行者'))
  assert.ok(buildGrokLaunchPrompt(FURNACE_ROLE.NODE_ADAPT).includes('这一格'))
  assert.ok(buildGrokLaunchPrompt(FURNACE_ROLE.REVIEW).includes('通过或拒绝'))
})

test('ACW_GROK_WORKSPACE wins over settings path', () => {
  assert.equal(resolveGrokWorkspaceDir({ workspaceDir: '/tmp/nope' }), path.resolve(process.env.ACW_GROK_WORKSPACE))
})
