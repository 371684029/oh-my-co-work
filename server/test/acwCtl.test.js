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

  const scriptFile = path.join(toolDir, 'index.mjs')
  fs.writeFileSync(scriptFile, 'console.log("v1")\n', 'utf8')

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

  // 4) backup-source → 改源脚本 → /restore-center 看到 diff → 按 manifestId 一键还原到 v1
  const bakOut = JSON.parse(await runCtl(['backup-source', '--member', 'newBranch', '--files', scriptFile]))
  assert.equal(bakOut.ok, true)
  fs.writeFileSync(scriptFile, '// ACW-REFINE\nconsole.log("v2")\n', 'utf8')

  const tk = (await (await fetch(`${base}/api/bootstrap`, { headers: { Origin: base } })).json()).token
  const rc = await (
    await fetch(`${base}/api/restore-center`, { headers: { 'X-ACW-Token': tk } })
  ).json()
  const memEntry = rc.members.find((m) => m.id === created.member.id)
  assert.ok(memEntry.history.length >= 1)
  assert.match(memEntry.history[0].files[0].diff, /-\s*console\.log\("v1"\)/)
  assert.match(memEntry.history[0].files[0].diff, /\+\s*console\.log\("v2"\)/)

  // 越界路径（不在成员工作目录内）应被拒绝
  const outsideFile = path.join(dataRoot, 'outside.txt')
  fs.writeFileSync(outsideFile, 'secret\n', 'utf8')
  const escapeRes = await fetch(`${base}/api/members/${created.member.id}/source-backup`, {
    method: 'POST',
    headers: { 'X-ACW-Token': tk, 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: [outsideFile] }),
  })
  assert.equal(escapeRes.status, 400)

  const restoreRes = await fetch(`${base}/api/members/${created.member.id}/refine/restore`, {
    method: 'POST',
    headers: { 'X-ACW-Token': tk, 'Content-Type': 'application/json' },
    body: JSON.stringify({ force: true, manifestId: memEntry.history[0].id }),
  })
  assert.equal(restoreRes.status, 200)
  assert.equal(fs.readFileSync(scriptFile, 'utf8'), 'console.log("v1")\n')

  const probeDir = path.join(dataRoot, 'probePipe')
  fs.mkdirSync(probeDir, { recursive: true })
  const probeFile = path.join(probeDir, 'probe.mjs')
  fs.writeFileSync(
    probeFile,
    'console.log("### acw-ctl探针\\n");\nconsole.log(process.env.ACW_HUMAN_INPUT||"");\n',
    'utf8',
  )
  const refined = JSON.parse(
    await runCtl([
      'add-member',
      '--name',
      'ctlVerify',
      '--cmd',
      `node probe.mjs #1`,
      '--cwd',
      probeDir,
      '--pipe',
      '--refine',
    ]),
  )
  assert.equal(refined.member.config.refine?.enabled, true)
  const verifyOut = JSON.parse(await runCtl(['verify-member', '--member', 'ctlVerify']))
  assert.equal(verifyOut.ok, true, JSON.stringify(verifyOut))
})
