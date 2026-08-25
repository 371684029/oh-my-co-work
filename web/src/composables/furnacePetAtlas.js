/** ChatGPT / Codex 桌宠 v2 图集（chatgpt-pets）：1536×2288，8×11，单格 192×208。 */
export const PET_ATLAS = {
  columns: 8,
  rows: 11,
  cellWidth: 192,
  cellHeight: 208,
  width: 1536,
  height: 2288,
}

/** 行 / 帧数 / 每帧毫秒。末帧可更长。 */
export const PET_CLIPS = {
  idle: { row: 0, frames: 6, durations: [280, 110, 110, 140, 140, 320] },
  'running-right': { row: 1, frames: 8, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  'running-left': { row: 2, frames: 8, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  waving: { row: 3, frames: 4, durations: [140, 140, 140, 280] },
  jumping: { row: 4, frames: 5, durations: [140, 140, 140, 140, 280] },
  failed: { row: 5, frames: 8, durations: [140, 140, 140, 140, 140, 140, 140, 240] },
  waiting: { row: 6, frames: 6, durations: [150, 150, 150, 150, 150, 260] },
  running: { row: 7, frames: 6, durations: [120, 120, 120, 120, 120, 220] },
  review: { row: 8, frames: 6, durations: [150, 150, 150, 150, 150, 280] },
}

/** 熔炉三态 → 图集 clip。戳一下挥手；拖动按方向跑。 */
export function clipForFurnace({ state, poking, dragDir, looking } = {}) {
  if (poking) return 'waving'
  if (dragDir === 'left') return 'running-left'
  if (dragDir === 'right') return 'running-right'
  if (looking) return 'look'
  if (state === 'working') return 'running'
  if (state === 'waiting') return 'waiting'
  return 'idle'
}

/** 000° 向上，顺时针，16 向（行 9–10）。 */
export function lookIndexFromPointer(rect, clientX, clientY) {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height * 0.38
  const dx = clientX - cx
  const dy = clientY - cy
  const deg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
  return Math.round(deg / 22.5) % 16
}

export function lookCell(index) {
  const i = ((index % 16) + 16) % 16
  return { row: i < 8 ? 9 : 10, col: i % 8 }
}

export function frameDuration(clipId, frame) {
  const clip = PET_CLIPS[clipId]
  if (!clip) return 280
  const i = Math.max(0, Math.min(clip.frames - 1, frame))
  return clip.durations[i] ?? clip.durations[clip.durations.length - 1] ?? 160
}

export function atlasCellStyle({ row, col, displayWidth, sheetUrl }) {
  const { cellWidth: cw, cellHeight: ch, width, height } = PET_ATLAS
  const scale = displayWidth / cw
  return {
    width: `${displayWidth}px`,
    height: `${Math.round(ch * scale)}px`,
    backgroundImage: `url(${sheetUrl})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${width * scale}px ${height * scale}px`,
    backgroundPosition: `-${col * cw * scale}px -${row * ch * scale}px`,
  }
}
