import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCountBadgeBitmap, countBadgeText } from '../lib/overlayBadge.mjs'

test('countBadgeText collapses to 9+ (NTF-08)', () => {
  assert.equal(countBadgeText(0), '')
  assert.equal(countBadgeText(3), '3')
  assert.equal(countBadgeText(9), '9')
  assert.equal(countBadgeText(10), '9+')
  assert.equal(countBadgeText(120), '9+')
})

test('buildCountBadgeBitmap emits BGRA buffer with drawn glyphs', () => {
  const { buffer, width, height } = buildCountBadgeBitmap(3)
  assert.equal(width, 16)
  assert.equal(height, 16)
  assert.equal(buffer.byteLength, 16 * 16 * 4)
  // background red pixel near center-ish corner cut check: (1,1) inside badge
  const px = (x, y) => buffer.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)
  assert.equal(px(1, 1)[3], 0xff) // opaque badge body
  assert.equal(px(0, 0)[3], 0x00) // cut corner is transparent
  // some white glyph pixels must exist
  let white = 0
  for (let i = 0; i < buffer.byteLength; i += 4) {
    if (buffer[i] === 0xff && buffer[i + 1] === 0xff && buffer[i + 2] === 0xff && buffer[i + 3] === 0xff) {
      white++
    }
  }
  assert.ok(white > 5, `expected glyph pixels, got ${white}`)
})
