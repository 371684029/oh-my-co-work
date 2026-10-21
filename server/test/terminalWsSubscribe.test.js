import assert from 'node:assert/strict'
import test from 'node:test'
import {
  subscribe,
  unsubscribe,
  setWsTerminalAttach,
  emitTerminalOutput,
  WS_TERMINAL_BACKPRESSURE_BYTES,
} from '../src/bus.js'

test('terminal.output only reaches the WebSocket that attached to that terminal (CLI-14)', () => {
  const gotA = []
  const gotB = []
  const wsA = {
    readyState: 1,
    bufferedAmount: 0,
    send: (raw) => gotA.push(JSON.parse(raw)),
  }
  const wsB = {
    readyState: 1,
    bufferedAmount: 0,
    send: (raw) => gotB.push(JSON.parse(raw)),
  }
  subscribe('sess-ws-sub', wsA)
  subscribe('sess-ws-sub', wsB)
  setWsTerminalAttach(wsA, 'term-a')
  setWsTerminalAttach(wsB, 'term-b')
  emitTerminalOutput('sess-ws-sub', 'term-a', {
    type: 'terminal.output',
    payload: { terminalId: 'term-a', seq: 1, data: 'hello' },
  })
  unsubscribe(wsA)
  unsubscribe(wsB)
  assert.equal(gotA.length, 1)
  assert.equal(gotB.length, 0)
  assert.equal(gotA[0].payload.data, 'hello')
})

test('emitTerminalOutput signals backpressure instead of buffering forever', () => {
  const got = []
  const ws = {
    readyState: 1,
    bufferedAmount: WS_TERMINAL_BACKPRESSURE_BYTES + 1,
    send: (raw) => got.push(JSON.parse(raw)),
  }
  subscribe('sess-bp', ws)
  setWsTerminalAttach(ws, 'term-x')
  emitTerminalOutput('sess-bp', 'term-x', {
    type: 'terminal.output',
    payload: { terminalId: 'term-x', seq: 2, data: 'drop me' },
  })
  unsubscribe(ws)
  assert.equal(got.length, 1)
  assert.equal(got[0].type, 'terminal.backpressure')
})
