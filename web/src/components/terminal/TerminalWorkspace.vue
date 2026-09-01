<template>
  <!-- 满屏必须挂到 body：中栏 backdrop-filter 会把内部 fixed 锁在卡片里，铺不满视口 -->
  <Teleport to="body" :disabled="!isPagefill">
  <section
    ref="workspaceRoot"
    class="terminal-workspace"
    :class="{ 'is-pagefill': isPagefill }"
  >
    <header class="terminal-workspace-head">
      <div class="terminal-workspace-leading">
        <button type="button" class="terminal-back" @click="$emit('close')">
          <span aria-hidden="true">‹</span>
          返回对话
        </button>
        <span class="terminal-divider" />
        <select
          v-if="terminals.length > 1"
          class="terminal-switch"
          :value="terminal.id"
          @change="$emit('select', $event.target.value)"
        >
          <option v-for="item in terminals" :key="item.id" :value="item.id">
            {{ item.label || '终端' }} · {{ item.status }}
          </option>
        </select>
        <div class="terminal-identity">
          <div class="terminal-name-row">
            <span class="terminal-live-dot" :class="{ active: isRunning }" aria-hidden="true" />
            <strong>{{ terminal.label || '内嵌终端' }}</strong>
            <span class="terminal-state">{{ statusText }}</span>
          </div>
          <span class="terminal-cwd" :title="terminal.cwd">{{ terminal.cwd || '—' }}</span>
        </div>
      </div>
      <div class="terminal-workspace-actions">
        <button
          type="button"
          class="terminal-toolbar-button"
          :title="isPagefill ? '退出满屏，回到中栏' : '满屏：铺满整个页面，不调用系统全屏'"
          @click="togglePagefill"
        >
          <span aria-hidden="true">{{ isPagefill ? '↙' : '▣' }}</span>
          {{ isPagefill ? '退出满屏' : '满屏' }}
        </button>
        <button
          type="button"
          class="terminal-toolbar-button"
          data-fullscreen-control
          :title="isFullscreen ? '退出终端全屏' : '全屏：交给浏览器，铺满显示器'"
          @click="toggleTerminalFullscreen"
        >
          <span aria-hidden="true">{{ isFullscreen ? '↙' : '⛶' }}</span>
          {{ isFullscreen ? '退出全屏' : '全屏' }}
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
          v-if="isRunning"
          type="button"
          class="terminal-toolbar-button danger"
          @click="$emit('kill', terminal.id)"
        >
          停止进程
        </button>
      </div>
    </header>

    <div class="terminal-stage">
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

    <footer class="terminal-workspace-foot">
      <span>{{ terminal.runtime || 'terminal' }}</span>
      <span v-if="terminal.pid">PID {{ terminal.pid }}</span>
      <span v-if="terminal.exitCode != null">exit {{ terminal.exitCode }}</span>
      <span class="terminal-focus-hint">{{ footerHint }}</span>
    </footer>
  </section>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import TerminalView from './TerminalView.vue'
import {
  isTerminalRunning,
  terminalStatusText,
  connectionStatusText,
} from '../../composables/terminalStatus'
import { usePagefill } from '../../composables/pagefill'

const props = defineProps({
  terminal: { type: Object, required: true },
  terminals: { type: Array, default: () => [] },
  connectionStatus: { type: String, default: 'open' },
  prefs: { type: Object, default: () => ({}) },
  defaultPagefill: { type: Boolean, default: false },
})

defineEmits(['close', 'kill', 'input', 'resize', 'select', 'download-log', 'gap'])

const workspaceRoot = ref(null)

const {
  isFullscreen,
  isPagefill,
  focused,
  toggleFullscreen: toggleTerminalFullscreen,
  togglePagefill,
  setFocused,
} = usePagefill(workspaceRoot, {
  initialFocused: true,
  initialPagefill: !!props.defaultPagefill,
})

function onFocusChange(value) {
  setFocused(value)
}

const isRunning = computed(() => isTerminalRunning(props.terminal.status))
const footerHint = computed(() => {
  if (!isRunning.value) return '进程已结束，键盘输入不再生效 · 返回对话保留记录'
  if (props.connectionStatus !== 'open') return '连接中断，PTY 仍在跑 · 重连后会补回放'
  if (focused.value) return '终端输入中 · Esc 退出焦点，聊天快捷键不会进终端'
  if (isPagefill.value) return '已退出终端焦点 · 再按 Esc 退出满屏'
  return '已退出终端焦点 · 点画面继续输入'
})
const statusText = computed(() => {
  if (props.connectionStatus !== 'open') {
    return connectionStatusText(props.connectionStatus)
  }
  return terminalStatusText(props.terminal.status, 'workspace')
})

watch(
  () => props.defaultPagefill,
  (on) => {
    if (on) isPagefill.value = true
  },
)
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
  background: #17191f;
  box-shadow:
    0 18px 50px rgba(15, 18, 25, 0.16),
    inset 0 1px rgba(255, 255, 255, 0.05);
}

.terminal-workspace:fullscreen,
.terminal-workspace.is-pagefill {
  width: 100vw;
  height: 100vh;
  margin: 0;
  border: 0;
  border-radius: 0;
}

.terminal-workspace.is-pagefill {
  position: fixed;
  inset: 0;
  z-index: 200;
  width: 100%;
  height: 100%;
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

.terminal-switch {
  max-width: 220px;
  border: 0;
  border-radius: 8px;
  padding: 5px 8px;
  background: rgba(255, 255, 255, 0.08);
  color: #dce0e8;
  font-size: 11px;
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

.terminal-cwd {
  display: block;
  max-width: min(52vw, 580px);
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
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
