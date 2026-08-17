<template>
  <section ref="workspaceRoot" class="terminal-workspace" :style="{ background: theme.background }">
    <header class="terminal-workspace-head">
      <div class="terminal-workspace-leading">
        <button type="button" class="terminal-back" @click="$emit('close')">
          <span aria-hidden="true">‹</span>
          返回对话
        </button>
        <span class="terminal-divider" />
        <div class="terminal-identity">
          <div class="terminal-name-row">
            <span class="terminal-live-dot" :class="{ active: isRunning }" aria-hidden="true" />
            <strong>{{ terminal.label || '内嵌终端' }}</strong>
            <span class="terminal-state">{{ statusText }}</span>
            <span v-if="focused && isRunning" class="terminal-focus-badge">终端输入中</span>
          </div>
          <span class="terminal-cwd" :title="terminal.cwd">{{ terminal.cwd || '—' }}</span>
        </div>
      </div>
      <div class="terminal-workspace-actions">
        <button
          type="button"
          class="terminal-toolbar-button"
          title="搜索输出"
          @click="toggleSearch"
        >
          搜索
        </button>
        <button type="button" class="terminal-toolbar-button" title="复制选区" @click="copySel">
          复制
        </button>
        <button type="button" class="terminal-toolbar-button" title="清屏（仅本地视图）" @click="clearView">
          清屏
        </button>
        <button
          type="button"
          class="terminal-toolbar-button"
          title="重新附着并回放缓冲"
          @click="$emit('reconnect', terminal.id)"
        >
          重连
        </button>
        <button
          type="button"
          class="terminal-toolbar-button"
          title="下载终端日志"
          @click="$emit('download-log', terminal.id)"
        >
          日志
        </button>
        <button
          v-if="focused && isRunning"
          type="button"
          class="terminal-toolbar-button"
          title="退出输入焦点，不再把按键发给终端"
          @click="blurView"
        >
          退出焦点
        </button>
        <button
          v-else-if="isRunning"
          type="button"
          class="terminal-toolbar-button"
          title="点此后键盘输入发给终端"
          @click="focusView"
        >
          进入输入
        </button>
        <button
          type="button"
          class="terminal-toolbar-button"
          data-fullscreen-control
          :title="isFullscreen ? '退出终端全屏' : '终端全屏'"
          @click="toggleTerminalFullscreen"
        >
          <span aria-hidden="true">{{ isFullscreen ? '↙' : '⛶' }}</span>
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </button>
        <button
          v-if="isRunning"
          type="button"
          class="terminal-toolbar-button danger"
          @click="$emit('kill', terminal.id)"
        >
          停止进程
        </button>
      </div>
    </header>

    <div v-if="searchOpen" class="terminal-search">
      <input
        ref="searchInput"
        v-model="searchQuery"
        class="terminal-search-input"
        type="search"
        placeholder="在输出中查找"
        @keydown.enter.prevent="find(false)"
        @keydown.escape.prevent="searchOpen = false"
      />
      <button type="button" class="terminal-toolbar-button" @click="find(true)">上一个</button>
      <button type="button" class="terminal-toolbar-button" @click="find(false)">下一个</button>
    </div>

    <p v-if="terminal.replayTruncated" class="terminal-gap-hint">
      回放缓冲有截断，部分较早输出未显示。完整内容请下载日志。
    </p>

    <div class="terminal-stage">
      <TerminalView
        ref="viewRef"
        :key="terminal.id"
        :terminal="terminal"
        @input="$emit('input', $event)"
        @resize="$emit('resize', $event)"
        @focus-change="onFocusChange"
        @search="toggleSearch"
      />
    </div>

    <footer class="terminal-workspace-foot">
      <span>{{ terminal.runtime || 'terminal' }}</span>
      <span v-if="terminal.pid">PID {{ terminal.pid }}</span>
      <span v-if="terminal.exitCode != null">exit {{ terminal.exitCode }}</span>
      <span class="terminal-focus-hint">{{ footerHint }}</span>
    </footer>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import TerminalView from './TerminalView.vue'
import {
  exitFullscreen,
  fullscreenElement,
  requestFullscreen,
} from '../../composables/fullscreen'
import { themeFromPrefs, useTerminalPrefs } from '../../composables/terminalPrefs'

const props = defineProps({
  terminal: { type: Object, required: true },
  connectionStatus: { type: String, default: 'open' },
})

const emit = defineEmits(['close', 'kill', 'input', 'resize', 'reconnect', 'download-log'])

const { prefs } = useTerminalPrefs()
const theme = computed(() => themeFromPrefs(prefs.value))
const workspaceRoot = ref(null)
const viewRef = ref(null)
const searchInput = ref(null)
const isFullscreen = ref(false)
const focused = ref(false)
const searchOpen = ref(false)
const searchQuery = ref('')
const isRunning = computed(() => ['starting', 'running'].includes(props.terminal.status))
const footerHint = computed(() => {
  if (!isRunning.value) return '进程已结束，键盘输入不再生效 · 返回对话保留记录'
  if (props.connectionStatus !== 'open') return '连接中断时进程仍在跑 · 点重连重新附着'
  if (focused.value) return '终端输入中 · Esc 或「退出焦点」后按键不再发给 PTY'
  return '未处于输入焦点 · 点终端或「进入输入」后键盘才会发给进程'
})
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
    timed_out: '已超时',
    interrupted: '已中断',
  }
  return map[props.terminal.status] || props.terminal.status
})

function onFocusChange(value) {
  focused.value = !!value
}

function focusView() {
  viewRef.value?.focusTerminal?.()
}

function blurView() {
  viewRef.value?.blurTerminal?.()
}

function clearView() {
  viewRef.value?.clearScreen?.()
}

function copySel() {
  viewRef.value?.copySelection?.()
}

async function toggleSearch() {
  searchOpen.value = !searchOpen.value
  if (searchOpen.value) {
    await nextTick()
    searchInput.value?.focus()
  }
}

function find(previous) {
  const q = searchQuery.value.trim()
  if (!q) return
  const ok = previous ? viewRef.value?.findPrevious?.(q) : viewRef.value?.findNext?.(q)
  if (!ok) {
    /* 找不到时保持安静，避免刷屏 */
  }
}

function syncFullscreenState() {
  isFullscreen.value = fullscreenElement() === workspaceRoot.value
}

async function toggleTerminalFullscreen() {
  if (isFullscreen.value) await exitFullscreen()
  else await requestFullscreen(workspaceRoot.value)
}

watch(
  () => props.terminal.status,
  (status, prev) => {
    if (!prefs.value.collapseOnExit) return
    if (['starting', 'running'].includes(prev) && !['starting', 'running'].includes(status)) {
      emit('close')
    }
  },
)

onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreenState)
  syncFullscreenState()
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', syncFullscreenState)
})
</script>

<style scoped>
.terminal-workspace {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  margin: 0 8px 8px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 18px;
  box-shadow:
    0 18px 50px rgba(15, 18, 25, 0.16),
    inset 0 1px rgba(255, 255, 255, 0.05);
}

.terminal-workspace:fullscreen {
  width: 100vw;
  height: 100vh;
  margin: 0;
  border: 0;
  border-radius: 0;
}

.terminal-workspace-head,
.terminal-workspace-foot {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  color: #cfd4de;
  background: linear-gradient(180deg, #23262e, #1e2128);
}

.terminal-workspace-head {
  min-height: 46px;
  justify-content: space-between;
  gap: 14px;
  padding: 5px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.terminal-workspace-leading,
.terminal-name-row,
.terminal-workspace-actions {
  display: flex;
  align-items: center;
  min-width: 0;
}

.terminal-workspace-leading {
  gap: 12px;
}

.terminal-workspace-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.terminal-back,
.terminal-toolbar-button {
  border: 0;
  border-radius: 9px;
  padding: 7px 10px;
  background: rgba(255, 255, 255, 0.07);
  color: #dce0e8;
  font-size: 11.5px;
  cursor: pointer;
}

.terminal-back:hover,
.terminal-toolbar-button:hover {
  background: rgba(255, 255, 255, 0.12);
}

.terminal-back span {
  margin-right: 3px;
  font-size: 18px;
  line-height: 10px;
  vertical-align: -1px;
}

.terminal-toolbar-button.danger {
  color: #ff9999;
}

.terminal-divider {
  width: 1px;
  height: 28px;
  background: rgba(255, 255, 255, 0.08);
}

.terminal-identity {
  min-width: 0;
}

.terminal-name-row {
  gap: 7px;
}

.terminal-name-row strong {
  overflow: hidden;
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.terminal-live-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #7d8492;
}

.terminal-live-dot.active {
  background: #5fd98e;
  box-shadow: 0 0 0 3px rgba(95, 217, 142, 0.12);
}

.terminal-state,
.terminal-cwd,
.terminal-workspace-foot {
  color: #9097a5;
  font-size: 10.5px;
}

.terminal-state {
  padding: 2px 6px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.06);
}

.terminal-focus-badge {
  padding: 2px 7px;
  border-radius: 5px;
  background: rgba(95, 217, 142, 0.16);
  color: #8ee7b0;
  font-size: 10.5px;
}

.terminal-cwd {
  display: block;
  max-width: min(52vw, 580px);
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
}

.terminal-search,
.terminal-gap-hint {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  color: #cfd4de;
  background: #1b1e25;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 12px;
}

.terminal-gap-hint {
  margin: 0;
  color: #e6c07b;
}

.terminal-search-input {
  min-width: 0;
  flex: 1;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.25);
  color: #e7e9ee;
}

.terminal-stage {
  min-height: 0;
  flex: 1;
}

.terminal-workspace-foot {
  gap: 12px;
  min-height: 24px;
  padding: 3px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.terminal-focus-hint {
  margin-left: auto;
}
</style>
