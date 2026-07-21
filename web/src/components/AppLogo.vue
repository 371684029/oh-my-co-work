<template>
  <span class="app-logo" :class="[`is-${size}`, { glow }]" :title="title" role="img" :aria-label="title">
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient :id="gid('bg')" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#6bb6ff" />
          <stop offset="55%" stop-color="#409eff" />
          <stop offset="100%" stop-color="#1a6bb8" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" :fill="`url(#${gid('bg')})`" />
      <path
        d="M18 22c8-10 20-10 28 0"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        stroke-width="1.6"
        stroke-linecap="round"
      />
      <path
        d="M16 44c10 8 22 8 32 0"
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        stroke-width="1.4"
        stroke-linecap="round"
      />
      <!-- 人 -->
      <circle cx="20" cy="26" r="5.2" fill="#fff" />
      <path d="M11.5 42.5c0-5.6 3.6-8.8 8.5-8.8s8.5 3.2 8.5 8.8" fill="#fff" />
      <!-- 机 -->
      <rect x="38" y="21.5" width="14.5" height="12.5" rx="4" fill="#fff" />
      <circle cx="42.4" cy="27" r="1.35" fill="#409eff" />
      <circle cx="48.1" cy="27" r="1.35" fill="#409eff" />
      <path d="M38.8 40.5c0-3.8 2.6-5.8 6.4-5.8 3.9 0 6.5 2 6.5 5.8" fill="#fff" opacity="0.92" />
      <!-- 文档 / 协同办公 -->
      <g transform="translate(28 33) rotate(-12)">
        <rect x="-6" y="-7" width="12.5" height="15" rx="2.2" fill="#fff" stroke="#2b7cd3" stroke-width="1.1" />
        <line x1="-3.2" y1="-2.5" x2="3.5" y2="-2.5" stroke="#79bbff" stroke-width="1.2" stroke-linecap="round" />
        <line x1="-3.2" y1="0.8" x2="2.2" y2="0.8" stroke="#a0cfff" stroke-width="1.2" stroke-linecap="round" />
        <line x1="-3.2" y1="4" x2="3" y2="4" stroke="#a0cfff" stroke-width="1.2" stroke-linecap="round" />
        <path
          d="M1.2 5.8l1.4 1.4 3-3.2"
          fill="none"
          stroke="#409eff"
          stroke-width="1.3"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </g>
    </svg>
  </span>
</template>

<script setup>
defineProps({
  size: { type: String, default: 'md' },
  glow: { type: Boolean, default: true },
  title: { type: String, default: 'apple-co-work · 人机协同' },
})

const uid = Math.random().toString(36).slice(2, 8)
function gid(name) {
  return `ecw-logo-${name}-${uid}`
}
</script>

<style scoped>
.app-logo {
  display: inline-flex;
  flex-shrink: 0;
  line-height: 0;
  border-radius: 22%;
}
.app-logo svg {
  width: 100%;
  height: 100%;
  display: block;
  border-radius: inherit;
}
.app-logo.is-sm {
  width: 28px;
  height: 28px;
}
.app-logo.is-md {
  width: 36px;
  height: 36px;
}
.app-logo.is-lg {
  width: 48px;
  height: 48px;
}
.app-logo.is-xl {
  width: 72px;
  height: 72px;
}
.app-logo.glow {
  box-shadow:
    0 0 0 3px rgba(64, 158, 255, 0.14),
    0 8px 18px rgba(64, 158, 255, 0.32);
}
</style>
