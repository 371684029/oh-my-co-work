<template>
  <div class="furnace-tui">
    <div class="furnace-tui-stage">
      <TerminalView
        v-for="item in tuiTerminals"
        v-show="item.id === terminal.id"
        :key="item.id"
        :terminal="item"
        :prefs="prefs"
        paste-context="furnace"
        :session-id="sessionId"
        :active="active && item.id === terminal.id"
        @input="item.id === terminal.id && $emit('input', $event)"
        @resize="item.id === terminal.id && $emit('resize', $event)"
        @gap="item.id === terminal.id && $emit('gap', $event)"
        @focus-change="item.id === terminal.id && $emit('focus-change', $event)"
      />
    </div>
    <FurnaceTuiDrawer
      :open="historyOpen"
      :chat-turns="chatTurns"
      :agent-label="agentLabel"
      @update:open="$emit('update:history-open', $event)"
      @copy-turn="$emit('copy-turn', $event)"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import TerminalView from './TerminalView.vue'
import FurnaceTuiDrawer from './FurnaceTuiDrawer.vue'

const props = defineProps({
  terminal: { type: Object, required: true },
  terminals: { type: Array, default: () => [] },
  prefs: { type: Object, default: () => ({}) },
  sessionId: { type: String, default: '' },
  active: { type: Boolean, default: false },
  chatTurns: { type: Array, default: () => [] },
  agentLabel: { type: String, default: '' },
  historyOpen: { type: Boolean, default: false },
})
const tuiTerminals = computed(() => {
  const list = Array.isArray(props.terminals) ? props.terminals.filter((t) => t?.id) : []
  if (!list.some((t) => t.id === props.terminal?.id) && props.terminal?.id) {
    return [...list, props.terminal]
  }
  return list
})
defineEmits(['input', 'resize', 'gap', 'focus-change', 'copy-turn', 'update:history-open'])
</script>
