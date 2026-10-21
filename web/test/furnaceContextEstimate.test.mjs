import test from 'node:test'
import assert from 'node:assert/strict'
import { estimateFurnaceContext, formatFurnaceContextHint } from '@acw/shared'

test('estimateFurnaceContext returns percent from replay', () => {
  const replay = 'hello world '.repeat(100)
  const est = estimateFurnaceContext(replay, { contextTokens: 1000 })
  assert.ok(est.chars > 0)
  assert.ok(est.tokensApprox > 0)
  assert.ok(est.percent > 0)
})

test('formatFurnaceContextHint handles empty', () => {
  assert.match(formatFurnaceContextHint(estimateFurnaceContext('')), /尚无/)
})
