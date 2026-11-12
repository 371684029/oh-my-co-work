import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-title-'))
process.env.ACW_DATA_ROOT = dataRoot
const { initDb } = await import('../src/db.js')
initDb()

const {
  SYSTEM_PARAM_KEYS,
  formatSessionAutoTitle,
  resolveSessionAutoTitleParam1,
} = await import('@acw/shared')
const { syncAutoSessionTitle } = await import('../src/engine/store.js')

test('resolveSessionAutoTitleParam1 uses kickoff when only #a', () => {
  const ctx = {
    params: { [SYSTEM_PARAM_KEYS.CALL_ARGS]: '需求甲 需求乙 https://figma.com/x' },
    kickoff: { text: '需求甲 需求乙 https://figma.com/x' },
    paramsList: [],
  }
  assert.equal(resolveSessionAutoTitleParam1(ctx), '需求甲')
})

test('syncAutoSessionTitle names session from first start input', () => {
  const ctx = {
    titleAuto: true,
    groupTitle: '原型到提测',
    params: { [SYSTEM_PARAM_KEYS.CALL_ARGS]: '支持星投&决策大师 wll/1111' },
    kickoff: { text: '支持星投&决策大师 wll/1111' },
  }
  const title = syncAutoSessionTitle(ctx, { title: '原型到提测' })
  assert.equal(title, formatSessionAutoTitle({ param1: '支持星投&决策大师', groupTitle: '原型到提测' }))
})
