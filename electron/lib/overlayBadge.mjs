/**
 * Runtime-generated taskbar overlay count badge (5.4.0 NTF-08 residual).
 * Windows `setOverlayIcon` needs a NativeImage; there is no committed .ico badge
 * asset, so the count glyph is drawn into a raw BGRA bitmap here and wrapped by
 * the caller with `nativeImage.createFromBitmap` (guarded with an icon fallback
 * in main.js). Pure buffer builder — unit-testable without Electron.
 */

// 3×5 pixel font, rows as 3-bit masks (MSB = left pixel).
const GLYPHS = {
  '0': [0b111, 0b101, 0b101, 0b101, 0b111],
  '1': [0b010, 0b110, 0b010, 0b010, 0b111],
  '2': [0b111, 0b001, 0b111, 0b100, 0b111],
  '3': [0b111, 0b001, 0b111, 0b001, 0b111],
  '4': [0b101, 0b101, 0b111, 0b001, 0b001],
  '5': [0b111, 0b100, 0b111, 0b001, 0b111],
  '6': [0b111, 0b100, 0b111, 0b101, 0b111],
  '7': [0b111, 0b001, 0b001, 0b001, 0b001],
  '8': [0b111, 0b101, 0b111, 0b101, 0b111],
  '9': [0b111, 0b101, 0b111, 0b001, 0b111],
  '+': [0b000, 0b010, 0b111, 0b010, 0b000],
}

/** Badge label for a pending count: 1..9 as-is, 10+ collapses to `9+`. */
export function countBadgeText(count) {
  const n = Math.max(0, Number(count) || 0)
  if (n <= 0) return ''
  return n <= 9 ? String(n) : '9+'
}

/**
 * Build a size×size BGRA badge bitmap with the count drawn on a red rounded
 * square. Returns `{ buffer, width, height }`; buffer.byteLength = size²*4.
 */
export function buildCountBadgeBitmap(count, { size = 16, scale = 2 } = {}) {
  const w = Math.max(8, Number(size) || 16)
  const s = Math.max(1, Number(scale) || 2)
  const buffer = Buffer.alloc(w * w * 4)
  const corner = 2

  // Red rounded background (BGRA), corners cut for a soft badge shape.
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const cut =
        (x < corner && y < corner && corner - x + corner - y > corner + 1) ||
        (x >= w - corner && y < corner && x - (w - corner - 1) + corner - y > corner + 1) ||
        (x < corner && y >= w - corner && corner - x + y - (w - corner - 1) > corner + 1) ||
        (x >= w - corner && y >= w - corner && x - (w - corner - 1) + y - (w - corner - 1) > corner + 1)
      if (cut) continue
      const i = (y * w + x) * 4
      buffer[i] = 0x23 // B (#E81123)
      buffer[i + 1] = 0x11 // G
      buffer[i + 2] = 0xe8 // R
      buffer[i + 3] = 0xff // A
    }
  }

  const text = countBadgeText(count)
  if (!text) return { buffer, width: w, height: w }

  const glyphs = [...text].map((ch) => GLYPHS[ch] || GLYPHS['+'])
  const glyphW = 3 * s
  const glyphH = 5 * s
  const gap = s
  const textW = glyphs.length * glyphW + (glyphs.length - 1) * gap
  const x0 = Math.max(0, Math.floor((w - textW) / 2))
  const y0 = Math.max(0, Math.floor((w - glyphH) / 2))

  glyphs.forEach((rows, gi) => {
    const gx = x0 + gi * (glyphW + gap)
    rows.forEach((bits, ry) => {
      for (let rx = 0; rx < 3; rx++) {
        if (!(bits & (1 << (2 - rx)))) continue
        for (let dy = 0; dy < s; dy++) {
          for (let dx = 0; dx < s; dx++) {
            const x = gx + rx * s + dx
            const y = y0 + ry * s + dy
            if (x < 0 || y < 0 || x >= w || y >= w) continue
            const i = (y * w + x) * 4
            buffer[i] = 0xff // B
            buffer[i + 1] = 0xff // G
            buffer[i + 2] = 0xff // R
            buffer[i + 3] = 0xff // A
          }
        }
      }
    })
  })

  return { buffer, width: w, height: w }
}
