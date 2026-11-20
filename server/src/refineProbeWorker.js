/**
 * Child-side probe. The parent blocks on Atomics.wait, so this file owns the
 * event loop that watches stdout and the resident grace timer.
 */
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { workerData } from 'node:worker_threads'
import { decodeConsoleBytes } from './consoleEncoding.js'

const {
  cmd,
  args,
  cwd,
  env,
  shell,
  timeoutMs,
  graceMs,
  successCodes,
  resultPath,
  sab,
} = workerData

const flag = new Int32Array(sab)
const outChunks = []
const errChunks = []
let settled = false
let residentKill = false
let headingAt = 0
const started = Date.now()

function stdoutText() {
  return decodeConsoleBytes(Buffer.concat(outChunks))
}

function stderrText() {
  return decodeConsoleBytes(Buffer.concat(errChunks))
}

function finish(payload) {
  if (settled) return
  settled = true
  try {
    fs.writeFileSync(resultPath, JSON.stringify(payload))
  } catch {
    /* parent treats a missing file as spawn failure */
  }
  Atomics.store(flag, 0, 1)
  Atomics.notify(flag, 0, 1)
}

function settleExit(code) {
  const stdout = stdoutText()
  const stderr = stderrText()
  if (residentKill) {
    finish({ exitCode: 0, exitOk: true, stdout, stderr, reason: 'resident' })
    return
  }
  const exitCode = code == null ? -1 : code
  const exitOk = (successCodes || [0]).includes(exitCode)
  finish({
    exitCode,
    exitOk,
    stdout,
    stderr,
    reason: exitOk ? 'ok' : 'EXIT',
  })
}

let child
try {
  child = spawn(cmd, args || [], {
    cwd,
    env,
    windowsHide: true,
    shell: !!shell,
  })
} catch (e) {
  finish({
    exitCode: -1,
    exitOk: false,
    stdout: '',
    stderr: String(e.message || e),
    reason: 'SPAWN',
  })
}

if (child) {
  child.stdout?.on('data', (buf) => {
    outChunks.push(Buffer.from(buf))
    if (!headingAt && /^###\s+\S/m.test(stdoutText())) headingAt = Date.now()
  })
  child.stderr?.on('data', (buf) => {
    errChunks.push(Buffer.from(buf))
  })
  child.on('error', (e) => {
    finish({
      exitCode: -1,
      exitOk: false,
      stdout: stdoutText(),
      stderr: String(e.message || e),
      reason: 'SPAWN',
    })
  })
  child.on('exit', (code) => settleExit(code))

  const timer = setInterval(() => {
    if (settled) {
      clearInterval(timer)
      return
    }
    const now = Date.now()
    if (headingAt && now - headingAt >= graceMs && !residentKill) {
      residentKill = true
      child.kill()
      setTimeout(() => {
        finish({
          exitCode: 0,
          exitOk: true,
          stdout: stdoutText(),
          stderr: stderrText(),
          reason: 'resident',
        })
      }, 400)
      return
    }
    if (now - started >= timeoutMs) {
      clearInterval(timer)
      child.kill()
      setTimeout(() => {
        finish({
          exitCode: -1,
          exitOk: false,
          stdout: stdoutText(),
          stderr: stderrText(),
          reason: 'TIMEOUT',
        })
      }, 400)
    }
  }, 40)
}
