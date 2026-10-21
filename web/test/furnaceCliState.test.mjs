import test from 'node:test'
import assert from 'node:assert/strict'
import { inferFurnaceCliBanner } from '@acw/shared'

test('inferFurnaceCliBanner detects login prompts', () => {
  const b = inferFurnaceCliBanner('Please sign in to continue\n', { status: 'running' })
  assert.equal(b?.kind, 'auth')
})

test('inferFurnaceCliBanner detects quota errors', () => {
  const b = inferFurnaceCliBanner('Error: rate limit exceeded\n', { status: 'running' })
  assert.equal(b?.kind, 'quota')
})
