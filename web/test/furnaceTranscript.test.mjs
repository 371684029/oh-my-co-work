import test from 'node:test'
import assert from 'node:assert/strict'
import { filterAgentTranscriptNoise } from '@acw/shared'

test('filterAgentTranscriptNoise removes box-drawing-only lines for cursor profile', () => {
  const raw = 'hello\n│───│\nanswer text'
  const out = filterAgentTranscriptNoise(raw, 'cursor')
  assert.match(out, /hello/)
  assert.match(out, /answer text/)
  assert.doesNotMatch(out, /│───│/)
})
