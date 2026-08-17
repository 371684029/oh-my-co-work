import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAdapterLine } from '../src/terminal/adapters/jsonl.js'

test('parseAdapterLine accepts trusted JSONL event types', () => {
  assert.equal(parseAdapterLine('').skip, true)
  assert.equal(parseAdapterLine('{').error.code, 'ADAPTER_JSON')
  assert.equal(parseAdapterLine('{"type":"nope"}').error.code, 'ADAPTER_TYPE')
  assert.deepEqual(parseAdapterLine('{"type":"message","role":"assistant","text":"hi"}').event, {
    type: 'message',
    role: 'assistant',
    text: 'hi',
  })
  assert.equal(parseAdapterLine('{"type":"question","id":"q1","text":"go?","choices":["yes","no"]}').event.id, 'q1')
  assert.equal(parseAdapterLine('{"type":"result","summary":"done","files":["a.js"]}').event.summary, 'done')
})
