<template>
  <Teleport to="body" :disabled="!isPagefill">
    <section
      ref="workspaceRoot"
      class="furnace-workspace"
      :class="{ 'is-pagefill': isPagefill, 'is-chat': surface === 'chat' }"
    >
      <header class="furnace-head">
        <div class="furnace-leading">
          <button type="button" class="furnace-btn" @click="$emit('close')">返回工作台</button>
          <span class="furnace-divider" />
          <div class="furnace-identity">
            <span class="furnace-dot" :class="{ active: isRunning }" />
            <strong>熔炉</strong>
            <span class="furnace-state">{{ statusText }}</span>
          </div>
        </div>
        <div class="furnace-actions">
          <button
            type="button"
            class="furnace-btn"
            :class="{ on: surface === 'chat' }"
            title="气泡皮：去 ANSI 的大对话面，同一条 grok 进程"
            @click="surface = 'chat'"
          >
            对话
          </button>
          <button
            type="button"
            class="furnace-btn"
            :class="{ on: surface === 'tui' }"
            title="原 Grok TUI"
            @click="surface = 'tui'"
          >
            终端
          </button>
          <button
            type="button"
            class="furnace-btn"
            :title="isPagefill ? '缩小：回到工作台三栏' : '铺满整个页面'"
            @click="togglePagefill"
          >
            {{ isPagefill ? '缩小' : '铺满页面' }}
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
          <button
            v-if="isRunning"
            type="button"
            class="furnace-btn danger"
            @click="$emit('kill', terminal.id)"
          >
            停止进程
          </button>
        </div>
      </header>

      <div v-show="surface === 'chat'" class="furnace-chat">
        <div ref="logEl" class="furnace-log">
          <div v-if="!liveText && !sent.length" class="furnace-empty">
            Grok 已在本机跑着。在下方输入，发送进同一进程。菜单或快捷键请切「终端」。
          </div>
          <div v-for="item in sent" :key="item.id" class="bubble bubble-user">
            <span class="bubble-label">你</span>
            <pre>{{ item.text }}</pre>
          </div>
          <div v-if="liveText" class="bubble bubble-grok">
            <span class="bubble-label">Grok</span>
            <pre>{{ liveText }}</pre>
          </div>
        </div>
        <form class="furnace-composer" @submit.prevent="sendChat">
          <textarea
            v-model="draft"
            rows="3"
            :disabled="!isRunning"
            placeholder="写给熔炉… Enter 发送，Shift+Enter 换行"
            @keydown="onComposerKey"
          />
          <button type="submit" class="furnace-send" :disabled="!canSend">发送</button>
        </form>
      </div>

      <div v-if="surface === 'tui'" class="furnace-tui">
        <TerminalView
          :key="terminal.id"
          :terminal="terminal"
          :prefs="prefs"
          @input="$emit('input', $event)"
          @resize="$emit('resize', $event)"
          @gap="$emit('gap', $event)"
          @focus-change="onFocusChange"
        />
      </div>

      <footer class="furnace-foot">
        <span>{{ isPagefill ? '铺满页面' : '工作台中栏' }} · {{ surface === 'chat' ? '对话皮' : 'TUI' }}</span>
        <span v-if="terminal.cwd" class="furnace-cwd" :title="terminal.cwd">{{ terminal.cwd }}</span>
        <span>{{ footerHint }}</span>
      </footer>
    </section>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { stripAnsi } from '@acw/shared'
import TerminalView from './TerminalView.vue'
import {
  exitFullscreen,
  fullscreenElement,
  requestFullscreen,
} from '../../composables/fullscreen'

const props = defineProps({
  terminal: { type: Object, required: true },
  terminals: { type: Array, default: () => [] },
  connectionStatus: { type: String, default: 'open' },
  prefs: { type: Object, default: () => ({}) },
  defaultPagefill: { type: Boolean, default: true },
  defaultSurface: { type: String, default: 'chat' },
})

const emit = defineEmits(['close', 'kill', 'input', 'resize', 'select', 'download-log', 'gap'])

const workspaceRoot = ref(null)
const logEl = ref(null)
const isFullscreen = ref(false)
const isPagefill = ref(props.defaultPagefill !== false)
const surface = ref(props.defaultSurface === 'tui' ? 'tui' : 'chat')
const focused = ref(false)
const draft = ref('')
const sent = ref([])

const isRunning = computed(() => ['starting', 'running'].includes(props.terminal.status))
const liveText = computed(() => stripAnsi(props.terminal.replay || '').trim())
const canSend = computed(() => isRunning.value && !!draft.value.trim())

const statusText = computed(() => {
  if (props.connectionStatus !== 'open') {
    return props.connectionStatus === 'connecting' ? '连接中' : '重连中'
  }
  const map = {
    starting: '启动中',
    running: '交互中',
    exited: '已结束',
    failed: '启动失败',
    killed: '已停止',
  }
  return map[props.terminal.status] || props.terminal.status
})

const footerHint = computed(() => {
  if (!isRunning.value) return '进程已结束 · 返回工作台保留记录'
  if (surface.value === 'chat') return '发送写入同一 grok 进程 · 缩小后仍在中栏'
  if (focused.value) return '终端输入中 · Esc 退出焦点'
  if (isPagefill.value) return '再按 Esc 缩小回工作台'
  return '点画面继续输入'
})

function syncFullscreenState() {
  isFullscreen.value = fullscreenElement() === workspaceRoot.value
}

async function toggleTerminalFullscreen() {
  if (isFullscreen.value) await exitFullscreen()
  else await requestFullscreen(workspaceRoot.value)
}

function togglePagefill() {
  isPagefill.value = !isPagefill.value
}

function onFocusChange(value) {
  focused.value = !!value
}

function sendChat() {
  const text = draft.value.trim()
  if (!text || !isRunning.value) return
  sent.value.push({ id: `${Date.now()}-${sent.value.length}`, text })
  emit('input', `${text}\r`)
  draft.value = ''
  nextTick(scrollLog)
}

function onComposerKey(ev) {
  if (ev.key !== 'Enter' || ev.shiftKey) return
  ev.preventDefault()
  sendChat()
}

function scrollLog() {
  const el = logEl.value
  if (el) el.scrollTop = el.scrollHeight
}

function onKeydown(ev) {
  if (ev.key !== 'Escape') return
  if (surface.value === 'chat' && document.activeElement?.tagName === 'TEXTAREA') {
    document.activeElement.blur()
    return
  }
  if (focused.value) {
    ev.preventDefault()
    document.activeElement?.blur?.()
    focused.value = false
    return
  }
  if (isPagefill.value) {
    ev.preventDefault()
    isPagefill.value = false
  }
}

watch(isPagefill, async (on) => {
  document.documentElement.classList.toggle('acw-terminal-pagefill', on)
  await nextTick()
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
})

watch(liveText, () => nextTick(scrollLog))

watch(surface, (mode) => {
  if (mode === 'chat') emit('resize', { cols: 120, rows: 40 })
  nextTick(() => window.dispatchEvent(new Event('resize')))
})

watch(
  () => props.defaultSurface,
  (v) => {
    surface.value = v === 'tui' ? 'tui' : 'chat'
  },
)

onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreenState)
  document.addEventListener('keydown', onKeydown)
  syncFullscreenState()
  if (isPagefill.value) document.documentElement.classList.add('acw-terminal-pagefill')
  if (surface.value === 'chat') emit('resize', { cols: 120, rows: 40 })
  nextTick(scrollLog)
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', syncFullscreenState)
  document.removeEventListener('keydown', onKeydown)
  document.documentElement.classList.remove('acw-terminal-pagefill')
})
</script>

<style scoped>
.furnace-workspace {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  margin: 0 8px 8px;
  overflow: hidden;
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
  position: fixed;
  inset: 0;
  z-index: 200;
  width: 100%;
  height: 100%;
}

.furnace-workspace:not(.is-chat) {
  background: #17191f;
}

.furnace-head,
.furnace-foot {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
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

.furnace-leading,
.furnace-actions {
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

.furnace-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #c5c7ce;
}

.furnace-dot.active {
  background: #34c759;
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

.furnace-divider {
  width: 1px;
  height: 16px;
  background: rgba(0, 0, 0, 0.12);
}

.furnace-chat,
.furnace-tui {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.furnace-tui {
  background: #17191f;
}

.furnace-log {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 20px 8% 12px;
}

.furnace-empty {
  color: #6e6e73;
  font-size: 14px;
  line-height: 1.6;
  max-width: 52rem;
  margin: 12vh auto 0;
}

.bubble {
  max-width: min(52rem, 100%);
  margin: 0 auto 16px;
}

.bubble-user {
  margin-left: auto;
  margin-right: 8%;
}

.bubble-label {
  display: block;
  font-size: 11px;
  font-weight: 650;
  color: #6e6e73;
  margin-bottom: 6px;
}

.bubble pre {
  margin: 0;
  padding: 14px 16px;
  border-radius: 16px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.55;
}

.bubble-user pre {
  background: #007aff;
  color: #fff;
}

.bubble-grok pre {
  background: #fff;
  color: #1d1d1f;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
}

.furnace-composer {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  padding: 12px 8% 16px;
  background: rgba(255, 255, 255, 0.92);
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.furnace-composer textarea {
  flex: 1;
  resize: none;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 14px;
  padding: 12px 14px;
  font: inherit;
  font-size: 15px;
  min-height: 72px;
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
</style>
