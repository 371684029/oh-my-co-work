import assert from 'node:assert/strict'
import test from 'node:test'

// web 纯逻辑测试（3.8.2）：桌宠图集数学。node --test，不引入第三方测试库。

const {
  PET_ATLAS,
  PET_CLIPS,
  PET_CROP,
  clipForFurnace,
  lookIndexFromPointer,
  lookCell,
  frameDuration,
  atlasCellStyle,
  croppedCellStyles,
} = await import('../src/composables/furnacePetAtlas.js')

test('atlas geometry matches the chatgpt-pets v2 sheet', () => {
  assert.deepEqual(PET_ATLAS, {
    columns: 8,
    rows: 11,
    cellWidth: 192,
    cellHeight: 208,
    width: 1536,
    height: 2288,
  })
  // 每个实际会播的 clip 帧数与 durations 数量一致
  for (const [id, clip] of Object.entries(PET_CLIPS)) {
    assert.equal(clip.durations.length, clip.frames, `clip ${id} durations/frames mismatch`)
    assert.ok(clip.row < PET_ATLAS.rows, `clip ${id} row out of sheet`)
  }
})

test('clipForFurnace maps furnace states to the right clips', () => {
  assert.equal(clipForFurnace({ state: 'working' }), 'running')
  assert.equal(clipForFurnace({ state: 'waiting' }), 'waiting')
  assert.equal(clipForFurnace({ state: 'idle' }), 'idle')
  assert.equal(clipForFurnace({}), 'idle')
  // 优先级：戳 > 拖动方向 > 看向指针 > 状态
  assert.equal(clipForFurnace({ state: 'working', poking: true }), 'waving')
  assert.equal(clipForFurnace({ state: 'working', dragDir: 'left' }), 'running-left')
  assert.equal(clipForFurnace({ state: 'working', dragDir: 'right' }), 'running-right')
  assert.equal(clipForFurnace({ state: 'idle', looking: true }), 'look')
})

test('lookIndexFromPointer maps 16 directions clockwise from up', () => {
  const rect = { left: 0, top: 0, width: 100, height: 100 }
  // 焦点在 (50, 38)（高度的 0.38 处）
  assert.equal(lookIndexFromPointer(rect, 50, 0), 0) // 正上
  assert.equal(lookIndexFromPointer(rect, 150, 38), 4) // 正右（90°）
  assert.equal(lookIndexFromPointer(rect, 50, 138), 8) // 正下（180°）
  assert.equal(lookIndexFromPointer(rect, -50, 38), 12) // 正左（270°）
  assert.equal(lookIndexFromPointer(rect, 50 + 50 * Math.SQRT2, 38 - 50 * Math.SQRT2), 2) // 右上 45°
})

test('lookCell wraps index into rows 9-10', () => {
  assert.deepEqual(lookCell(0), { row: 9, col: 0 })
  assert.deepEqual(lookCell(7), { row: 9, col: 7 })
  assert.deepEqual(lookCell(8), { row: 10, col: 0 })
  assert.deepEqual(lookCell(15), { row: 10, col: 7 })
  assert.deepEqual(lookCell(16), { row: 9, col: 0 })
  assert.deepEqual(lookCell(-1), { row: 10, col: 7 })
})

test('frameDuration clamps and falls back', () => {
  assert.equal(frameDuration('idle', 0), 280)
  assert.equal(frameDuration('idle', 5), 320)
  assert.equal(frameDuration('idle', 99), 320) // 越界夹到最后一位
  assert.equal(frameDuration('idle', -3), 280) // 负数夹到 0
  assert.equal(frameDuration('no-such-clip', 2), 280) // 未知 clip 默认
})

test('atlasCellStyle scales the spritesheet math', () => {
  const s = atlasCellStyle({ row: 1, col: 2, displayWidth: 96, sheetUrl: 'x.webp' })
  assert.equal(s.width, '96px')
  assert.equal(s.height, '104px') // 208 * 0.5
  assert.equal(s.backgroundSize, '768px 1144px') // 1536*0.5, 2288*0.5
  assert.equal(s.backgroundPosition, '-192px -104px') // -(2*192*0.5), -(1*208*0.5)
})

test('croppedCellStyles applies PET_CROP and margin shift', () => {
  const { wrap, sheet } = croppedCellStyles({ row: 0, col: 0, viewWidth: 64, sheetUrl: 'x.webp' })
  assert.equal(wrap.width, '64px')
  assert.equal(wrap.height, '104px') // 208 * (64/128) = 104
  assert.equal(sheet.marginLeft, '-16px') // -32 * 0.5
  assert.equal(sheet.backgroundSize, '768px 1144px') // 整格 96px 宽 → sheet 1536 * 0.5
  assert.ok(Number(PET_CROP.x) > 0)
})
