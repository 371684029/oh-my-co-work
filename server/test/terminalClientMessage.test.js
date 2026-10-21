import assert from 'node:assert/strict'
import test from 'node:test'
import { handleTerminalClientMessage } from '../src/terminal/clientMessage.js'

test('terminal.attach returns snapshot for known terminal', () => {
  const sent = []
  const entry = {
    id: 't1',
    sessionId: 's1',
    seq: 3,
    replay: 'hello',
    replayTruncated: false,
    status: 'running',
    cols: 80,
    rows: 24,
  }
  const ws = { readyState: 1, send: (raw) => sent.push(JSON.parse(raw)) }
  const ok = handleTerminalClientMessage(
    {
      getEntry: (id) => (id === 't1' ? entry : null),
      setWsTerminalAttach: () => {},
      flushOutput: () => {},
      publicTerminal: (e) => ({ id: e.id, status: e.status }),
      killTerminal: () => {},
    },
    ws,
    's1',
    JSON.stringify({ type: 'terminal.attach', terminalId: 't1' }),
  )
  assert.equal(ok, true)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].type, 'terminal.snapshot')
  assert.equal(sent[0].payload.data, 'hello')
})

test('terminal.input rejects oversize payload', () => {
  const sent = []
  const entry = {
    id: 't1',
    sessionId: 's1',
    status: 'running',
    inputWindowAt: 0,
    inputBytesInWindow: 0,
    inputMessagesInWindow: 0,
    process: { write: () => {} },
  }
  const ws = { readyState: 1, send: (raw) => sent.push(JSON.parse(raw)) }
  handleTerminalClientMessage(
    {
      getEntry: () => entry,
      setWsTerminalAttach: () => {},
      flushOutput: () => {},
      publicTerminal: () => ({}),
      killTerminal: () => {},
    },
    ws,
    's1',
    JSON.stringify({
      type: 'terminal.input',
      terminalId: 't1',
      data: 'x'.repeat(70000),
    }),
  )
  assert.equal(sent[0].payload.code, 'INPUT_TOO_LARGE')
})
