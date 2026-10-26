import assert from 'node:assert/strict'
import test from 'node:test'
import { flowRailResolveDocLink } from '../src/views/workbench/composables/flowRailDocLink.js'

test('flowRailResolveDocLink resolves relative and step names for same session', () => {
  assert.deepEqual(flowRailResolveDocLink('./README.md', 's1'), {
    sessionId: 's1',
    name: 'README.md',
  })
  assert.deepEqual(flowRailResolveDocLink('./step-01-build.md', 's1'), {
    sessionId: 's1',
    name: 'nodes/step-01-build.md',
  })
  assert.deepEqual(flowRailResolveDocLink('/journals/sessions/s1/nodes/step-02-x.md', 's1'), {
    sessionId: 's1',
    name: 'nodes/step-02-x.md',
  })
})

test('flowRailResolveDocLink rejects cross-session and unknown names', () => {
  assert.equal(flowRailResolveDocLink('/journals/sessions/other/README.md', 's1'), null)
  assert.equal(flowRailResolveDocLink('./secret.txt', 's1'), null)
  assert.equal(flowRailResolveDocLink('', 's1'), null)
  assert.equal(flowRailResolveDocLink('README.md', ''), null)
  assert.deepEqual(flowRailResolveDocLink('ANNOUNCEMENT.md', 's1'), {
    sessionId: 's1',
    name: 'ANNOUNCEMENT.md',
  })
  assert.deepEqual(flowRailResolveDocLink('nodes/step-03-run.md', 's1'), {
    sessionId: 's1',
    name: 'nodes/step-03-run.md',
  })
})
