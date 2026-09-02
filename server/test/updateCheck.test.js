import assert from 'node:assert/strict'
import test from 'node:test'

// 4.2.0 更新检查：版本比较、双源降级、超时静默。

const { compareVersions, checkForUpdates } = await import('../src/updateCheck.js')

test('compareVersions numeric segment compare', () => {
  assert.equal(compareVersions('4.0.0', '4.0.0'), 0)
  assert.equal(compareVersions('4.1.0', '4.0.0'), 1)
  assert.equal(compareVersions('v4.0.0', '3.9.9'), 1)
  assert.equal(compareVersions('3.7.4', '4.0.0'), -1)
  assert.equal(compareVersions('4.0', '4.0.0'), 0)
  assert.equal(compareVersions('', '4.0.0'), -1)
})

function fetchOk(payload) {
  return async () => ({ ok: true, json: async () => payload })
}
function fetchFail() {
  return async () => {
    throw new Error('network down')
  }
}

test('github source: tag_name parsed, hasUpdate computed, notes passed through', async () => {
  const calls = []
  const r = await checkForUpdates({
    fetchImpl: async (url) => {
      calls.push(url)
      return fetchOk({ tag_name: 'v4.1.0', body: '- 修复若干', html_url: 'https://x/r/1' })()
    },
    currentVersion: '4.0.0',
  })
  assert.equal(r.checked, true)
  assert.equal(r.source, 'github')
  assert.equal(r.latest, '4.1.0')
  assert.equal(r.hasUpdate, true)
  assert.ok(r.notes.includes('修复若干'))
  assert.ok(calls[0].includes('releases/latest'))
})

test('same version: checked but no update', async () => {
  const r = await checkForUpdates({ fetchImpl: fetchOk({ tag_name: 'v4.0.0' }), currentVersion: '4.0.0' })
  assert.equal(r.hasUpdate, false)
})

test('github fails → manifest fallback', async () => {
  const r = await checkForUpdates({
    fetchImpl: async (url) => {
      if (url.includes('api.github.com')) throw new Error('rate limit')
      if (url.endsWith('/latest.json')) {
        return fetchOk({ version: '4.2.0', notes: '更新说明' })()
      }
      throw new Error('unexpected url ' + url)
    },
    currentVersion: '4.0.0',
  })
  assert.equal(r.checked, true)
  assert.equal(r.source, 'manifest')
  assert.equal(r.latest, '4.2.0')
  assert.equal(r.hasUpdate, true)
})

test('both sources fail → checked:false with combined error, never throws', async () => {
  const r = await checkForUpdates({ fetchImpl: fetchFail(), currentVersion: '4.0.0' })
  assert.equal(r.checked, false)
  assert.equal(r.current, '4.0.0')
  assert.ok(r.error.includes('github'))
  assert.ok(r.error.includes('manifest'))
})
