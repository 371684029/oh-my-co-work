import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { spawn } from 'node:child_process'

test('acw-ctl CLI adds/updates members and creates workflow groups via HTTP API', async (t) => {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-ctl-test-'))
  const toolDir = path.join(dataRoot, 'newBranch')
  fs.mkdirSync(toolDir, { recursive: true })
  process.env.ACW_DATA_ROOT = dataRoot

  const { initDb, closeDb } = await import('../src/db.js')
  const { bootstrapLocalAccess, requireLocalAccess } = await import('../src/localAccess.js')
  const { ensureFurnaceWorkspace } = await import('../src/furnaceContext.js')
  const routes = (await import('../src/routes.js')).default
  const express = (await import('express')).default

  initDb()
  const furnaceHome = ensureFurnaceWorkspace()
  const ctlPath = path.join(furnaceHome, 'acw-ctl.mjs')
  assert.ok(fs.existsSync(ctlPath), 'acw-ctl.mjs should be installed into furnace workspace')

  const app = express()
  app.use(express.json())
  app.get('/api/bootstrap', bootstrapLocalAccess)
  app.use('/api', requireLocalAccess, routes)
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    closeDb()
    fs.rmSync(dataRoot, { recursive: true, force: true })
  })

  const base = `http://127.0.0.1:${server.address().port}`
  const runCtl = (args) =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [ctlPath, ...args], {
        env: { ...process.env, ACW_API_URL: base, ACW_API_TOKEN: '' },
      })
      let out = ''
      let err = ''
      child.stdout.on('data', (c) => (out += c))
      child.stderr.on('data', (c) => (err += c))
      child.on('error', reject)
      child.on('close', (code) =>
        code === 0 ? resolve(out) : reject(new Error(err || `exit ${code}`)),
      )
    })

  // 1) add-member 创建脚本成员（自动补 scriptWorkDir / executionMode / waitForExit）
  const created = JSON.parse(
    await runCtl(['add-member', '--name', 'newBranch', '--cmd', 'node index.mjs #1 #2', '--cwd', toolDir]),
  )
  assert.equal(created.action, 'created')
  assert.equal(created.member.display_name, 'newBranch')
  assert.equal(created.member.kind, 'script')
  assert.equal(created.member.config.script.command, 'node index.mjs #1 #2')
  assert.equal(created.member.config.script.scriptWorkDir, toolDir)
  assert.equal(created.member.config.script.executionMode, 'terminal')

  // 2) 同名再次 add-member 自动走更新，不重复建
  const updated = JSON.parse(
    await runCtl(['add-member', '--name', 'newBranch', '--cmd', 'node index.mjs #1 #2 #3', '--cwd', toolDir]),
  )
  assert.equal(updated.action, 'updated')
  assert.equal(updated.member.id, created.member.id)
  assert.equal(updated.member.config.script.command, 'node index.mjs #1 #2 #3')

  // 3) add-group 按成员名编排步骤（含人工首步与 :gate 人工确认）
  const groupOut = JSON.parse(
    await runCtl([
      'add-group',
      '--title',
      '前端开发流水线',
      '--cwd',
      toolDir,
      '--steps',
      'human:输入需求,newBranch:新建分支:gate',
    ]),
  )
  assert.equal(groupOut.action, 'created')
  assert.equal(groupOut.group.steps.length, 2)
  assert.equal(groupOut.group.steps[0].type, 'human')
  assert.equal(groupOut.group.steps[0].captureParams, true)
  assert.equal(groupOut.group.steps[1].memberId, created.member.id)
  assert.equal(groupOut.group.steps[1].gate, true)
})
