import assert from 'node:assert/strict'
import test from 'node:test'
import {
  validateArchiveEntries,
  validateBuildMetadataSet,
} from '../../scripts/validate-release-packages.mjs'

test('release archive requires BUILD_INFO and the new furnace spritesheet', () => {
  const entry = validateArchiveEntries(
    [
      'oh-my-co-work-v3-linux-x64/BUILD_INFO.json',
      'oh-my-co-work-v3-linux-x64/web/dist/assets/spritesheet-abc.webp',
    ],
    'linux-x64',
  )
  assert.equal(entry, 'oh-my-co-work-v3-linux-x64/BUILD_INFO.json')
})

test('release archive rejects the retired furnace idle assets', () => {
  assert.throws(
    () =>
      validateArchiveEntries(
        [
          'BUILD_INFO.json',
          'web/dist/assets/spritesheet-abc.webp',
          'web/dist/assets/furnace-idle-old.gif',
        ],
        'win32-x64',
      ),
    /旧版 furnace-idle/,
  )
})

test('all platform packages must share the expected source commit and version', () => {
  const sourceCommit = 'a'.repeat(40)
  const metadata = ['darwin-arm64', 'linux-x64', 'win32-x64'].map((platform) => ({
    kind: 'runtime-bundle',
    version: '3.7.0',
    platform,
    sourceCommit,
  }))
  assert.equal(
    validateBuildMetadataSet({
      metadata,
      expectedCommit: sourceCommit,
      expectedVersion: '3.7.0',
    }),
    true,
  )

  metadata[2] = { ...metadata[2], sourceCommit: 'b'.repeat(40) }
  assert.throws(
    () =>
      validateBuildMetadataSet({
        metadata,
        expectedCommit: sourceCommit,
        expectedVersion: '3.7.0',
      }),
    /sourceCommit/,
  )
})
