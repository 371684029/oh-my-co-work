import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizePromptSnippets,
  resolvePromptSnippetRefs,
  composeMemberPrompt,
} from '../src/promptSnippets.js'

test('resolvePromptSnippetRefs replaces by id and name', () => {
  const snippets = normalizePromptSnippets([
    { id: 'a1', name: 'Role', body: 'You are helpful.' },
  ])
  const out = resolvePromptSnippetRefs('Before {{snippet:Role}} after {{snippet:a1}}', snippets)
  assert.match(out, /You are helpful/)
  assert.equal(out.split('You are helpful.').length, 3)
})

test('composeMemberPrompt merges snippet ids then resolves inline refs', () => {
  const snippets = normalizePromptSnippets([
    { id: 's1', name: 'Intro', body: 'Intro block' },
  ])
  const text = composeMemberPrompt('Main {{snippet:Intro}}', { promptSnippetIds: ['s1'] }, snippets)
  assert.match(text, /Intro block/)
  assert.match(text, /Main/)
})
