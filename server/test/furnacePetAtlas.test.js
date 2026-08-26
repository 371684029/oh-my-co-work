import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clipForFurnace,
  lookCell,
  lookIndexFromPointer,
  PET_COPYRIGHT,
  PET_CREDIT_SHORT,
  PET_SOURCE_REPO,
} from '../../web/src/composables/furnacePetAtlas.js'

test('熔炉三态映射到 chatgpt-pets v2 clip', () => {
  assert.equal(clipForFurnace({ state: 'idle' }), 'idle')
  assert.equal(clipForFurnace({ state: 'working' }), 'running')
  assert.equal(clipForFurnace({ state: 'waiting' }), 'waiting')
  assert.equal(clipForFurnace({ state: 'idle', poking: true }), 'waving')
  assert.equal(clipForFurnace({ state: 'idle', dragDir: 'left' }), 'running-left')
  assert.equal(clipForFurnace({ state: 'idle', looking: true }), 'look')
})

test('注视方向：向上为 000°，顺时针 16 格', () => {
  const rect = { left: 0, top: 0, width: 100, height: 100 }
  assert.equal(lookIndexFromPointer(rect, 50, 0), 0)
  assert.equal(lookCell(0).row, 9)
  assert.equal(lookCell(0).col, 0)
  assert.equal(lookCell(8).row, 10)
  assert.equal(lookCell(8).col, 0)
})

test('桌宠版权声明指向 chatgpt-pets 仓库', () => {
  assert.match(PET_COPYRIGHT, /chatgpt-pets/)
  assert.match(PET_COPYRIGHT, /MIT/)
  assert.equal(PET_SOURCE_REPO, 'https://github.com/xiongxianzhu/chatgpt-pets')
  assert.match(PET_CREDIT_SHORT, /chatgpt-pets/)
})
