<template>
  <span
    class="furnace-avatar"
    :class="[`is-${size}`, `is-${mood}`, { live }]"
    :title="title"
  >
    <img :src="src" :alt="title" draggable="false" />
  </span>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import imgIdleGif from '../assets/furnace-idle.gif'
import imgWorkingGif from '../assets/furnace-working.gif'
import imgWaitingGif from '../assets/furnace-waiting.gif'
import imgIdlePng from '../assets/furnace-idle.png'
import imgWorkingPng from '../assets/furnace-working.png'
import imgWaitingPng from '../assets/furnace-waiting.png'

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
let mq
let onMotion

const src = computed(() => {
  const still = reduceMotion.value
  if (props.mood === 'working') return still ? imgWorkingPng : imgWorkingGif
  if (props.mood === 'waiting') return still ? imgWaitingPng : imgWaitingGif
  return still ? imgIdlePng : imgIdleGif
})

onMounted(() => {
  try {
    mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    onMotion = () => {
      reduceMotion.value = mq.matches
    }
    onMotion()
    if (mq.addEventListener) mq.addEventListener('change', onMotion)
    else mq.addListener(onMotion)
  } catch {
    /* ignore */
  }
})

onUnmounted(() => {
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
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 4px 12px rgba(20, 16, 28, 0.12), inset 0 0 0 1px rgba(0, 0, 0, 0.06);
}

.furnace-avatar.live {
  box-shadow: 0 0 0 2px #34c759, 0 4px 12px rgba(20, 16, 28, 0.12);
}

.furnace-avatar img {
  display: block;
  width: 100%;
  height: 140%;
  object-fit: cover;
  object-position: 50% 6%;
  pointer-events: none;
}

.furnace-avatar.is-sm {
  width: 32px;
  height: 32px;
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
