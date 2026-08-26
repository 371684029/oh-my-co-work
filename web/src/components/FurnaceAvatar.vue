<template>
  <span
    class="furnace-avatar"
    :class="[`is-${size}`, `is-${mood}`, { live }]"
    :title="displayTitle"
  >
    <span class="furnace-avatar-sheet" :style="sheetStyle" :aria-label="displayTitle" role="img" />
  </span>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import sheetUrl from '../assets/pets/li-muwan/spritesheet.webp'
import {
  PET_CLIPS,
  PET_CREDIT_SHORT,
  atlasCellStyle,
  clipForFurnace,
  frameDuration,
} from '../composables/furnacePetAtlas.js'

const props = defineProps({
  mood: {
    type: String,
    default: 'idle',
    validator: (v) => ['idle', 'working', 'waiting'].includes(v),
  },
  size: {
    type: String,
    default: 'sm',
    validator: (v) => ['sm', 'lg'].includes(v),
  },
  live: { type: Boolean, default: false },
  title: { type: String, default: '熔炉' },
})

const reduceMotion = ref(false)
const frame = ref(0)
let mq
let onMotion
let animTimer = 0

const clipId = computed(() => clipForFurnace({ state: props.mood }))
const displayTitle = computed(() => `${props.title} · ${PET_CREDIT_SHORT}`)
const displayWidth = computed(() => (props.size === 'lg' ? 96 : 56))

const sheetStyle = computed(() => {
  const clip = PET_CLIPS[clipId.value] || PET_CLIPS.idle
  const col = reduceMotion.value ? 0 : frame.value % clip.frames
  return atlasCellStyle({
    row: clip.row,
    col,
    displayWidth: displayWidth.value,
    sheetUrl,
  })
})

function scheduleFrame() {
  window.clearTimeout(animTimer)
  if (reduceMotion.value) return
  const clip = PET_CLIPS[clipId.value] || PET_CLIPS.idle
  animTimer = window.setTimeout(() => {
    frame.value = (frame.value + 1) % clip.frames
    scheduleFrame()
  }, frameDuration(clipId.value, frame.value))
}

watch(clipId, () => {
  frame.value = 0
  scheduleFrame()
})

onMounted(() => {
  try {
    mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    onMotion = () => {
      reduceMotion.value = mq.matches
      scheduleFrame()
    }
    onMotion()
    if (mq.addEventListener) mq.addEventListener('change', onMotion)
    else mq.addListener(onMotion)
  } catch {
    scheduleFrame()
  }
})

onUnmounted(() => {
  window.clearTimeout(animTimer)
  if (!mq || !onMotion) return
  if (mq.removeEventListener) mq.removeEventListener('change', onMotion)
  else mq.removeListener(onMotion)
})
</script>

<style scoped>
.furnace-avatar {
  display: inline-flex;
  flex-shrink: 0;
  overflow: hidden;
  align-items: flex-end;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 4px 12px rgba(20, 16, 28, 0.12), inset 0 0 0 1px rgba(0, 0, 0, 0.06);
}

.furnace-avatar.live {
  box-shadow: 0 0 0 2px #34c759, 0 4px 12px rgba(20, 16, 28, 0.12);
}

.furnace-avatar-sheet {
  display: block;
  pointer-events: none;
  flex-shrink: 0;
}

.furnace-avatar.is-sm {
  width: 32px;
  height: 32px;
  align-items: flex-start;
}

.furnace-avatar.is-sm .furnace-avatar-sheet {
  margin-top: -4px;
}

.furnace-avatar.is-lg {
  width: 108px;
  height: 108px;
  box-shadow: 0 10px 24px rgba(20, 16, 28, 0.14), inset 0 0 0 1px rgba(0, 0, 0, 0.05);
}

.furnace-avatar.is-lg.live {
  box-shadow: 0 0 0 3px #34c759, 0 10px 24px rgba(20, 16, 28, 0.14);
}

.furnace-avatar.is-waiting {
  filter: saturate(0.92);
}
</style>
