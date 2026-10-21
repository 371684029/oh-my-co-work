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
          <aside class="furnace-buddy">
            <FurnaceAvatar size="lg" :mood="buddyMood" :live="isRunning" :title="buddyTitle" />
            <p class="furnace-buddy-credit" :title="PET_COPYRIGHT">{{ PET_CREDIT_SHORT }}</p>
            <p class="furnace-buddy-line">{{ buddyLine }}</p>
          </aside>
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
              @view-tui="surface = 'tui'"
              @reopen="emit('reopen', { agent: activeAgent })"
              @close="$emit('close')"
              @send-chip="sendChip"
            />
            <FurnaceChatTurns
              :chat-turns="chatTurns"
              :agent-label="agentLabel"
              :awaiting-reply="awaitingReply"
              @copy-turn="copyTurn"
            />
          </div>
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

      <div
        v-if="tuiEverShown"
        v-show="surface === 'tui'"
        class="furnace-tui"
      >
        <div class="furnace-tui-stage">
          <TerminalView
            :key="terminal.id"
            :terminal="terminal"
            :prefs="prefs"
            paste-context="furnace"
            :session-id="sessionId"
            :active="surface === 'tui'"
            @input="$emit('input', $event)"
            @resize="$emit('resize', $event)"
            @gap="$emit('gap', $event)"
            @focus-change="onFocusChange"
          />
        </div>
        <FurnaceTuiDrawer
          v-model:open="tuiHistoryOpen"
          :chat-turns="chatTurns"
          :agent-label="agentLabel"
          @copy-turn="copyTurn"
        />
      </div>

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
import { ElMessage } from 'element-plus'
import './furnaceLayout.css'
import FurnaceAvatar from '../FurnaceAvatar.vue'
import TerminalView from './TerminalView.vue'
import FurnaceChatWelcome from './FurnaceChatWelcome.vue'
import FurnaceWorkspaceHead from './FurnaceWorkspaceHead.vue'
import FurnaceTuiDrawer from './FurnaceTuiDrawer.vue'
import FurnaceChatTurns from './FurnaceChatTurns.vue'
import FurnaceChatComposer from './FurnaceChatComposer.vue'
import { PET_COPYRIGHT, PET_CREDIT_SHORT } from '../../composables/furnacePetAtlas.js'
import { usePagefill } from '../../composables/pagefill'
import { useFurnaceWorkspace } from '../../composables/useFurnaceWorkspace'
import { inferFurnaceAgent, furnaceTurnCopyPlain } from '@acw/shared'
import { writeClipboardText } from '../../composables/terminalClipboardBridge.js'
import {
  furnaceAgentDisplayLabel,
  furnaceAgentFromHotkey,
  isEventWithinFurnaceRoot,
  shouldIgnoreFurnaceHotkeyTarget,
} from './furnaceWorkspaceUi.js'
import {
  furnaceJumpLatestLabel,
  furnaceStatusBarLine,
  furnaceTurnCopyEmptyMessage,
  furnaceTurnCopyFailedMessage,
  furnaceTurnCopySuccessMessage,
} from '../../composables/furnaceWorkspaceCopy.js'

async function copyTurn(turn) {
  const text = furnaceTurnCopyPlain(turn?.role, turn?.text)
  if (!text) {
    ElMessage.warning(furnaceTurnCopyEmptyMessage())
    return
  }
  try {
    await writeClipboardText(text)
    ElMessage.success(furnaceTurnCopySuccessMessage())
  } catch {
    ElMessage.warning(furnaceTurnCopyFailedMessage())
  }
}
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

function onKeyDown(e) {
  if (!isEventWithinFurnaceRoot(workspaceRoot.value, e)) return
  if (shouldIgnoreFurnaceHotkeyTarget(e.target)) return
  if (!(e.metaKey || e.ctrlKey)) return
  const agent = furnaceAgentFromHotkey(e.key)
  if (!agent) return
  e.preventDefault()
  setActiveAgent(agent)
}

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

.furnace-btn {
  border: 0;
  border-radius: 9px;
  padding: 7px 10px;
  background: rgba(0, 0, 0, 0.06);
  color: #1d1d1f;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.furnace-workspace:not(.is-chat) .furnace-btn {
  background: rgba(255, 255, 255, 0.07);
  color: #dce0e8;
}

.furnace-btn.on {
  background: #007aff;
  color: #fff;
}

.furnace-btn.danger {
  color: #ff3b30;
}

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

.furnace-buddy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.furnace-buddy-credit {
  margin: 0;
  font-size: 10px;
  line-height: 1.35;
  color: #8e8ea0;
}

.furnace-buddy-line {
  margin: 0;
  max-width: 7.5rem;
  font-size: 11px;
  line-height: 1.45;
  color: #6e6e73;
}

.furnace-thread {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 4px;
}

.furnace-empty {
  color: #6e6e73;
  font-size: 14px;
  line-height: 1.6;
  max-width: 52rem;
  margin: 8vh 0 0;
}

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

.furnace-turn-copy,
.furnace-tui-copy {
  align-self: flex-end;
  border: none;
  background: transparent;
  color: #007aff;
  font-size: 11px;
  cursor: pointer;
  padding: 0 6px;
  opacity: 0.85;
}

.furnace-turn-copy:hover,
.furnace-tui-copy:hover {
  text-decoration: underline;
}

.furnace-tui-line {
  position: relative;
}

.furnace-tui-copy {
  position: absolute;
  top: 0;
  right: 0;
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
  padding: 12px 18px;
  border-radius: 18px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  font-size: 15px;
  line-height: 1.7;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
}

.furnace-turn.is-assistant .furnace-bubble {
  background: #fff;
  color: #1d1d1f;
  border-bottom-left-radius: 6px;
}

.furnace-bubble-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.furnace-meta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.furnace-meta-row.is-top {
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.06);
}

.furnace-meta-row.is-bottom {
  margin-top: 10px;
  padding-top: 6px;
  border-top: 1px dashed rgba(0, 0, 0, 0.06);
}

.furnace-chip-time,
.furnace-chip-thought,
.furnace-chip-worked {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  line-height: 1;
  padding: 3px 8px;
  border-radius: 6px;
  user-select: none;
}

.furnace-chip-time {
  background: rgba(0, 0, 0, 0.04);
  color: #6e6e73;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 500;
}

.furnace-chip-thought {
  background: rgba(94, 92, 230, 0.08);
  color: #5856d6;
  font-weight: 550;
  border: 1px solid rgba(94, 92, 230, 0.16);
}

.furnace-chip-sparkle {
  color: #5e5ce6;
  font-size: 10px;
}

.furnace-chip-worked {
  background: rgba(52, 199, 89, 0.08);
  color: #248a3d;
  font-weight: 550;
  border: 1px solid rgba(52, 199, 89, 0.18);
}

.furnace-chip-icon {
  flex-shrink: 0;
  opacity: 0.75;
}

.furnace-turn.is-user .furnace-bubble {
  background: #007aff;
  color: #fff;
  border-bottom-right-radius: 6px;
  box-shadow: 0 1px 8px rgba(0, 122, 255, 0.22);
}

.furnace-bubble.is-pending {
  color: #6e6e73;
  font-style: italic;
  box-shadow: none;
  background: rgba(255, 255, 255, 0.72);
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

  .furnace-buddy {
    position: static;
    flex-direction: row;
    text-align: left;
    max-width: none;
  }
}
</style>
