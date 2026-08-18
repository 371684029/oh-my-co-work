<template>
  <button
    type="button"
    class="furnace-sprite"
    :class="`is-${state}`"
    :title="title"
    :aria-label="title"
    @click="$emit('click')"
  >
    <svg viewBox="0 0 48 64" aria-hidden="true">
      <!-- 极简黑裙剪影：头 + 发 + 裙 -->
      <ellipse class="hair" cx="24" cy="16" rx="11" ry="13" />
      <circle class="face" cx="24" cy="18" r="7.2" />
      <path
        class="dress"
        d="M16 28 C16 26 20 25 24 25 C28 25 32 26 32 28 L36 58 C36 61 30 63 24 63 C18 63 12 61 12 58 Z"
      />
    </svg>
    <span class="furnace-sprite-name">熔炉</span>
  </button>
</template>

<script setup>
defineProps({
  state: {
    type: String,
    default: 'idle',
    validator: (v) => ['idle', 'working', 'waiting'].includes(v),
  },
  title: { type: String, default: '熔炉' },
})
defineEmits(['click'])
</script>

<style scoped>
.furnace-sprite {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  border: 0;
  padding: 4px 8px 2px;
  background: transparent;
  cursor: pointer;
  color: var(--ecw-text-1, #1d1d1f);
}

.furnace-sprite svg {
  width: 28px;
  height: 38px;
  display: block;
}

.hair,
.dress {
  fill: #16161a;
}

.face {
  fill: #f3d7c4;
}

.furnace-sprite-name {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  line-height: 1;
  color: var(--ecw-text-2, #6e6e73);
}

.furnace-sprite.is-idle .dress {
  fill: #1c1c22;
}

.furnace-sprite.is-working svg {
  animation: furnace-work 1.1s ease-in-out infinite;
}

.furnace-sprite.is-working .dress {
  fill: #0b0b10;
}

.furnace-sprite.is-waiting svg {
  animation: furnace-wait 1.8s ease-in-out infinite;
}

.furnace-sprite.is-waiting .face {
  fill: #f7c9b8;
}

@keyframes furnace-work {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
}

@keyframes furnace-wait {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.62;
  }
}

.furnace-sprite:hover .furnace-sprite-name {
  color: var(--ecw-text-1, #1d1d1f);
}

@media (prefers-reduced-motion: reduce) {
  .furnace-sprite.is-working svg,
  .furnace-sprite.is-waiting svg {
    animation: none;
  }
}
</style>
