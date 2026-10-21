<template>
  <aside class="furnace-tui-rail" :class="{ 'is-open': open }">
    <button
      type="button"
      class="furnace-tui-toggle"
      :aria-expanded="open"
      aria-controls="furnace-tui-drawer"
      :title="furnaceTuiHistoryTitle(open)"
      @click="$emit('update:open', !open)"
    >
      {{ open ? '›' : '‹' }}
    </button>
    <div
      v-show="open"
      id="furnace-tui-drawer"
      ref="tuiHistEl"
      class="furnace-tui-drawer"
      @scroll.passive="onTuiHistScroll"
    >
      <div class="furnace-tui-drawer-head">{{ furnaceTuiDrawerHead() }}</div>
      <p v-if="!chatTurns.length" class="furnace-tui-drawer-empty">{{ furnaceTuiDrawerEmpty() }}</p>
      <div
        v-for="turn in chatTurns"
        :key="`tui-${turn.id}`"
        class="furnace-tui-line"
        :class="turn.role === 'user' ? 'is-user' : 'is-assistant'"
      >
        <span>{{ turn.role === 'user' ? furnaceRoleYouLabel() : agentLabel }}</span>
        <button type="button" class="furnace-tui-copy" @click="$emit('copy-turn', turn)">
          {{ furnaceTuiCopyTurnLabel() }}
        </button>
        <pre>{{ turn.role === 'assistant' ? turnBody(turn) : turn.text }}</pre>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import { getFurnaceTurnMeta } from '../../composables/furnaceTurnMeta.js'
import {
  furnaceRoleYouLabel,
  furnaceTuiCopyTurnLabel,
  furnaceTuiDrawerEmpty,
  furnaceTuiDrawerHead,
  furnaceTuiHistoryTitle,
} from '../../composables/furnaceWorkspaceCopy.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  chatTurns: { type: Array, default: () => [] },
  agentLabel: { type: String, default: '' },
})

defineEmits(['update:open', 'copy-turn'])

const tuiHistEl = ref(null)
const tuiHistStick = ref(true)

function turnBody(turn) {
  return getFurnaceTurnMeta(turn?.text).body || turn?.text || ''
}

function onTuiHistScroll() {
  const el = tuiHistEl.value
  if (!el) return
  tuiHistStick.value = el.scrollHeight - el.scrollTop - el.clientHeight < 64
}

function scrollTuiHist() {
  const el = tuiHistEl.value
  if (!el || !tuiHistStick.value) return
  el.scrollTop = el.scrollHeight
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) tuiHistStick.value = true
    nextTick(() => {
      window.dispatchEvent(new Event('resize'))
      if (isOpen) scrollTuiHist()
    })
  },
)

watch(
  () => props.chatTurns,
  () => {
    if (!props.open) return
    nextTick(scrollTuiHist)
  },
  { deep: true },
)
</script>

<style scoped>
.furnace-tui-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  padding: 0;
  color: #c5c9d3;
  background: #1f232c;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  user-select: none;
}

.furnace-tui-toggle:hover {
  color: #fff;
  background: #2a303c;
}

.furnace-tui-drawer {
  scrollbar-gutter: stable;
  scrollbar-width: auto;
  scrollbar-color: rgba(255, 255, 255, 0.38) rgba(255, 255, 255, 0.06);
  padding: 10px 12px 12px;
  background: #12141a;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  color: #d6d8de;
}

.furnace-tui-drawer::-webkit-scrollbar {
  width: 10px;
}

.furnace-tui-drawer::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.32);
  border-radius: 8px;
}

.furnace-tui-drawer-head {
  position: sticky;
  top: 0;
  z-index: 1;
  margin: -10px -12px 10px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #e8eaef;
  background: #12141a;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.furnace-tui-drawer-empty {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #8b90a0;
}

.furnace-tui-line {
  position: relative;
  margin: 0 0 10px;
}

.furnace-tui-line span {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  color: #8b90a0;
}

.furnace-tui-line pre {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: inherit;
  font-size: 12px;
  line-height: 1.45;
}

.furnace-tui-line.is-user pre {
  color: #9ec5ff;
}

.furnace-tui-line.is-assistant pre {
  color: #d6d8de;
}

.furnace-tui-copy {
  position: absolute;
  top: 0;
  right: 0;
  border: none;
  background: transparent;
  color: #007aff;
  font-size: 11px;
  cursor: pointer;
  padding: 0 6px;
  opacity: 0.85;
}

.furnace-tui-copy:hover {
  text-decoration: underline;
}
</style>
