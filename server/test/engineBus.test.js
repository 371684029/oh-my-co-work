import assert from 'node:assert/strict'
import test from 'node:test'

const { engineEmit } = await import('../src/engine/events.js')

test('engineEmit throws when the event has no listener', () => {
  assert.throws(
    () => engineEmit('__missing_engine_event__', 1),
    (err) => err?.code === 'ENGINE_BUS_NO_LISTENER',
  )
})

test('engine facade attaches persist listeners', async () => {
  await import('../src/engine.js')
  const { engineListenersAttached } = await import('../src/engine/listeners.js')
  assert.equal(engineListenersAttached(), true)
})
