import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeParamSpecs,
  validateAndFillSessionParams,
  evalStepSkipWhen,
} from '@acw/shared'

test('validateAndFillSessionParams applies defaults and validates types', () => {
  const specs = normalizeParamSpecs([
    { key: '#1', label: '名称', required: true },
    { key: '#2', type: 'number', default: '0' },
  ])
  const bad = validateAndFillSessionParams(specs, { '#2': 'x' })
  assert.equal(bad.ok, false)
  const ok = validateAndFillSessionParams(specs, { '#1': 'proj' })
  assert.equal(ok.ok, true)
  assert.equal(ok.params['#2'], '0')
})

test('evalStepSkipWhen respects param value and lastOk', () => {
  const step = { skipWhen: { param: '#1', value: 'skip' } }
  assert.equal(evalStepSkipWhen(step, { params: { '#1': 'skip' } }, null), true)
  assert.equal(evalStepSkipWhen(step, { params: { '#1': 'go' } }, null), false)
  assert.equal(evalStepSkipWhen({ skipWhen: { lastOk: false } }, {}, { ok: false }), true)
})
