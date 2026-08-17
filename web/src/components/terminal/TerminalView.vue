<template>
  <div ref="host" class="terminal-view" :class="{ 'is-dead': !isRunning }" aria-label="交互式终端">
    <div v-if="!isRunning" class="terminal-dead-overlay">
      <div class="terminal-dead-text">
        <span class="terminal-dead-icon" aria-hidden="true">⏻</span>
        进程已结束，无法继续输入
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

const props = defineProps({
  terminal: { type: Object, required: true },
})

const isRunning = computed(() => ['starting', 'running'].includes(props.terminal.status))

const emit = defineEmits(['input', 'resize'])
const host = ref(null)
let xterm = null
let fitAddon = null
let resizeObserver = null
let lastSeq = 0

function fit() {
  if (!xterm || !fitAddon || !host.value?.isConnected) return
  try {
    fitAddon.fit()
    emit('resize', { cols: xterm.cols, rows: xterm.rows })
  } catch {
    /* 容器切换动画期间尺寸可能暂不可用 */
  }
}

function resetToReplay(value) {
  if (!xterm) return
  const text = String(value || '')
  xterm.reset()
  if (text) xterm.write(text)
  lastSeq = Number(props.terminal.seq || 0)
}

onMounted(async () => {
  xterm = new Terminal({
    allowProposedApi: false,
    convertEol: false,
    cursorBlink: true,
    cursorStyle: 'bar',
    fontFamily: "'Cascadia Code', 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
    fontSize: 13,
    lineHeight: 1.3,
    letterSpacing: 0,
    scrollback: 5000,
    theme: {
      background: '#17191f',
      foreground: '#e7e9ee',
      cursor: '#67b3ff',
      cursorAccent: '#17191f',
      selectionBackground: '#409eff55',
      black: '#252830',
      red: '#ff6b6b',
      green: '#69db8b',
      yellow: '#ffd166',
      blue: '#64a9ff',
      magenta: '#c792ea',
      cyan: '#5ccfe6',
      white: '#d8dee9',
      brightBlack: '#71798a',
      brightRed: '#ff8787',
      brightGreen: '#8ce99a',
      brightYellow: '#ffe066',
      brightBlue: '#91c4ff',
      brightMagenta: '#d6a6f2',
      brightCyan: '#89e5f3',
      brightWhite: '#ffffff',
    },
  })
  fitAddon = new FitAddon()
  xterm.loadAddon(fitAddon)
  xterm.open(host.value)
  xterm.onData((data) => {
    if (!isRunning.value) return
    const lineBreaks = (data.match(/[\r\n]/g) || []).length
    if (lineBreaks > 1 && !window.confirm(`即将向终端粘贴 ${lineBreaks} 行内容，确定继续？`)) {
      return
    }
    emit('input', data)
  })
  resetToReplay(props.terminal.replay)
  resizeObserver = new ResizeObserver(() => fit())
  resizeObserver.observe(host.value)
  await nextTick()
  fit()
  xterm.focus()
})

watch(
  () => props.terminal.seq,
  (seq) => {
    const nextSeq = Number(seq || 0)
    if (!xterm || nextSeq <= lastSeq) return
    if (props.terminal.lastChunk) xterm.write(props.terminal.lastChunk)
    lastSeq = nextSeq
  },
)

watch(
  () => props.terminal.snapshotKey,
  () => resetToReplay(props.terminal.replay),
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  xterm?.dispose()
  xterm = null
  fitAddon = null
})
</script>

<style scoped>
.terminal-view {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 6px 4px 4px 8px;
  background: #17191f;
}

.terminal-view :deep(.xterm) {
  height: 100%;
}

.terminal-view :deep(.xterm-viewport) {
  scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
  scrollbar-width: thin;
}

.terminal-view.is-dead {
  position: relative;
  cursor: not-allowed;
}

.terminal-view.is-dead :deep(.xterm-cursor) {
  display: none !important;
}

.terminal-dead-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 14px;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgba(23, 25, 31, 0) 0%,
    rgba(23, 25, 31, 0.55) 70%,
    rgba(23, 25, 31, 0.7) 100%
  );
}

.terminal-dead-text {
  font-size: 12px;
  color: #9097a5;
  padding: 5px 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  gap: 6px;
}

.terminal-dead-icon {
  font-size: 14px;
  color: #ff9999;
}
</style>
