<template>
  <Teleport to="body" :disabled="!isPagefill">
    <section
      ref="workspaceRoot"
      class="furnace-workspace"
      :class="{ 'is-pagefill': isPagefill, 'is-chat': surface === 'chat' }"
    >
      <header class="furnace-head">
        <div class="furnace-leading">
          <button
            type="button"
            class="furnace-btn"
            title="关掉这层皮，回到群聊。Grok 进程还在，对话也会继续堆；要清上下文请关熔炉或新开。"
            @click="$emit('close')"
          >
            返回群聊
          </button>
          <span class="furnace-divider" />
          <div class="furnace-identity">
            <strong>熔炉</strong>
            <span class="furnace-state">{{ statusText }}</span>
          </div>
        </div>
        <div class="furnace-actions">
          <button
            type="button"
            class="furnace-btn"
            :class="{ on: surface === 'chat' }"
            title="GUI：可读正文 + 底部输入；模型菜单请用 TUI"
            @click="surface = 'chat'"
          >
            GUI
          </button>
          <button
            type="button"
            class="furnace-btn"
            :class="{ on: surface === 'tui' }"
            title="TUI：原 Grok 终端"
            @click="surface = 'tui'"
          >
            TUI
          </button>
          <button
            type="button"
            class="furnace-btn"
            :title="
              isPagefill
                ? '退出满屏，回到工作台三栏'
                : '满屏：铺满整个页面'
            "
            @click="togglePagefill"
          >
            {{ isPagefill ? '退出满屏' : '满屏' }}
          </button>
          <button
            type="button"
            class="furnace-btn"
            data-fullscreen-control
            :title="isFullscreen ? '退出系统全屏' : '浏览器全屏'"
            @click="toggleTerminalFullscreen"
          >
            {{ isFullscreen ? '退出全屏' : '全屏' }}
          </button>
          <details class="furnace-more">
            <summary class="furnace-btn" title="关掉或新开 Grok 进程；返回群聊只关皮">进程</summary>
            <div class="furnace-more-menu">
              <button type="button" class="furnace-more-item" @click="$emit('reopen')">新开熔炉</button>
              <button
                v-if="isRunning"
                type="button"
                class="furnace-more-item danger"
                @click="$emit('close-furnace')"
              >
                关闭熔炉
              </button>
            </div>
          </details>
        </div>
      </header>

      <div v-show="surface === 'chat'" class="furnace-chat">
        <div ref="logEl" class="furnace-log" @scroll.passive="onLogScroll">
          <aside class="furnace-buddy">
            <FurnaceAvatar size="lg" :mood="buddyMood" :live="isRunning" :title="buddyTitle" />
            <p class="furnace-buddy-credit" :title="PET_COPYRIGHT">{{ PET_CREDIT_SHORT }}</p>
            <p class="furnace-buddy-line">{{ buddyLine }}</p>
          </aside>
          <div class="furnace-thread">
            <div v-if="showFail" class="furnace-welcome is-fail">
              <p class="furnace-welcome-kicker">{{ welcomeKicker }}</p>
              <h3>Grok 没在跑，所以这里是空的</h3>
              <p>{{ failHint }}</p>
              <ul>
                <li>先确认本机终端能直接运行 <code>grok</code>（已安装并在 PATH 里）</li>
                <li>Windows 运行包请关掉窗口后重开，让新 PATH 生效</li>
                <li>聊太长、模型发懵时点「新开熔炉」：杀掉这条 Grok，再开一条空对话</li>
              </ul>
              <div class="furnace-chips">
                <button type="button" class="furnace-chip" @click="surface = 'tui'">看 TUI 报错</button>
                <button type="button" class="furnace-chip" @click="$emit('reopen')">新开熔炉</button>
                <button type="button" class="furnace-chip" @click="$emit('close')">返回群聊</button>
              </div>
            </div>
            <div v-else-if="showWelcome" class="furnace-welcome">
              <p class="furnace-welcome-kicker">{{ welcomeKicker }}</p>
              <h3>本机 Grok 已接进协同台</h3>
              <p>
                同一条进程：这里是对话框，菜单和模型在 TUI。细节在工作目录
                <code>AGENTS.md</code> / <code>ACTIVE.md</code>，不用整段粘贴。聊太长就「新开熔炉」。
              </p>
              <ul>
                <li>问这场群<strong>现在做到哪</strong>、当前格缺什么</li>
                <li>让她<strong>适配</strong>：把当前成员或步骤接到工作台</li>
                <li>过闸时只说<strong>通过或拒绝</strong>，不要改编排</li>
                <li>附件落到 <code>inbox/</code>，发送时写成一行相对路径再回车</li>
              </ul>
              <div class="furnace-chips">
                <button
                  v-for="chip in quickChips"
                  :key="chip"
                  type="button"
                  class="furnace-chip"
                  :disabled="!isRunning"
                  @click="sendChip(chip)"
                >
                  {{ chip }}
                </button>
              </div>
            </div>
            <div
              v-for="turn in chatTurns"
              :key="turn.id"
              class="furnace-turn"
              :class="turn.role === 'user' ? 'is-user' : 'is-assistant'"
            >
              <span class="furnace-turn-label">{{ turn.role === 'user' ? '你' : 'Grok' }}</span>
              <div class="furnace-bubble">
                <template v-if="turn.role === 'assistant'">
                  <div
                    v-if="getTurnMeta(turn.text).time || getTurnMeta(turn.text).thought"
                    class="furnace-meta-row is-top"
                  >
                    <span
                      v-if="getTurnMeta(turn.text).time"
                      class="furnace-chip-time"
                      title="消息时间"
                    >
                      <svg
                        class="furnace-chip-icon"
                        viewBox="0 0 16 16"
                        width="11"
                        height="11"
                        fill="currentColor"
                      >
                        <path
                          d="M8 0a8 8 0 1 0 8 8A8 8 0 0 0 8 0zm0 14.5a6.5 6.5 0 1 1 6.5-6.5 6.5 6.5 0 0 1-6.5 6.5zM7.25 4v4.25l3.25 1.95.75-1.23-2.5-1.47V4z"
                        />
                      </svg>
                      {{ getTurnMeta(turn.text).time }}
                    </span>
                    <span
                      v-if="getTurnMeta(turn.text).thought"
                      class="furnace-chip-thought"
                      title="模型思考时长"
                    >
                      <span class="furnace-chip-sparkle">✦</span>
                      {{ getTurnMeta(turn.text).thought }}
                    </span>
                  </div>

                  <div v-if="getTurnMeta(turn.text).body" class="furnace-bubble-text">
                    {{ getTurnMeta(turn.text).body }}
                  </div>

                  <div
                    v-if="getTurnMeta(turn.text).worked"
                    class="furnace-meta-row is-bottom"
                  >
                    <span
                      class="furnace-chip-worked"
                      title="执行耗时"
                    >
                      <svg
                        class="furnace-chip-icon"
                        viewBox="0 0 16 16"
                        width="11"
                        height="11"
                        fill="currentColor"
                      >
                        <path
                          d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"
                        />
                      </svg>
                      {{ getTurnMeta(turn.text).worked }}
                    </span>
                  </div>
                </template>
                <template v-else>
                  <div class="furnace-bubble-text">{{ turn.text }}</div>
                </template>
              </div>
            </div>
            <div v-if="awaitingReply" class="furnace-turn is-assistant is-pending">
              <span class="furnace-turn-label">Grok</span>
              <div class="furnace-bubble is-pending">正在写…</div>
            </div>
          </div>
        </div>
        <button
          v-if="!stickBottom && chatTurns.length"
          type="button"
          class="furnace-jump-latest"
          @click="jumpToLatest"
        >
          回到最新
        </button>
        <form
          class="furnace-composer"
          @submit.prevent="sendChat"
          @dragover.prevent
          @drop.prevent="onDrop"
        >
          <input
            ref="fileInput"
            type="file"
            multiple
            class="furnace-file-input"
            @change="onFileInputChange"
          />
          <div class="furnace-compose-main">
            <textarea
              ref="composerEl"
              v-model="draft"
              rows="3"
              :disabled="!isRunning"
              placeholder="问进度、适配或过闸… Enter 发送，Shift+Enter 换行"
              @keydown="onComposerKey"
              @paste="onPaste"
            />
            <div v-if="pendingFiles.length" class="furnace-pending">
              <span
                v-for="(f, i) in pendingFiles"
                :key="f.id || f.relPath"
                class="furnace-pending-chip"
              >
                {{ f.name }}
                <button type="button" title="去掉" @click="removePending(i)">×</button>
              </span>
            </div>
            <div class="furnace-compose-bar">
              <button
                type="button"
                class="furnace-btn"
                :disabled="!isRunning || uploading || !sessionId"
                title="文件落到熔炉工作目录 inbox/；发送时把相对路径写成一行写进 grok，不是官方附件通道"
                @click="pickFiles"
              >
                {{ uploading ? '上传中…' : '附件' }}
              </button>
              <span v-if="uploadError" class="furnace-upload-err">{{ uploadError }}</span>
              <span class="furnace-compose-hint">同一条 grok · 菜单请切 TUI · 附件最多 8 个</span>
            </div>
          </div>
          <button type="submit" class="furnace-send" :disabled="!canSend">发送</button>
        </form>
      </div>

      <div v-if="tuiEverShown" v-show="surface === 'tui'" class="furnace-tui">
        <TerminalView
          :key="terminal.id"
          :terminal="terminal"
          :prefs="prefs"
          :active="surface === 'tui'"
          preserve-history
          @input="$emit('input', $event)"
          @resize="$emit('resize', $event)"
          @gap="$emit('gap', $event)"
          @focus-change="onFocusChange"
        />
      </div>

      <footer class="furnace-foot">
        <span>{{ isPagefill ? '满屏' : '三栏中栏' }} · {{ surface === 'chat' ? 'GUI' : 'TUI' }}</span>
        <span v-if="terminal.cwd" class="furnace-cwd" :title="terminal.cwd">{{ terminal.cwd }}</span>
        <span>{{ footerHint }}</span>
      </footer>
    </section>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'
import './furnaceLayout.css'
import FurnaceAvatar from '../FurnaceAvatar.vue'
import TerminalView from './TerminalView.vue'
import { PET_COPYRIGHT, PET_CREDIT_SHORT } from '../../composables/furnacePetAtlas.js'
import { usePagefill } from '../../composables/pagefill'
import { useFurnaceWorkspace } from '../../composables/useFurnaceWorkspace'
import { parseFurnaceTurnText } from '@acw/shared'

const turnMetaCache = new Map()
function getTurnMeta(text) {
  const key = String(text || '')
  if (turnMetaCache.has(key)) return turnMetaCache.get(key)
  const meta = parseFurnaceTurnText(key)
  if (turnMetaCache.size > 200) turnMetaCache.clear()
  turnMetaCache.set(key, meta)
  return meta
}
const props = defineProps({
  terminal: { type: Object, required: true },
  terminals: { type: Array, default: () => [] },
  connectionStatus: { type: String, default: 'open' },
  prefs: { type: Object, default: () => ({}) },
  defaultPagefill: { type: Boolean, default: true },
  defaultSurface: { type: String, default: 'chat' },
  sessionId: { type: String, default: '' },
})
const emit = defineEmits(['close', 'kill', 'close-furnace', 'reopen', 'input', 'resize', 'select', 'download-log', 'gap'])
const workspaceRoot = ref(null)
const logEl = ref(null)
const fileInput = ref(null)
const composerEl = ref(null)
const surface = ref(props.defaultSurface === 'tui' ? 'tui' : 'chat')

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
} = useFurnaceWorkspace(props, emit, {
  surface,
  focused,
  isPagefill,
  logEl,
  fileInput,
  composerEl,
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

.furnace-head,
.furnace-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
}

.furnace-head {
  justify-content: space-between;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.9);
}

.furnace-workspace:not(.is-chat) .furnace-head,
.furnace-workspace:not(.is-chat) .furnace-foot {
  background: linear-gradient(180deg, #23262e, #1e2128);
  color: #cfd4de;
  border-color: rgba(255, 255, 255, 0.07);
}

.furnace-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}

.furnace-leading {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.furnace-identity {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.furnace-state {
  font-size: 11px;
  color: #6e6e73;
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

.furnace-more {
  position: relative;
}

.furnace-more summary {
  list-style: none;
}

.furnace-more summary::-webkit-details-marker {
  display: none;
}

.furnace-more-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 5;
  min-width: 132px;
  padding: 4px;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(20, 16, 28, 0.16);
}

.furnace-workspace:not(.is-chat) .furnace-more-menu {
  background: #2a2d36;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.furnace-more-item {
  display: block;
  width: 100%;
  border: 0;
  border-radius: 8px;
  padding: 7px 10px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.furnace-more-item:hover {
  background: rgba(0, 0, 0, 0.06);
}

.furnace-workspace:not(.is-chat) .furnace-more-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.furnace-more-item.danger {
  color: #ff3b30;
}

.furnace-divider {
  width: 1px;
  height: 16px;
  background: rgba(0, 0, 0, 0.12);
}

.furnace-tui :deep(.xterm-viewport) {
  overflow-y: scroll !important;
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

.furnace-welcome {
  max-width: min(52rem, 100%);
  margin: 0;
  padding: 18px 20px 16px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 1px 10px rgba(0, 0, 0, 0.06);
  color: #1d1d1f;
}

.furnace-welcome.is-fail {
  background: #fff6f6;
  box-shadow: 0 1px 10px rgba(255, 59, 48, 0.08);
}

.furnace-welcome-kicker {
  margin: 0 0 6px;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: #6e6e73;
}

.furnace-welcome h3 {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.furnace-welcome p,
.furnace-welcome li {
  font-size: 14px;
  line-height: 1.65;
  color: #3a3a40;
}

.furnace-welcome p {
  margin: 0 0 10px;
}

.furnace-welcome ul {
  margin: 0 0 14px;
  padding-left: 1.15rem;
}

.furnace-welcome code {
  font-size: 12px;
  padding: 1px 5px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.05);
}

.furnace-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.furnace-chip {
  border: 0;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  background: rgba(0, 122, 255, 0.1);
  color: #007aff;
}

.furnace-chip:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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

.furnace-composer {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  padding: 12px 3% 16px;
  background: rgba(255, 255, 255, 0.92);
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.furnace-file-input {
  display: none;
}

.furnace-compose-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.furnace-composer textarea {
  flex: 1;
  width: 100%;
  resize: none;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 14px;
  padding: 12px 14px;
  font: inherit;
  font-size: 15px;
  min-height: 72px;
  box-sizing: border-box;
}

.furnace-pending {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.furnace-pending-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 16rem;
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
}

.furnace-pending-chip button {
  border: 0;
  background: transparent;
  cursor: pointer;
  color: #6e6e73;
  font-size: 14px;
  line-height: 1;
  padding: 0;
}

.furnace-compose-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.furnace-compose-hint,
.furnace-upload-err {
  font-size: 11px;
  color: #6e6e73;
}

.furnace-upload-err {
  color: #ff3b30;
}

.furnace-send {
  border: 0;
  border-radius: 12px;
  padding: 12px 18px;
  background: #007aff;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.furnace-send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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
