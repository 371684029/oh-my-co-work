<template>
  <Teleport to="body" :disabled="!isPagefill">
    <section
      ref="workspaceRoot"
      class="furnace-workspace"
      :class="{ 'is-pagefill': isPagefill, 'is-chat': surface === 'chat' }"
    >
      <FurnaceWorkspaceHead
        :surface="surface"
        :active-agent="activeAgent"
        :gui-enabled="guiEnabled"
        :status-text="statusText"
        :cli-banner="cliBanner"
        :is-pagefill="isPagefill"
        :is-fullscreen="isFullscreen"
        :is-running="isRunning"
        :is-chat-surface="surface === 'chat'"
        @close="$emit('close')"
        @close-furnace="$emit('close-furnace')"
        @reopen="emit('reopen', $event)"
        @select-agent="setActiveAgent"
        @update:surface="surface = $event"
        @toggle-pagefill="togglePagefill"
        @toggle-fullscreen="toggleTerminalFullscreen"
      />

      <div v-show="surface === 'chat'" class="furnace-chat">
        <div ref="logEl" class="furnace-log" @scroll.passive="onLogScroll">
          <FurnaceBuddyPanel
            :mood="buddyMood"
            :live="isRunning"
            :title="buddyTitle"
            :buddy-line="buddyLine"
          />
          <FurnaceChatThread
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
            :chat-turns="chatTurns"
            :awaiting-reply="awaitingReply"
            @view-tui="surface = 'tui'"
            @reopen="emit('reopen', $event)"
            @close="$emit('close')"
            @send-chip="sendChip"
            @copy-turn="copyTurn"
          />
        </div>
        <button
          v-if="!stickBottom && chatTurns.length"
          type="button"
          class="furnace-jump-latest"
          @click="jumpToLatest"
        >
          {{ furnaceJumpLatestLabel() }}
        </button>
        <FurnaceChatComposer
          ref="chatComposerRef"
          v-model="draft"
          :pending-files="pendingFiles"
          :uploading="uploading"
          :upload-error="uploadError"
          :is-running="isRunning"
          :session-id="sessionId"
          :show-input-tips="showInputTips"
          :can-send="canSend"
          @submit="sendChat"
          @file-input-change="onFileInputChange"
          @drop="onDrop"
          @paste="onPaste"
          @composer-keydown="onComposerKey"
          @remove-pending="removePending"
          @pick-files="pickFiles"
          @dismiss-tips="dismissFurnaceTips"
        />
      </div>

      <FurnaceTuiSurface
        v-if="tuiEverShown"
        v-show="surface === 'tui'"
        :terminal="terminal"
        :prefs="prefs"
        :session-id="sessionId"
        :active="surface === 'tui'"
        :chat-turns="chatTurns"
        :agent-label="agentLabel"
        :history-open="tuiHistoryOpen"
        @input="$emit('input', $event)"
        @resize="$emit('resize', $event)"
        @gap="$emit('gap', $event)"
        @focus-change="onFocusChange"
        @update:history-open="tuiHistoryOpen = $event"
        @copy-turn="copyTurn"
      />

      <footer class="furnace-foot">
        <span>{{ furnaceStatusBarLine(isPagefill, surface) }}</span>
        <span v-if="terminal.cwd" class="furnace-cwd" :title="terminal.cwd">{{ terminal.cwd }}</span>
        <span>{{ footerHint }}</span>
      </footer>
    </section>
  </Teleport>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch, computed } from 'vue'
import './furnaceLayout.css'
import FurnaceWorkspaceHead from './FurnaceWorkspaceHead.vue'
import FurnaceBuddyPanel from './FurnaceBuddyPanel.vue'
import FurnaceChatThread from './FurnaceChatThread.vue'
import FurnaceChatComposer from './FurnaceChatComposer.vue'
import FurnaceTuiSurface from './FurnaceTuiSurface.vue'
import { usePagefill } from '../../composables/pagefill'
import { useFurnaceWorkspace } from '../../composables/useFurnaceWorkspace'
import { inferFurnaceAgent } from '@acw/shared'
import { writeClipboardText } from '../../composables/terminalClipboardBridge.js'
import { furnaceAgentDisplayLabel } from './furnaceWorkspaceUi.js'
import {
  furnaceJumpLatestLabel,
  furnaceStatusBarLine,
} from '../../composables/furnaceWorkspaceCopy.js'
import { createFurnaceTurnCopyActions } from './composables/furnaceTurnCopy.js'
import { createFurnaceAgentHotkeys } from './composables/furnaceAgentHotkeys.js'

const { copyTurn } = createFurnaceTurnCopyActions({ writeClipboardText })
const props = defineProps({
  terminal: { type: Object, required: true },
  terminals: { type: Array, default: () => [] },
  connectionStatus: { type: String, default: 'open' },
  prefs: { type: Object, default: () => ({}) },
  defaultPagefill: { type: Boolean, default: true },
  defaultSurface: { type: String, default: 'tui' },
  sessionId: { type: String, default: '' },
})
const emit = defineEmits(['close', 'kill', 'close-furnace', 'reopen', 'ensure-agent', 'input', 'resize', 'select', 'download-log', 'gap'])
const workspaceRoot = ref(null)
const logEl = ref(null)
const chatComposerRef = ref(null)
const fileInput = computed(() => chatComposerRef.value?.fileInput)
const composerEl = computed(() => chatComposerRef.value?.composerEl)
/** 4.8：默认隐藏 GUI 入口，熔炉只走双 Agent TUI */
const guiEnabled = false
const surface = ref(guiEnabled && props.defaultSurface === 'chat' ? 'chat' : 'tui')
const activeAgent = ref(inferFurnaceAgent(props.terminal))
watch(
  () => props.terminal?.furnaceAgent ?? props.terminal?.id,
  () => {
    activeAgent.value = inferFurnaceAgent(props.terminal)
  },
)
const agentLabel = computed(() => furnaceAgentDisplayLabel(activeAgent.value))
const tuiHistoryOpen = ref(false)

const {
  isFullscreen,
  isPagefill,
  focused,
  toggleFullscreen: toggleTerminalFullscreen,
  togglePagefill,
  setFocused,
} = usePagefill(workspaceRoot, {
  initialFocused: false,
  initialPagefill: props.defaultPagefill !== false,
  onBeforeEscape: (_ev) => {
    if (surface.value === 'chat' && document.activeElement?.tagName === 'TEXTAREA') {
      document.activeElement.blur()
      return true
    }
    if (surface.value === 'tui' && tuiHistoryOpen.value) {
      tuiHistoryOpen.value = false
      return true
    }
    return false
  },
})

function onFocusChange(value) {
  setFocused(value)
}
const {
  tuiEverShown,
  draft,
  chatTurns,
  pendingFiles,
  uploading,
  uploadError,
  stickBottom,
  isRunning,
  statusText,
  footerHint,
  buddyMood,
  buddyTitle,
  buddyLine,
  welcomeKicker,
  welcomeTitle,
  agentBrand,
  failHint,
  showFail,
  showWelcome,
  awaitingReply,
  canSend,
  quickChips,
  onFileInputChange,
  removePending,
  sendChat,
  sendChip,
  jumpToLatest,
  onLogScroll,
  onDrop,
  onPaste,
  onComposerKey,
  pickFiles,
  showInputTips,
  dismissFurnaceTips,
  cliBanner,
} = useFurnaceWorkspace(props, emit, {
  surface,
  focused,
  isPagefill,
  logEl,
  fileInput,
  composerEl,
})

function setActiveAgent(kind) {
  const next = kind === 'cursor' ? 'cursor' : 'grok'
  activeAgent.value = next
  emit('ensure-agent', next)
}

watch(
  () => props.terminal?.id,
  () => {
    activeAgent.value = inferFurnaceAgent(props.terminal)
  },
)

const { onKeyDown } = createFurnaceAgentHotkeys({ workspaceRoot, setActiveAgent })

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeyDown)
  }
})
</script>

<style scoped>
.furnace-workspace {
  margin: 0 8px 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 18px;
  background: #f4f6f9;
  box-shadow: 0 18px 50px rgba(15, 18, 25, 0.12);
}

.furnace-workspace:fullscreen,
.furnace-workspace.is-pagefill {
  width: 100vw;
  height: 100vh;
  margin: 0;
  border: 0;
  border-radius: 0;
}

.furnace-workspace.is-pagefill {
  margin: 0;
}

.furnace-workspace:not(.is-chat) {
  background: #17191f;
}

.furnace-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
}

.furnace-workspace:not(.is-chat) .furnace-foot {
  background: linear-gradient(180deg, #23262e, #1e2128);
  color: #cfd4de;
  border-color: rgba(255, 255, 255, 0.07);
}

.furnace-log {
  scrollbar-gutter: stable;
  scrollbar-width: auto;
  scrollbar-color: rgba(60, 60, 67, 0.55) rgba(0, 0, 0, 0.06);
  padding: 16px 3% 12px;
}

.furnace-log::-webkit-scrollbar {
  width: 10px;
}

.furnace-log::-webkit-scrollbar-thumb {
  background: rgba(60, 60, 67, 0.38);
  border-radius: 8px;
}

.furnace-log::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.04);
}

.furnace-jump-latest {
  position: absolute;
  right: calc(3% + 12px);
  bottom: 118px;
  z-index: 3;
  border: 0;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  background: rgba(29, 29, 31, 0.82);
  color: #fff;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
}

.furnace-foot {
  justify-content: space-between;
  color: #6e6e73;
  font-size: 11px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.furnace-cwd {
  max-width: 40vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, Consolas, monospace;
}

@media (max-width: 820px) {
  .furnace-log {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
