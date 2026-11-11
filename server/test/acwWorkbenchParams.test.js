import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasAcwWorkbenchParams,
  paramListFromAcwEnv,
  paramMapFromAcwEnv,
} from '@acw/shared'

test('paramMapFromAcwEnv：ACW_PARAM_1… 连续读取', () => {
  const map = paramMapFromAcwEnv({
    ACW_PARAM_1: '需求',
    ACW_PARAM_2: 'branch/x',
    ACW_PARAM_3: '0',
    ACW_PARAM_4: '1',
    ACW_PARAM_5: 'true',
  })
  assert.deepEqual(map, {
    '#1': '需求',
    '#2': 'branch/x',
    '#3': '0',
    '#4': '1',
    '#5': 'true',
  })
})

test('paramListFromAcwEnv：自 #3 起与交互 rest 一致', () => {
  const tail = paramListFromAcwEnv(
    {
      ACW_PARAMS_JSON: JSON.stringify({
        '#1': 'a',
        '#2': 'b',
        '#3': '0',
        '#4': '1',
      }),
    },
    3,
  )
  assert.deepEqual(tail, ['0', '1'])
})

test('hasAcwWorkbenchParams', () => {
  assert.equal(hasAcwWorkbenchParams({}), false)
  assert.equal(hasAcwWorkbenchParams({ ACW_PARAM_1: 'x' }), true)
})
