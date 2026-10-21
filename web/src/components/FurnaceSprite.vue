<template>
  <div
    ref="rootEl"
    class="furnace-pet"
    :class="{
      'is-min': minimized,
      'is-hover': hovered,
      'is-poke': poking,
      [`is-${state}`]: true,
    }"
    :style="petStyle"
    @pointerenter="onEnter"
    @pointerleave="onLeave"
    @pointermove="onPointerLook"
  >
    <div v-if="!minimized" class="furnace-pet-stage">
      <div v-show="showBubble" class="furnace-bubble" role="status" :style="bubbleStyle">
        <p>{{ bubbleText }}</p>
        <div class="furnace-actions">
          <button
            v-if="docsNotifyActive"
            type="button"
            class="furnace-act furnace-act--primary"
            @click.stop="$emit('open-docs')"
          >
            看报告
          </button>
          <button
            v-else
            type="button"
            class="furnace-act furnace-act--primary"
            @click.stop="$emit('click')"
          >
            开熔炉
          </button>
          <button type="button" class="furnace-act" @click.stop="poke">戳一下</button>
        </div>
      </div>
      <button
        type="button"
        class="furnace-pet-hit"
        :title="hitTitle"
        :aria-label="hitTitle"
        @pointerdown="onDragStart"
        @dblclick.stop="$emit('click')"
      >
        <span class="furnace-pet-sheet-wrap" :style="sheetWrapStyle">
          <span class="furnace-pet-sheet" :style="sheetStyle" :aria-label="hitTitle" role="img" />
        </span>
      </button>
      <p class="furnace-pet-credit" :title="creditTitle">{{ PET_CREDIT_SHORT }}</p>
      <div v-show="hovered" class="furnace-pet-meta">
        <span class="furnace-pet-name">熔炉</span>
        <span class="furnace-pet-state">{{ stateLabel }}</span>
        <button type="button" class="furnace-pet-min" title="收起" @click.stop="minimized = true">
          收起
        </button>
      </div>
    </div>
    <button
      v-else
      type="button"
      class="furnace-pet-peek"
      :title="hitTitle"
      :aria-label="`${hitTitle} · 展开`"
      @click="minimized = false"
    >
      <span class="furnace-pet-sheet-wrap is-peek" :style="peekWrapStyle">
        <span class="furnace-pet-sheet" :style="peekSheetStyle" aria-hidden="true" />
      </span>
    </button>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  PET_CLIPS,
  PET_COPYRIGHT,
  PET_CREDIT_SHORT,
  clipForFurnace,
  croppedCellStyles,
  frameDuration,
  lookCell,
  lookIndexFromPointer,
} from '../composables/furnacePetAtlas.js'
import { t } from '../i18n/zh-CN.js'

const POS_KEY = 'acw.furnacePet.pos'
const MIN_KEY = 'acw.furnacePet.min'

const props = defineProps({
  state: {
    type: String,
    default: 'idle',
    validator: (v) => ['idle', 'working', 'waiting'].includes(v),
  },
  title: { type: String, default: '熔炉' },
  /** Increment to show "报告好了" bubble (5.2.0 DOC-18). */
  docsNotifySeq: { type: Number, default: 0 },
})
defineEmits(['click', 'open-docs'])

const creditTitle = computed(() => PET_COPYRIGHT)
const hitTitle = computed(() => `${props.title} · ${PET_CREDIT_SHORT}`)

const IDLE_LINES = ['有事叫我。', '点两下开熔炉。', '我就在这儿。', '先适配，还是先聊？']
const WORK_LINES = ['在改东西，稍等。', '改完再叫你。', '这边忙着呢。']
const WAIT_LINES = ['等人拍板。', '轮到你了。', '我等你开口。']
const POKE_LINES = ['嗯？', '要开就点「开熔炉」。', '我在听。']

// 裁切参数（PET_CROP）在 furnacePetAtlas.js 里统一定义并有回归测试守着，
// 这里只决定「裁完之后展开态/收起态各显示多宽」。
const DISPLAY_W = 85
const PEEK_W = 40

const hovered = ref(false)
const poking = ref(false)
const looking = ref(false)
const dragDir = ref(null)
const lookIndex = ref(8)
const frame = ref(0)
const minimized = ref(false)
const showBubble = ref(false)
const bubbleText = ref(IDLE_LINES[0])
const docsNotifyActive = ref(false)
/** PET-02: default贴右下缘半收起，避开右侧流程/待确认栏（约 360px） */
function defaultPos() {
  return {
    right: 6,
    bottom: 72,
    left: null,
    top: null,
  }
}

const RIGHT_RAIL_RESERVE_PX = 360

function nudgeAwayFromRightRail(el) {
  if (!el || typeof window === 'undefined') return
  const rect = el.getBoundingClientRect()
  const maxLeft = window.innerWidth - RIGHT_RAIL_RESERVE_PX - rect.width - 8
  if (rect.left > maxLeft && pos.value.left == null) {
    pos.value = {
      right: Math.max(6, window.innerWidth - maxLeft - rect.width),
      bottom: pos.value.bottom ?? 72,
      left: null,
      top: null,
    }
    persist()
  }
}

/** 未拖过：贴右的自动落点（旧贴底角 / 旧距顶三分之一）都迁到距底三分之一 */
function isAutoPlacedPos(saved) {
  if (!saved || typeof saved !== 'object') return true
  if (saved.left != null) return false
  const right = Number(saved.right ?? 18)
  return !Number.isFinite(right) || right <= 48
}

const pos = ref(defaultPos())
const dragging = ref(false)
const reduceMotion = ref(false)
const rootEl = ref(null)
const sheetUrl = ref('')

const bubbleStyle = computed(() => {
  if (typeof window === 'undefined' || !rootEl.value) return {}
  const rect = rootEl.value.getBoundingClientRect()
  const pad = 8
  let shift = 0
  if (rect.right + pad > window.innerWidth) {
    shift = window.innerWidth - pad - rect.right
  }
  if (rect.left + shift < pad) shift = pad - rect.left
  return shift ? { transform: `translateX(${Math.round(shift)}px)` } : {}
})

// PET-01: only animate when the sprite is actually on screen. `docVisible`
// (tab/window visibility) and `intersecting` (IntersectionObserver) gate both the
// frame timer and the chatter timer, so a hidden tab or a fullscreen terminal
// covering the sprite stops the perpetual setTimeout chain.
const docVisible = ref(true)
const intersecting = ref(true)
const active = computed(() => docVisible.value && intersecting.value)

const clipId = computed(() =>
  clipForFurnace({
    state: props.state,
    poking: poking.value,
    dragDir: dragDir.value,
    looking: looking.value && !reduceMotion.value,
  }),
)

const cell = computed(() => {
  if (clipId.value === 'look') return lookCell(lookIndex.value)
  const clip = PET_CLIPS[clipId.value] || PET_CLIPS.idle
  const col = reduceMotion.value ? 0 : frame.value % clip.frames
  return { row: clip.row, col }
})

const displayCellStyles = computed(() =>
  croppedCellStyles({
    row: cell.value.row,
    col: cell.value.col,
    viewWidth: DISPLAY_W,
    sheetUrl: sheetUrl.value,
  }),
)
const peekCellStyles = computed(() =>
  croppedCellStyles({
    row: cell.value.row,
    col: cell.value.col,
    viewWidth: PEEK_W,
    sheetUrl: sheetUrl.value,
  }),
)
const sheetWrapStyle = computed(() => displayCellStyles.value.wrap)
const peekWrapStyle = computed(() => peekCellStyles.value.wrap)
const sheetStyle = computed(() => displayCellStyles.value.sheet)
const peekSheetStyle = computed(() => peekCellStyles.value.sheet)

const stateLabel = computed(() => {
  if (props.state === 'working') return t('furnace.working')
  if (props.state === 'waiting') return t('furnace.waiting')
  return t('furnace.idle')
})

const petStyle = computed(() => {
  const s = {}
  if (pos.value.left != null) s.left = `${pos.value.left}px`
  else s.right = `${pos.value.right}px`
  if (pos.value.top != null) s.top = `${pos.value.top}px`
  else s.bottom = `${pos.value.bottom}px`
  return s
})

let chatterTimer = 0
let hideTimer = 0
let pokeTimer = 0
let animTimer = 0
let lineIndex = 0
let dragMoved = false
let dragOff = { x: 0, y: 0 }
let lastDragX = 0
let visibilityHandler = null
let intersectionObserver = null
let resizeHandler = null

function scheduleFrame() {
  window.clearTimeout(animTimer)
  if (reduceMotion.value || clipId.value === 'look' || !active.value) return
  const clip = PET_CLIPS[clipId.value] || PET_CLIPS.idle
  animTimer = window.setTimeout(() => {
    frame.value = (frame.value + 1) % clip.frames
    scheduleFrame()
  }, frameDuration(clipId.value, frame.value))
}

function linesForState() {
  if (props.state === 'working') return WORK_LINES
  if (props.state === 'waiting') return WAIT_LINES
  return IDLE_LINES
}

function say(text, linger = 4200) {
  bubbleText.value = text
  showBubble.value = true
  window.clearTimeout(hideTimer)
  if (hovered.value) return
  hideTimer = window.setTimeout(() => {
    if (!hovered.value) showBubble.value = false
  }, linger)
}

function nextChatter() {
  const lines = linesForState()
  lineIndex = (lineIndex + 1) % lines.length
  say(lines[lineIndex])
}

function poke() {
  looking.value = false
  poking.value = true
  window.clearTimeout(pokeTimer)
  pokeTimer = window.setTimeout(() => {
    poking.value = false
  }, 2200)
  const line = POKE_LINES[Math.floor(Math.random() * POKE_LINES.length)]
  say(line, 4200)
}

function onEnter() {
  hovered.value = true
  looking.value = !dragging.value && !poking.value
  showBubble.value = true
  bubbleText.value = linesForState()[lineIndex % linesForState().length]
}

function onLeave() {
  hovered.value = false
  looking.value = false
  if (!poking.value) {
    window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(() => {
      if (!hovered.value) showBubble.value = false
    }, 900)
  }
}

function onPointerLook(e) {
  if (!hovered.value || poking.value || dragging.value || reduceMotion.value) {
    looking.value = false
    return
  }
  const root = e.currentTarget
  lookIndex.value = lookIndexFromPointer(root.getBoundingClientRect(), e.clientX, e.clientY)
  looking.value = true
}

function persist() {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(pos.value))
    localStorage.setItem(MIN_KEY, minimized.value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function clampPos(left, top, el) {
  const w = el?.offsetWidth || 160
  const h = el?.offsetHeight || 220
  const maxL = Math.max(8, window.innerWidth - w - 8)
  const maxT = Math.max(8, window.innerHeight - h - 8)
  return {
    left: Math.min(maxL, Math.max(8, left)),
    top: Math.min(maxT, Math.max(8, top)),
    right: null,
    bottom: null,
  }
}

function onDragStart(e) {
  if (e.button != null && e.button !== 0) return
  const root = e.currentTarget.closest('.furnace-pet')
  const rect = root.getBoundingClientRect()
  dragMoved = false
  dragging.value = true
  looking.value = false
  lastDragX = e.clientX
  dragOff = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  try {
    e.currentTarget.setPointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
  const move = (ev) => {
    const dx = ev.clientX - (rect.left + dragOff.x)
    const dy = ev.clientY - (rect.top + dragOff.y)
    if (!dragMoved && Math.hypot(dx, dy) < 6) return
    dragMoved = true
    const stepX = ev.clientX - lastDragX
    lastDragX = ev.clientX
    if (stepX < -1) dragDir.value = 'left'
    else if (stepX > 1) dragDir.value = 'right'
    pos.value = clampPos(ev.clientX - dragOff.x, ev.clientY - dragOff.y, root)
  }
  const up = () => {
    dragging.value = false
    dragDir.value = null
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    if (dragMoved) persist()
    else poke()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

watch(minimized, persist)
watch(clipId, () => {
  frame.value = 0
  scheduleFrame()
})
watch(active, (on) => {
  if (on) scheduleFrame()
  else window.clearTimeout(animTimer)
})
watch(
  () => props.state,
  () => {
    lineIndex = 0
    if (hovered.value) bubbleText.value = linesForState()[0]
  },
)

watch(
  () => props.docsNotifySeq,
  (n, prev) => {
    if (n > 0 && n !== prev) {
      docsNotifyActive.value = true
      say('报告好了，点我看', 8000)
    }
  },
)

onMounted(async () => {
  try {
    reduceMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    /* ignore */
  }
  try {
    const mod = await import('../assets/pets/li-muwan/spritesheet.webp')
    sheetUrl.value = mod.default
  } catch {
    /* ignore */
  }
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      pos.value = isAutoPlacedPos(saved) ? defaultPos() : { ...defaultPos(), ...saved }
    } else {
      pos.value = defaultPos()
    }
    const minRaw = localStorage.getItem(MIN_KEY)
    minimized.value = minRaw === null ? true : minRaw === '1'
  } catch {
    pos.value = defaultPos()
    minimized.value = true
  }
  scheduleFrame()
  requestAnimationFrame(() => nudgeAwayFromRightRail(rootEl.value))
  resizeHandler = () => {
    if (dragging.value) return
    if (pos.value.left != null && rootEl.value) {
      pos.value = clampPos(pos.value.left, pos.value.top, rootEl.value)
      persist()
    } else {
      nudgeAwayFromRightRail(rootEl.value)
    }
  }
  window.addEventListener('resize', resizeHandler)

  // PET-01: pause when the tab is hidden or the sprite leaves the viewport.
  try {
    docVisible.value = !document.hidden
  } catch {
    docVisible.value = true
  }
  visibilityHandler = () => {
    docVisible.value = typeof document === 'undefined' ? true : !document.hidden
  }
  document.addEventListener('visibilitychange', visibilityHandler)
  if (rootEl.value && typeof IntersectionObserver !== 'undefined') {
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) intersecting.value = entry.isIntersecting
      },
      { threshold: 0 },
    )
    intersectionObserver.observe(rootEl.value)
  }

  chatterTimer = window.setInterval(() => {
    if (minimized.value || hovered.value || !active.value) return
    nextChatter()
  }, 90000)
})

onUnmounted(() => {
  window.clearInterval(chatterTimer)
  window.clearTimeout(hideTimer)
  window.clearTimeout(pokeTimer)
  window.clearTimeout(animTimer)
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
  resizeHandler = null
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler)
  visibilityHandler = null
  intersectionObserver?.disconnect()
  intersectionObserver = null
})
</script>

<style scoped>
.furnace-pet {
  position: fixed;
  z-index: 40;
  width: 128px;
  pointer-events: none;
  user-select: none;
}

.furnace-pet-stage,
.furnace-pet-peek,
.furnace-pet-hit,
.furnace-act,
.furnace-pet-min {
  pointer-events: auto;
}

.furnace-pet-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.furnace-bubble {
  width: 128px;
  padding: 7px 8px 8px;
  border-radius: 12px 12px 12px 6px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 6px 16px rgba(20, 16, 28, 0.1), inset 0 0 0 0.5px rgba(0, 0, 0, 0.05);
  animation: furnace-bubble-in 0.22s ease;
}

.furnace-bubble p {
  margin: 0 0 6px;
  font-size: 11.5px;
  line-height: 1.4;
  color: #2a2433;
}

.furnace-actions {
  display: flex;
  gap: 6px;
}

.furnace-act {
  flex: 1;
  border: 0;
  border-radius: 999px;
  padding: 4px 0;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.06);
  color: #4a4454;
}

.furnace-act--primary {
  background: #16161a;
  color: #fff;
}

.furnace-act:hover {
  filter: brightness(1.06);
}

.furnace-pet-hit {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: grab;
}

.furnace-pet-hit:active {
  cursor: grabbing;
}

.furnace-pet-sheet-wrap {
  display: block;
  overflow: hidden;
  pointer-events: none;
}

.furnace-pet-sheet {
  display: block;
  pointer-events: none;
  filter: drop-shadow(0 6px 10px rgba(20, 16, 30, 0.16));
}

.furnace-pet.is-hover .furnace-pet-sheet,
.furnace-pet.is-working .furnace-pet-sheet,
.furnace-pet.is-waiting .furnace-pet-sheet {
  opacity: 1;
}

.furnace-pet.is-hover .furnace-pet-sheet-wrap {
  transform: translateY(-1px);
}

.furnace-pet-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.06);
}

.furnace-pet-credit {
  margin: 0;
  max-width: 140px;
  text-align: center;
  font-size: 9.5px;
  line-height: 1.3;
  letter-spacing: 0.01em;
  color: #8e8ea0;
  user-select: none;
  pointer-events: none;
}

.furnace-pet-name {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.furnace-pet-state {
  font-size: 10px;
  color: #8e8ea0;
}

.furnace-pet.is-working .furnace-pet-state {
  color: #007aff;
}

.furnace-pet.is-waiting .furnace-pet-state {
  color: #c2410c;
}

.furnace-pet-min {
  border: 0;
  background: transparent;
  color: #8e8ea0;
  font-size: 10px;
  cursor: pointer;
  padding: 0;
}

.furnace-pet-peek {
  width: 40px;
  height: 65px;
  border: 0;
  border-radius: 16px;
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  opacity: 1;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 4px 10px rgba(20, 16, 28, 0.1);
}

.furnace-pet-peek:hover {
  filter: brightness(1.04);
}

.furnace-pet.is-min {
  width: 56px;
}

@keyframes furnace-bubble-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .furnace-pet-sheet-wrap,
  .furnace-bubble {
    animation: none;
    transform: none;
  }
}
</style>
