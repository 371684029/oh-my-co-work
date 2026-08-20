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
  withGrokPrompt,
  buildGrokLaunchPrompt,
  resolveGrokWorkspaceDir,
  defaultGrokWorkspaceDir,
} = await import('../src/furnaceGrokInject.js')
const { grokHomeDir: grokHome } = await import('../src/grokStatus.js')

test('launch prompt stays short so grok does not eat ACTIVE.md', () => {
  for (const role of Object.values(FURNACE_ROLE)) {
    const p = buildGrokLaunchPrompt(role)
    assert.ok(p.length < 160, p)
    assert.ok(p.includes('勿复述'))
  }
})

test('inject writes a compact AGENTS block', () => {
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
  assert.ok(withGrokPrompt('grok', buildGrokLaunchPrompt(FURNACE_ROLE.SESSION)).includes('--prompt'))
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
