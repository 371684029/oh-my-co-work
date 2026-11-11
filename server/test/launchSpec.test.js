import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import {
  resolveLaunchSpec,
  winBatCallCommand,
  windowsCmdInvocation,
} from '../src/runners/launchSpec.js'
import { stripSurroundingQuotes } from '../src/runners/cwdResolve.js'

test('stripSurroundingQuotes removes one pair of double quotes', () => {
  const raw = '"D:\\work\\newBranch.bat"'
  assert.equal(stripSurroundingQuotes(raw), 'D:\\work\\newBranch.bat')
})

test('winBatCallCommand uses call + chcp and omits quotes when path has no spaces', () => {
  const line = winBatCallCommand('D:\\ai\\work\\newBranch\\newBranch.bat', ['#1'])
  assert.match(line, /^chcp 65001>nul & call D:\\ai\\work\\newBranch\\newBranch\.bat #1$/)
})

test('resolveLaunchSpec: .bat file + runtime cmd uses call line without cmd /s', () => {
  const bat = 'D:\\ai\\work\\newBranch\\newBranch.bat'
  const spec = resolveLaunchSpec({ filePath: bat, runtime: 'cmd' })
  assert.equal(spec.cmd, process.env.ComSpec || 'cmd.exe')
  if (process.platform === 'win32') {
    assert.equal(spec.args[0], '/d')
    assert.equal(spec.args[1], '/c')
    assert.equal(spec.args[2], winBatCallCommand(bat, []))
    assert.equal(spec.args.includes('/s'), false)
  } else {
    assert.deepEqual(spec.args, ['/d', '/s', '/c', `"${bat}"`])
  }
})

test('resolveLaunchSpec: quoted bat-only command uses call', () => {
  const bat = 'D:\\ai\\work\\newBranch\\newBranch.bat'
  const spec = resolveLaunchSpec({ command: `"${bat}"`, runtime: 'auto' })
  if (process.platform === 'win32') {
    assert.equal(spec.args[1], '/c')
    assert.match(spec.args[2], /call/)
    assert.doesNotMatch(spec.args[2], /^"/)
  }
})

test('resolveLaunchSpec: auto .bat file matches runtime cmd bat branch', () => {
  const bat = path.join('D:', 'ai', 'work', 'newBranch', 'newBranch.bat')
  const spec = resolveLaunchSpec({ filePath: bat })
  if (process.platform === 'win32') {
    assert.deepEqual(spec.args, windowsCmdInvocation(winBatCallCommand(bat, [])))
  }
})
