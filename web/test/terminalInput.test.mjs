import assert from 'node:assert/strict'
import test from 'node:test'

const {
  chunkTerminalInput,
  shouldChunkTerminalInput,
  createInputSequencer,
} = await import('../src/composables/terminalInput.js')

test('chunkTerminalInput: empty input yields no chunks', () => {
  assert.deepEqual(chunkTerminalInput(''), [])
  assert.deepEqual(chunkTerminalInput(null), [])
})

test('chunkTerminalInput: small input is a single chunk', () => {
  assert.deepEqual(chunkTerminalInput('hello', { size: 10 }), ['hello'])
})

test('chunkTerminalInput: respects the size and round-trips exactly', () => {
  const input = 'a'.repeat(10_000)
  const chunks = chunkTerminalInput(input, { size: 4096 })
  assert.equal(chunks.length, 3)
  assert.ok(chunks.every((c) => c.length <= 4096))
  assert.equal(chunks.join(''), input)
})

test('chunkTerminalInput: never splits a surrogate pair', () => {
  // Each emoji is a 2-code-unit surrogate pair: 5 pairs = 10 units.
  const input = '😀😀😀😀😀'
  assert.equal(input.length, 10)
  const chunks = chunkTerminalInput(input, { size: 3 })
  assert.equal(chunks.join(''), input)
  // No chunk may start or end on a lone surrogate.
  for (const c of chunks) {
    if (c.length) {
      const first = c.charCodeAt(0)
      const last = c.charCodeAt(c.length - 1)
      assert.ok(!(first >= 0xdc00 && first <= 0xdfff), 'chunk starts on a low surrogate')
      assert.ok(!(last >= 0xd800 && last <= 0xdbff), 'chunk ends on a high surrogate')
    }
  }
})

test('shouldChunkTerminalInput: only above the threshold', () => {
  assert.equal(shouldChunkTerminalInput('abc', { threshold: 4 }), false)
  assert.equal(shouldChunkTerminalInput('abcde', { threshold: 4 }), true)
})

test('input sequencer: idle keystrokes pass straight through', () => {
  const seq = createInputSequencer()
  assert.deepEqual(seq.enqueue('a'), ['a'])
  assert.equal(seq.pending, false)
})

test('input sequencer: confirm releases paste then buffered keys in order', () => {
  const seq = createInputSequencer()
  seq.begin()
  assert.deepEqual(seq.enqueue('x'), [])
  assert.deepEqual(seq.enqueue('y'), [])
  assert.equal(seq.pending, true)
  assert.deepEqual(seq.flushConfirmed('PASTE\n'), ['PASTE\n', 'x', 'y'])
  assert.equal(seq.pending, false)
  // After flushing, new input passes through again.
  assert.deepEqual(seq.enqueue('z'), ['z'])
})

test('input sequencer: cancel keeps buffered keys, drops the paste', () => {
  const seq = createInputSequencer()
  seq.begin()
  seq.enqueue('x')
  seq.enqueue('y')
  assert.deepEqual(seq.flushCancelled(), ['x', 'y'])
  assert.equal(seq.pending, false)
})

test('input sequencer: begin resets any previous buffer', () => {
  const seq = createInputSequencer()
  seq.begin()
  seq.enqueue('old')
  seq.begin()
  assert.deepEqual(seq.flushCancelled(), [])
})
