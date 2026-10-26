<template>
  <div class="furnace-tui">
    <div class="furnace-tui-stage">
      <TerminalView
        :key="terminal.id"
        :terminal="terminal"
        :prefs="prefs"
        paste-context="furnace"
        :session-id="sessionId"
        :active="active"
        @input="$emit('input', $event)"
        @resize="$emit('resize', $event)"
        @gap="$emit('gap', $event)"
        @focus-change="$emit('focus-change', $event)"
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
import TerminalView from './TerminalView.vue'
import FurnaceTuiDrawer from './FurnaceTuiDrawer.vue'

defineProps({
  terminal: { type: Object, required: true },
  prefs: { type: Object, default: () => ({}) },
  sessionId: { type: String, default: '' },
  active: { type: Boolean, default: false },
  chatTurns: { type: Array, default: () => [] },
  agentLabel: { type: String, default: '' },
  historyOpen: { type: Boolean, default: false },
})
defineEmits(['input', 'resize', 'gap', 'focus-change', 'copy-turn', 'update:history-open'])
</script>
