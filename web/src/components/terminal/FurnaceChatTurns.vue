<template>
  <div class="furnace-chat-turns">
  <div
    v-for="turn in chatTurns"
    :key="turn.id"
    class="furnace-turn"
    :class="turn.role === 'user' ? 'is-user' : 'is-assistant'"
  >
    <span class="furnace-turn-label">{{ turn.role === 'user' ? furnaceRoleYouLabel() : agentLabel }}</span>
    <button
      type="button"
      class="furnace-turn-copy"
      :title="furnaceTurnCopyTitle()"
      @click="$emit('copy-turn', turn)"
    >
      {{ furnaceTuiCopyTurnLabel() }}
    </button>
    <div class="furnace-bubble">
      <template v-if="turn.role === 'assistant'">
        <div v-if="meta(turn).time || meta(turn).thought" class="furnace-meta-row is-top">
          <span v-if="meta(turn).time" class="furnace-chip-time" :title="furnaceTurnTimeTitle()">
            <svg class="furnace-chip-icon" viewBox="0 0 16 16" width="11" height="11" fill="currentColor">
              <path
                d="M8 0a8 8 0 1 0 8 8A8 8 0 0 0 8 0zm0 14.5a6.5 6.5 0 1 1 6.5-6.5 6.5 6.5 0 0 1-6.5 6.5zM7.25 4v4.25l3.25 1.95.75-1.23-2.5-1.47V4z"
              />
            </svg>
            {{ meta(turn).time }}
          </span>
          <span v-if="meta(turn).thought" class="furnace-chip-thought" :title="furnaceTurnThinkingTitle()">
            <span class="furnace-chip-sparkle">✦</span>
            {{ meta(turn).thought }}
          </span>
        </div>
        <div v-if="meta(turn).body" class="furnace-bubble-text">{{ meta(turn).body }}</div>
        <div v-if="meta(turn).worked" class="furnace-meta-row is-bottom">
          <span class="furnace-chip-worked" :title="furnaceTurnDurationTitle()">
            <svg class="furnace-chip-icon" viewBox="0 0 16 16" width="11" height="11" fill="currentColor">
              <path
                d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"
              />
            </svg>
            {{ meta(turn).worked }}
          </span>
        </div>
      </template>
      <template v-else>
        <div class="furnace-bubble-text">{{ turn.text }}</div>
      </template>
    </div>
  </div>
  <div v-if="awaitingReply" class="furnace-turn is-assistant is-pending">
    <span class="furnace-turn-label">{{ agentLabel }}</span>
    <div class="furnace-bubble is-pending">{{ furnaceChatPendingLabel() }}</div>
  </div>
  </div>
</template>

<script setup>
import { getFurnaceTurnMeta } from '../../composables/furnaceTurnMeta.js'
import {
  furnaceChatPendingLabel,
  furnaceRoleYouLabel,
  furnaceTurnCopyTitle,
  furnaceTurnDurationTitle,
  furnaceTurnThinkingTitle,
  furnaceTurnTimeTitle,
  furnaceTuiCopyTurnLabel,
} from '../../composables/furnaceWorkspaceCopy.js'

defineProps({
  chatTurns: { type: Array, default: () => [] },
  agentLabel: { type: String, default: '' },
  awaitingReply: { type: Boolean, default: false },
})

defineEmits(['copy-turn'])

function meta(turn) {
  return getFurnaceTurnMeta(turn?.text)
}
</script>

<style scoped>
.furnace-turn {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.furnace-turn.is-user {
  align-items: flex-end;
}

.furnace-turn.is-assistant {
  align-items: flex-start;
}

.furnace-turn-copy {
  align-self: flex-end;
  border: none;
  background: transparent;
  color: #007aff;
  font-size: 11px;
  cursor: pointer;
  padding: 0 6px;
  opacity: 0.85;
}

.furnace-turn-copy:hover {
  text-decoration: underline;
}

.furnace-turn-label {
  font-size: 11px;
  font-weight: 650;
  color: #6e6e73;
  padding: 0 6px;
}

.furnace-bubble {
  max-width: min(56rem, 88%);
  margin: 0;
  padding: 10px 14px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  font-size: 14px;
  line-height: 1.55;
  color: #1d1d1f;
}

.furnace-turn.is-user .furnace-bubble {
  background: #007aff;
  color: #fff;
}

.furnace-bubble.is-pending {
  color: #6e6e73;
  font-style: italic;
}

.furnace-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 11px;
  color: #6e6e73;
}

.furnace-meta-row.is-bottom {
  margin-bottom: 0;
  margin-top: 8px;
}

.furnace-chip-time,
.furnace-chip-thought,
.furnace-chip-worked {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.furnace-chip-sparkle {
  color: #bf5af2;
}

.furnace-bubble-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
