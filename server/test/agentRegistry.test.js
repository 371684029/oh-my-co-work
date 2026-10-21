import assert from 'node:assert/strict'
import test from 'node:test'
import { listAgentDefinitions } from '../src/agentRegistry.js'

test('listAgentDefinitions includes grok and cursor', () => {
  const agents = listAgentDefinitions({
    grok: { command: 'grok', cursorCommand: 'cursor-agent' },
    customAgents: [{ id: 'aider', displayName: 'Aider', command: 'aider' }],
  })
  assert.ok(agents.some((a) => a.id === 'grok'))
  assert.ok(agents.some((a) => a.id === 'cursor'))
  assert.ok(agents.some((a) => a.id === 'aider'))
})
