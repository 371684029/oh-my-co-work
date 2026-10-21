<template>
  <svg
    class="acw-icon"
    :class="[`acw-icon--${name}`, sizeClass]"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <path
      v-if="name === 'folder'"
      d="M4 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linejoin="round"
    />
    <path
      v-else-if="name === 'users'"
      d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 19a5 5 0 0 1 10 0M14 19a4 4 0 0 1 7 0"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
    />
    <path
      v-else-if="name === 'bell'"
      d="M12 4a4 4 0 0 0-4 4v2.5c0 .8-.3 1.6-.8 2.2L5.5 15h13l-1.7-2.3c-.5-.6-.8-1.4-.8-2.2V8a4 4 0 0 0-4-4zm0 14a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2z"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linejoin="round"
    />
    <path
      v-else-if="name === 'fullscreen'"
      d="M8 4H6v2M18 4h-2v2M8 20H6v-2M18 20h-2v-2M4 8V6h2M20 8V6h-2M4 16v2h2M20 16v2h-2"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
    />
    <path
      v-else-if="name === 'fullscreen-exit'"
      d="M8 4v4H4M16 4v4h4M8 20v-4H4M16 20v-4h4"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      v-else-if="name === 'file'"
      d="M8 4h6l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linejoin="round"
    />
    <path
      v-else-if="name === 'clock'"
      d="M12 8v4l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
    />
    <path
      v-else-if="name === 'grid'"
      d="M4 5h6v6H4V5zm10 0h6v6h-6V5zM4 13h6v6H4v-6zm10 0h6v6h-6v-6z"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: {
    type: String,
    required: true,
    validator: (v) =>
      ['folder', 'users', 'bell', 'fullscreen', 'fullscreen-exit', 'file', 'clock', 'grid'].includes(
        v,
      ),
  },
  size: { type: [Number, String], default: 16 },
})

const sizeClass = computed(() => {
  const n = Number(props.size)
  return Number.isFinite(n) && n >= 20 ? 'is-lg' : ''
})
</script>

<style scoped>
.acw-icon {
  display: inline-block;
  vertical-align: -0.15em;
  flex-shrink: 0;
  color: currentColor;
}
</style>
