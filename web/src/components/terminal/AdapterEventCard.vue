<template>
  <article class="adapter-event-card" :class="cardClass">
    <header class="adapter-event-head">
      <div class="adapter-event-title">
        <span class="adapter-event-dot" aria-hidden="true" />
        <span class="adapter-event-kind">{{ kindLabel }}</span>
        <strong>{{ title }}</strong>
      </div>
      <span class="adapter-event-status">{{ statusLabel }}</span>
    </header>

    <p v-if="pathText" class="adapter-event-path" :title="pathText">{{ pathText }}</p>
    <p v-if="summary" class="adapter-event-summary">{{ summary }}</p>
    <ul v-if="files.length" class="adapter-event-files">
      <li v-for="file in files" :key="file">{{ file }}</li>
    </ul>

    <footer v-if="terminalId" class="adapter-event-foot">
      <button type="button" class="adapter-event-action" @click="$emit('open', terminalId)">
        进入终端
      </button>
    </footer>
  </article>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  event: { type: Object, required: true },
})

defineEmits(['open'])

const content = computed(() => props.event?.content || {})
const isResult = computed(() => props.event?.type === 'adapter_result')
const phase = computed(() => (isResult.value ? 'result' : content.value.phase || 'start'))
const ok = computed(() => content.value.ok !== false)
const title = computed(
  () => content.value.name || content.value.toolId || (isResult.value ? '结果' : '工具'),
)
const pathText = computed(() => content.value.path || '')
const summary = computed(() => {
  if (content.value.summary) return content.value.summary
  if (isResult.value) return content.value.text || ''
  return ''
})
const files = computed(() =>
  Array.isArray(content.value.files) ? content.value.files.filter(Boolean) : [],
)
const terminalId = computed(() => content.value.terminalId || '')

const kindLabel = computed(() => (isResult.value ? '结果' : '工具'))
const statusLabel = computed(() => {
  if (isResult.value) return '已写入'
  if (phase.value === 'start') return '调用中'
  return ok.value ? '已完成' : '失败'
})
const cardClass = computed(() => {
  if (isResult.value) return 'is-result'
  if (phase.value === 'start') return 'is-running'
  return ok.value ? 'is-ok' : 'is-fail'
})
</script>

<style scoped>
.adapter-event-card {
  width: min(640px, 100%);
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 16px;
  background: linear-gradient(160deg, #ffffff 0%, #f4f6fa 100%);
  color: var(--ecw-text-1, #1d1d1f);
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
}

.adapter-event-head,
.adapter-event-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
}

.adapter-event-head {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.adapter-event-title {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.adapter-event-title strong {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.adapter-event-kind,
.adapter-event-status {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 10.5px;
  color: var(--ecw-text-2, #6e6e73);
  background: rgba(0, 0, 0, 0.05);
}

.adapter-event-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #8e8e93;
}

.adapter-event-card.is-running .adapter-event-dot {
  background: #007aff;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.14);
}

.adapter-event-card.is-ok .adapter-event-dot,
.adapter-event-card.is-result .adapter-event-dot {
  background: #34c759;
}

.adapter-event-card.is-fail {
  border-color: rgba(255, 59, 48, 0.28);
}

.adapter-event-card.is-fail .adapter-event-dot {
  background: #ff3b30;
}

.adapter-event-path,
.adapter-event-summary {
  margin: 0;
  padding: 8px 12px 0;
  color: var(--ecw-text-2, #6e6e73);
  font-size: 12px;
  line-height: 1.45;
  word-break: break-all;
}

.adapter-event-path {
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
}

.adapter-event-files {
  margin: 8px 12px 0;
  padding: 0 0 0 18px;
  color: var(--ecw-text-1, #1d1d1f);
  font-size: 12px;
}

.adapter-event-foot {
  padding-top: 8px;
  padding-bottom: 10px;
}

.adapter-event-action {
  border: 0;
  border-radius: 9px;
  padding: 6px 10px;
  background: rgba(0, 122, 255, 0.1);
  color: #007aff;
  font-size: 12px;
  cursor: pointer;
}

.adapter-event-action:hover {
  background: rgba(0, 122, 255, 0.16);
}
</style>
