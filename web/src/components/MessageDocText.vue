<template>
  <span class="message-doc-text">
    <template v-for="(part, i) in parts" :key="i">
      <template v-if="part.type === 'text'">{{ part.value }}</template>
      <button
        v-else
        type="button"
        class="message-doc-link docs-path-link"
        :title="part.value"
        @click.stop="onDoc(part)"
      >
        {{ part.value }}
      </button>
    </template>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { splitMessageDocLinks } from '../composables/messageDocLinks.js'

const props = defineProps({
  text: { type: String, default: '' },
  sessionId: { type: String, default: '' },
})

const emit = defineEmits(['open-doc'])

const parts = computed(() => splitMessageDocLinks(props.text))

function onDoc(part) {
  emit('open-doc', { file: part.file || part.value, path: part.value })
}
</script>

<style scoped>
.message-doc-link {
  font: inherit;
  color: var(--el-color-primary);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
