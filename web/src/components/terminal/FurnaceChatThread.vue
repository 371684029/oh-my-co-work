<template>
  <div class="furnace-thread">
    <FurnaceChatWelcome
      :show-fail="showFail"
      :show-welcome="showWelcome"
      :welcome-kicker="welcomeKicker"
      :welcome-title="welcomeTitle"
      :agent-label="agentLabel"
      :active-agent="activeAgent"
      :agent-brand="agentBrand"
      :fail-hint="failHint"
      :quick-chips="quickChips"
      :is-running="isRunning"
      @view-tui="$emit('view-tui')"
      @reopen="$emit('reopen', { agent: activeAgent })"
      @close="$emit('close')"
      @send-chip="$emit('send-chip', $event)"
    />
    <FurnaceChatTurns
      :chat-turns="chatTurns"
      :agent-label="agentLabel"
      :awaiting-reply="awaitingReply"
      @copy-turn="$emit('copy-turn', $event)"
    />
  </div>
</template>

<script setup>
import FurnaceChatWelcome from './FurnaceChatWelcome.vue'
import FurnaceChatTurns from './FurnaceChatTurns.vue'

defineProps({
  showFail: { type: Boolean, default: false },
  showWelcome: { type: Boolean, default: false },
  welcomeKicker: { type: String, default: '' },
  welcomeTitle: { type: String, default: '' },
  agentLabel: { type: String, default: '' },
  activeAgent: { type: String, default: '' },
  agentBrand: { type: String, default: '' },
  failHint: { type: String, default: '' },
  quickChips: { type: Array, default: () => [] },
  isRunning: { type: Boolean, default: false },
  chatTurns: { type: Array, default: () => [] },
  awaitingReply: { type: Boolean, default: false },
})
defineEmits(['view-tui', 'reopen', 'close', 'send-chip', 'copy-turn'])
</script>

<style scoped>
.furnace-thread {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 4px;
}
</style>
