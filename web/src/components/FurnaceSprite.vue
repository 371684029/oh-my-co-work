<template>
  <div
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
  >
    <div v-if="!minimized" class="furnace-pet-stage">
      <div v-show="showBubble" class="furnace-bubble" role="status">
        <p>{{ bubbleText }}</p>
        <div class="furnace-actions">
          <button type="button" class="furnace-act furnace-act--primary" @click.stop="$emit('click')">
            开熔炉
          </button>
          <button type="button" class="furnace-act" @click.stop="poke">戳一下</button>
        </div>
      </div>
      <button
        type="button"
        class="furnace-pet-hit"
        :title="title"
        :aria-label="title"
        @pointerdown="onDragStart"
        @dblclick.stop="$emit('click')"
      >
        <img :src="spriteSrc" :alt="title" class="furnace-pet-img" draggable="false" />
      </button>
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
      :title="title"
      :aria-label="`${title} · 展开`"
      @click="minimized = false"
    >
      <img :src="spriteSrc" alt="熔炉" draggable="false" />
    </button>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import imgIdleGif from '../assets/furnace-idle.gif'
import imgWorkingGif from '../assets/furnace-working.gif'
import imgWaitingGif from '../assets/furnace-waiting.gif'
import imgPokeGif from '../assets/furnace-poke.gif'
import imgIdlePng from '../assets/furnace-idle.png'
import imgWorkingPng from '../assets/furnace-working.png'
import imgWaitingPng from '../assets/furnace-waiting.png'

const POS_KEY = 'acw.furnacePet.pos'
const MIN_KEY = 'acw.furnacePet.min'

const props = defineProps({
  state: {
    type: String,
    default: 'idle',
    validator: (v) => ['idle', 'working', 'waiting'].includes(v),
  },
  title: { type: String, default: '熔炉' },
})
defineEmits(['click'])

const IDLE_LINES = ['有事叫我。', '点两下开熔炉。', '我就在这儿。', '先适配，还是先聊？']
const WORK_LINES = ['在看书改东西，稍等。', '改完再叫你。', '这边忙着呢。']
const WAIT_LINES = ['等人拍板。', '轮到你了。', '我等你开口。']
const POKE_LINES = ['嗯？', '要开就点「开熔炉」。', '我在听。']

const hovered = ref(false)
const poking = ref(false)
const minimized = ref(false)
const showBubble = ref(false)
const bubbleText = ref(IDLE_LINES[0])
function defaultPos() {
  const h = typeof window !== 'undefined' ? window.innerHeight : 720
  return {
    right: 18,
    bottom: Math.round(h / 3),
    left: null,
    top: null,
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

const spriteSrc = computed(() => {
  const still = reduceMotion.value
  if (!still && poking.value) return imgPokeGif
  if (props.state === 'working') return still ? imgWorkingPng : imgWorkingGif
  if (props.state === 'waiting') return still ? imgWaitingPng : imgWaitingGif
  return still ? imgIdlePng : imgIdleGif
})

const stateLabel = computed(() => {
  if (props.state === 'working') return '工作中'
  if (props.state === 'waiting') return '等人'
  return '闲置'
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
let lineIndex = 0
let dragMoved = false
let dragOff = { x: 0, y: 0 }

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
  poking.value = false
  void document.body.offsetWidth
  poking.value = true
  window.clearTimeout(pokeTimer)
  pokeTimer = window.setTimeout(() => {
    poking.value = false
  }, 7000)
  const line = POKE_LINES[Math.floor(Math.random() * POKE_LINES.length)]
  say(line, 4200)
}

function onEnter() {
  hovered.value = true
  showBubble.value = true
  bubbleText.value = linesForState()[lineIndex % linesForState().length]
}

function onLeave() {
  hovered.value = false
  if (!poking.value) {
    window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(() => {
      if (!hovered.value) showBubble.value = false
    }, 900)
  }
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
    pos.value = clampPos(ev.clientX - dragOff.x, ev.clientY - dragOff.y, root)
  }
  const up = () => {
    dragging.value = false
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    if (dragMoved) persist()
    else poke()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

watch(minimized, persist)
watch(
  () => props.state,
  () => {
    lineIndex = 0
    if (hovered.value) bubbleText.value = linesForState()[0]
  },
)

onMounted(() => {
  try {
    reduceMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
    minimized.value = localStorage.getItem(MIN_KEY) === '1'
  } catch {
    pos.value = defaultPos()
  }
  chatterTimer = window.setInterval(() => {
    if (minimized.value || hovered.value || document.hidden) return
    nextChatter()
  }, 90000)
})

onUnmounted(() => {
  window.clearInterval(chatterTimer)
  window.clearTimeout(hideTimer)
  window.clearTimeout(pokeTimer)
})
</script>

<style scoped>
.furnace-pet {
  position: fixed;
  z-index: 40;
  width: 88px;
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
  width: 148px;
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

.furnace-pet-img {
  display: block;
  width: 80px;
  height: auto;
  opacity: 1;
  filter: drop-shadow(0 6px 10px rgba(20, 16, 30, 0.16));
  transform-origin: 50% 100%;
}

.furnace-pet.is-hover .furnace-pet-img,
.furnace-pet.is-working .furnace-pet-img,
.furnace-pet.is-waiting .furnace-pet-img {
  opacity: 1;
}

.furnace-pet.is-hover .furnace-pet-img {
  transform: translateY(-1px);
}

.furnace-pet.is-poke .furnace-pet-img {
  animation: furnace-poke 0.9s ease;
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
  width: 52px;
  height: 72px;
  border: 0;
  border-radius: 16px;
  overflow: hidden;
  padding: 4px 2px 0;
  cursor: pointer;
  opacity: 1;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 4px 10px rgba(20, 16, 28, 0.1);
}

.furnace-pet-peek:hover {
  filter: brightness(1.04);
}

.furnace-pet-peek img {
  display: block;
  width: 48px;
  height: 68px;
  object-fit: contain;
  object-position: center bottom;
}

.furnace-pet.is-min {
  width: 52px;
}

@keyframes furnace-poke {
  0% {
    transform: scale(1);
  }
  35% {
    transform: translateY(-1px);
  }
  100% {
    transform: scale(1);
  }
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
  .furnace-pet-img,
  .furnace-bubble {
    animation: none;
  }
}
</style>
