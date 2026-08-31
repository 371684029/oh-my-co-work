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
import { TERMINAL_THEMES, defaultTerminalPrefs } from './terminalPrefs'
import { sanitizeFurnaceGuiText } from '@acw/shared'

const props = defineProps({
  terminal: { type: Object, required: true },
  prefs: { type: Object, default: () => ({}) },
  /** 隐藏时禁止 fit，避免把 PTY 缩成几列 */
  active: { type: Boolean, default: true },
  /** 熔炉：吞掉备用屏，清屏前把当前画面推进滚动历史，才能上翻看到更早的话 */
  preserveHistory: { type: Boolean, default: false },
})

const isRunning = computed(() => ['starting', 'running'].includes(props.terminal.status))

const emit = defineEmits(['input', 'resize', 'gap', 'focus-change'])
const host = ref(null)
let xterm = null
let fitAddon = null
let resizeObserver = null
let lastSeq = 0
let lastHistoryPush = ''
let pushingHistory = false
const historyDisposables = []

function paramAt(params, index) {
  if (!params) return 0
  if (typeof params.get === 'function') {
    const v = params.get(index)
    return Array.isArray(v) ? v[0] : Number(v) || 0
  }
  const v = params[index]
  return Array.isArray(v) ? v[0] : Number(v) || 0
}

function paramsHas(params, code) {
  const n = Number(params?.length) || 0
  for (let i = 0; i < n; i += 1) {
    if (paramAt(params, i) === code) return true
  }
  return false
}

function readViewportText(term) {
  const buf = term.buffer?.active
  if (!buf) return ''
  const lines = []
  const top = Number(buf.viewportY) || 0
  for (let i = 0; i < term.rows; i += 1) {
    const line = buf.getLine(top + i)
    lines.push(line ? line.translateToString(true) : '')
  }
  return lines.join('\n')
}

function pushViewportToScrollback(term) {
  if (!term || pushingHistory) return
  const clean = sanitizeFurnaceGuiText(readViewportText(term))
  if (!clean || clean === lastHistoryPush) return
  lastHistoryPush = clean
  pushingHistory = true
  try {
    const n = Math.max(1, Number(term.rows) || 24)
    term.write(`\x1b[${n};1H${'\r\n'.repeat(n)}`)
  } finally {
    pushingHistory = false
  }
}

function attachHistoryPreservation(term) {
  const parser = term.parser
  if (!parser?.registerCsiHandler) return
  historyDisposables.push(
    parser.registerCsiHandler({ prefix: '?', final: 'h' }, (params) => {
      if (paramsHas(params, 1049) || paramsHas(params, 1047) || paramsHas(params, 47)) return true
      return false
    }),
  )
  historyDisposables.push(
    parser.registerCsiHandler({ prefix: '?', final: 'l' }, (params) => {
      if (paramsHas(params, 1049) || paramsHas(params, 1047) || paramsHas(params, 47)) return true
      return false
    }),
  )
  historyDisposables.push(
    parser.registerCsiHandler({ final: 'J' }, (params) => {
      const mode = paramAt(params, 0) || 0
      if (mode === 2 || mode === 3) pushViewportToScrollback(term)
      return false
    }),
  )
}

function fit() {
  if (!xterm || !fitAddon || !host.value?.isConnected) return
  if (props.active === false) return
  const rect = host.value.getBoundingClientRect()
  if (rect.width < 80 || rect.height < 80) return
  try {
    fitAddon.fit()
    const cols = Number(xterm.cols)
    const rows = Number(xterm.rows)
    if (!Number.isFinite(cols) || !Number.isFinite(rows) || cols < 20 || rows < 8) return
    emit('resize', { cols, rows })
  } catch {
    /* 容器切换动画期间尺寸可能暂不可用 */
  }
}

function resetToReplay(value) {
  if (!xterm) return
  lastHistoryPush = ''
  const text = String(value || '')
  xterm.reset()
  if (text) xterm.write(text)
  lastSeq = Number(props.terminal.seq || 0)
}

onMounted(async () => {
  const prefs = { ...defaultTerminalPrefs(), ...(props.prefs || {}) }
  const theme = TERMINAL_THEMES[prefs.theme] || TERMINAL_THEMES['project-dark']
  xterm = new Terminal({
    allowProposedApi: false,
    convertEol: false,
    cursorBlink: prefs.cursorBlink !== false,
    cursorStyle: 'bar',
    fontFamily: "'Cascadia Code', 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
    fontSize: Number(prefs.fontSize) || 13,
    lineHeight: 1.3,
    letterSpacing: 0,
    scrollback: props.preserveHistory
      ? Math.max(Number(prefs.scrollback) || 5000, 8000)
      : Number(prefs.scrollback) || 5000,
    theme,
  })
  fitAddon = new FitAddon()
  xterm.loadAddon(fitAddon)
  xterm.open(host.value)
  if (props.preserveHistory) attachHistoryPreservation(xterm)
  xterm.onData((data) => {
    if (!isRunning.value) return
    const lineBreaks = (data.match(/[\r\n]/g) || []).length
    const confirmPaste = (props.prefs?.pastePolicy || 'confirm') !== 'allow'
    if (confirmPaste && lineBreaks > 1 && !window.confirm(`即将向终端粘贴 ${lineBreaks} 行内容，确定继续？`)) {
      return
    }
    emit('input', data)
  })
  xterm.textarea?.addEventListener('focus', () => emit('focus-change', true))
  xterm.textarea?.addEventListener('blur', () => emit('focus-change', false))
  resetToReplay(props.terminal.replay)
  resizeObserver = new ResizeObserver(() => fit())
  resizeObserver.observe(host.value)
  await nextTick()
  fit()
  xterm.focus()
  emit('focus-change', true)
})

watch(
  () => props.terminal.seq,
  (seq) => {
    const nextSeq = Number(seq || 0)
    if (!xterm || nextSeq <= lastSeq) return
    if (nextSeq > lastSeq + 1) emit('gap', { from: lastSeq, to: nextSeq })
    if (props.terminal.lastChunk) xterm.write(props.terminal.lastChunk)
    lastSeq = nextSeq
  },
)

watch(
  () => props.terminal.snapshotKey,
  () => resetToReplay(props.terminal.replay),
)

watch(
  () => props.active,
  (on) => {
    if (!on) return
    nextTick(() => {
      fit()
      xterm?.focus()
      emit('focus-change', true)
    })
  },
)

onBeforeUnmount(() => {
  historyDisposables.splice(0).forEach((d) => d?.dispose?.())
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
  overflow-y: scroll !important;
  scrollbar-gutter: stable;
  scrollbar-color: rgba(255, 255, 255, 0.42) rgba(255, 255, 255, 0.06);
  scrollbar-width: auto;
}

.terminal-view :deep(.xterm-viewport::-webkit-scrollbar) {
  width: 10px;
}

.terminal-view :deep(.xterm-viewport::-webkit-scrollbar-thumb) {
  background: rgba(255, 255, 255, 0.38);
  border-radius: 8px;
}

.terminal-view :deep(.xterm-viewport::-webkit-scrollbar-track) {
  background: rgba(255, 255, 255, 0.06);
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
