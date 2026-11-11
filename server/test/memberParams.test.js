import assert from 'node:assert/strict'
import test from 'node:test'
import {
  memberRequiredParamKeys,
  memberNeedsProjectParams,
  hasRequiredProjectParams,
  scanParamKeysInMemberConfig,
} from '@acw/shared'

test('command 含 #1 不默认缺参', () => {
  const member = {
    config: {
      script: { command: 'node index.mjs #1 #2 #3' },
    },
  }
  assert.equal(memberNeedsProjectParams(member), false)
  assert.deepEqual(scanParamKeysInMemberConfig(member.config), ['#1', '#2', '#3'])
})

test('requiresParams 显式声明槽位', () => {
  const member = {
    config: {
      requiresParams: ['#1', '#3', '#5'],
      script: { command: 'node x.mjs #1 #3 #5' },
    },
  }
  assert.deepEqual(memberRequiredParamKeys(member), ['#1', '#3', '#5'])
  assert.equal(
    hasRequiredProjectParams({ params: { '#1': 'a', '#3': 'b' }, paramsList: ['a', '', 'b'] }, [
      '#1',
      '#3',
      '#5',
    ]),
    false,
  )
  assert.equal(
    hasRequiredProjectParams(
      { params: { '#1': 'a', '#3': 'b', '#5': 't' }, paramsList: ['a', '', 'b', '', 't'] },
      ['#1', '#3', '#5'],
    ),
    true,
  )
})

test('requiresParams command 模式', () => {
  const member = {
    config: {
      requiresParams: 'command',
      script: { command: 'node a.mjs #2 #4' },
    },
  }
  assert.deepEqual(memberRequiredParamKeys(member), ['#2', '#4'])
})
