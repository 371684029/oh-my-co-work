import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clipForFurnace,
  croppedCellStyles,
  lookCell,
  lookIndexFromPointer,
  PET_CLIPS,
  PET_COPYRIGHT,
  PET_CREDIT_SHORT,
  PET_CROP,
  PET_SOURCE_REPO,
} from '../../web/src/composables/furnacePetAtlas.js'

test('熔炉三态映射到 chatgpt-pets v2 clip', () => {
  assert.equal(clipForFurnace({ state: 'idle' }), 'idle')
  assert.equal(clipForFurnace({ state: 'working' }), 'running')
  assert.equal(clipForFurnace({ state: 'waiting' }), 'waiting')
  assert.equal(clipForFurnace({ state: 'idle', poking: true }), 'waving')
  assert.equal(clipForFurnace({ state: 'idle', dragDir: 'left' }), 'running-left')
  assert.equal(clipForFurnace({ state: 'idle', looking: true }), 'look')
})

test('注视方向：向上为 000°，顺时针 16 格', () => {
  const rect = { left: 0, top: 0, width: 100, height: 100 }
  assert.equal(lookIndexFromPointer(rect, 50, 0), 0)
  assert.equal(lookCell(0).row, 9)
  assert.equal(lookCell(0).col, 0)
  assert.equal(lookCell(8).row, 10)
  assert.equal(lookCell(8).col, 0)
})

test('桌宠版权声明指向 chatgpt-pets 仓库', () => {
  assert.match(PET_COPYRIGHT, /chatgpt-pets/)
  assert.match(PET_COPYRIGHT, /MIT/)
  assert.equal(PET_SOURCE_REPO, 'https://github.com/xiongxianzhu/chatgpt-pets')
  assert.match(PET_CREDIT_SHORT, /chatgpt-pets/)
})

test('croppedCellStyles 按 viewWidth 等比裁出 wrap/sheet 尺寸与偏移', () => {
  const { wrap, sheet } = croppedCellStyles({ row: 0, col: 0, viewWidth: 128, sheetUrl: 'x.webp' })
  assert.equal(wrap.width, '128px')
  // 128 / PET_CROP.width(128) = 1 倍缩放，cellHeight 208 → 高度不变
  assert.equal(wrap.height, '208px')
  assert.equal(sheet.width, '192px') // 整格宽度按 1 倍缩放画出来，靠 marginLeft 裁掉两侧
  assert.equal(sheet.marginLeft, '-32px') // -PET_CROP.x * scale(1)
})

test('croppedCellStyles 对更小的 viewWidth（收起态）等比缩放', () => {
  const { wrap, sheet } = croppedCellStyles({ row: 0, col: 0, viewWidth: 64, sheetUrl: 'x.webp' })
  const scale = 64 / PET_CROP.width // 0.5
  assert.equal(wrap.width, '64px')
  assert.equal(wrap.height, `${Math.round(208 * scale)}px`)
  assert.equal(sheet.width, `${192 * scale}px`)
  assert.equal(sheet.marginLeft, `${-PET_CROP.x * scale}px`)
})

/**
 * 用 ffmpeg alphaextract+bbox 量过 spritesheet.webp 里每一帧的不透明像素范围
 * （192px 单格坐标系）。只收 clipForFurnace()/lookCell() 实际会用到的行/列——
 * `jumping`/`failed`/`review` 三行更宽，但永远不会被选中，不纳入本测试。
 * 如果以后改图集或改 PET_CROP，这张表能立刻告诉你有没有把人物边缘裁掉。
 */
const REACHABLE_FRAME_BOUNDS = [
  // idle：row0，frames=6，各帧边界一致
  ...[0, 1, 2, 3, 4, 5].map((col) => ({ row: 0, col, x1: 51, x2: 139 })),
  // running-right：row1，frames=8
  { row: 1, col: 0, x1: 42, x2: 148 },
  { row: 1, col: 1, x1: 41, x2: 149 },
  { row: 1, col: 2, x1: 46, x2: 144 },
  { row: 1, col: 3, x1: 35, x2: 156 },
  { row: 1, col: 4, x1: 49, x2: 142 },
  { row: 1, col: 5, x1: 45, x2: 146 },
  { row: 1, col: 6, x1: 42, x2: 148 },
  { row: 1, col: 7, x1: 50, x2: 141 },
  // running-left：row2，frames=8
  { row: 2, col: 0, x1: 43, x2: 149 },
  { row: 2, col: 1, x1: 42, x2: 150 },
  { row: 2, col: 2, x1: 47, x2: 145 },
  { row: 2, col: 3, x1: 35, x2: 156 },
  { row: 2, col: 4, x1: 49, x2: 142 },
  { row: 2, col: 5, x1: 45, x2: 146 },
  { row: 2, col: 6, x1: 43, x2: 149 },
  { row: 2, col: 7, x1: 50, x2: 141 },
  // waving：row3，frames=4
  { row: 3, col: 0, x1: 48, x2: 143 },
  { row: 3, col: 1, x1: 47, x2: 143 },
  { row: 3, col: 2, x1: 48, x2: 142 },
  { row: 3, col: 3, x1: 48, x2: 143 },
  // waiting：row6，frames=6
  { row: 6, col: 0, x1: 52, x2: 139 },
  { row: 6, col: 1, x1: 59, x2: 132 },
  { row: 6, col: 2, x1: 56, x2: 135 },
  { row: 6, col: 3, x1: 56, x2: 135 },
  { row: 6, col: 4, x1: 57, x2: 134 },
  { row: 6, col: 5, x1: 52, x2: 138 },
  // running：row7，frames=6
  { row: 7, col: 0, x1: 48, x2: 143 },
  { row: 7, col: 1, x1: 58, x2: 132 },
  { row: 7, col: 2, x1: 56, x2: 134 },
  { row: 7, col: 3, x1: 50, x2: 140 },
  { row: 7, col: 4, x1: 55, x2: 136 },
  { row: 7, col: 5, x1: 49, x2: 142 },
  // look 0–7：row9
  { row: 9, col: 0, x1: 48, x2: 141 },
  { row: 9, col: 1, x1: 50, x2: 140 },
  { row: 9, col: 2, x1: 51, x2: 140 },
  { row: 9, col: 3, x1: 51, x2: 140 },
  { row: 9, col: 4, x1: 51, x2: 139 },
  { row: 9, col: 5, x1: 51, x2: 138 },
  { row: 9, col: 6, x1: 52, x2: 137 },
  { row: 9, col: 7, x1: 52, x2: 138 },
  // look 8–15：row10
  { row: 10, col: 0, x1: 64, x2: 125 },
  { row: 10, col: 1, x1: 64, x2: 125 },
  { row: 10, col: 2, x1: 64, x2: 126 },
  { row: 10, col: 3, x1: 64, x2: 125 },
  { row: 10, col: 4, x1: 64, x2: 126 },
  { row: 10, col: 5, x1: 64, x2: 125 },
  { row: 10, col: 6, x1: 64, x2: 125 },
  { row: 10, col: 7, x1: 64, x2: 126 },
]

test('PET_CROP 裁切窗口覆盖所有可达帧的真实人物边界（不裁掉手脚）', () => {
  const cropStart = PET_CROP.x
  const cropEnd = PET_CROP.x + PET_CROP.width
  for (const { row, col, x1, x2 } of REACHABLE_FRAME_BOUNDS) {
    assert.ok(
      x1 >= cropStart,
      `row${row} col${col}: 人物左边界 x1=${x1} 超出裁切窗口左侧 ${cropStart}（会被裁掉）`,
    )
    assert.ok(
      x2 <= cropEnd,
      `row${row} col${col}: 人物右边界 x2=${x2} 超出裁切窗口右侧 ${cropEnd}（会被裁掉）`,
    )
  }
})

test('可达 clip 列表与 REACHABLE_FRAME_BOUNDS 覆盖的行一致（防止漏了新 clip）', () => {
  const reachableClipIds = new Set(
    ['idle', 'working', 'waiting'].flatMap((state) => [
      clipForFurnace({ state }),
      clipForFurnace({ state, poking: true }),
      clipForFurnace({ state, dragDir: 'left' }),
      clipForFurnace({ state, dragDir: 'right' }),
      clipForFurnace({ state, looking: true }),
    ]),
  )
  const reachableRows = new Set(
    [...reachableClipIds].filter((id) => id !== 'look').map((id) => PET_CLIPS[id].row),
  )
  reachableRows.add(9) // look 用 lookCell，不在 PET_CLIPS 里
  reachableRows.add(10)
  const coveredRows = new Set(REACHABLE_FRAME_BOUNDS.map((b) => b.row))
  for (const row of reachableRows) {
    assert.ok(coveredRows.has(row), `clipForFurnace 可达的 row=${row} 没有被回归测试的边界表覆盖`)
  }
})
