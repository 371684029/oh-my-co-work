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
import { ElMessage, ElMessageBox } from 'element-plus'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import '@xterm/xterm/css/xterm.css'
import { TERMINAL_THEMES, defaultTerminalPrefs } from './terminalPrefs'
import { isTerminalRunning } from '../../composables/terminalStatus'
import { createInputSequencer } from '../../composables/terminalInput'
import {
  shouldCopyInsteadOfInterrupt,
  shouldHandlePasteShortcut,
} from '../../composables/terminalClipboard.js'
import {
  terminalOutputSubscribe,
  terminalOutputDrainPending,
} from '../../composables/terminalOutputBridge.js'
import {
  clearTerminalFocusRegistration,
  registerTerminalFocus,
  restoreTerminalFocus,
} from '../../composables/terminalFocusGuard.js'

const props = defineProps({
  terminal: { type: Object, required: true },
  prefs: { type: Object, default: () => ({}) },
  /** 隐藏时禁止 fit，避免把 PTY 缩成几列 */
  active: { type: Boolean, default: true },
})

const isRunning = computed(() => isTerminalRunning(props.terminal.status))

const emit = defineEmits(['input', 'resize', 'gap', 'focus-change'])
const host = ref(null)
let xterm = null
let fitAddon = null
let resizeObserver = null
let lastSeq = 0
let fitTimer = 0
let unsubOutput = null
// CLI-08: keeps keystroke order while a multi-line paste confirmation is open.
const sequencer = createInputSequencer()

function scheduleFit() {
  window.clearTimeout(fitTimer)
  fitTimer = window.setTimeout(() => fit(), 120)
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
  const text = String(value || '')
  xterm.reset()
  if (text) xterm.write(text)
  lastSeq = Number(props.terminal.seq || 0)
}

onMounted(async () => {
  const prefs = { ...defaultTerminalPrefs(), ...(props.prefs || {}) }
  const theme = TERMINAL_THEMES[prefs.theme] || TERMINAL_THEMES['project-dark']
  xterm = new Terminal({
    allowProposedApi: true,
    convertEol: false,
    cursorBlink: prefs.cursorBlink !== false,
    cursorStyle: prefs.cursorStyle === 'block' ? 'block' : 'bar',
    fontFamily: "'Cascadia Code', 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
    fontSize: Number(prefs.fontSize) || 13,
    lineHeight: 1.35,
    letterSpacing: 0.2,
    scrollback: Number(prefs.scrollback) > 0 ? Number(prefs.scrollback) : 5000,
    smoothScrollDuration: 120,
    macOptionClickForcesSelection: true,
    theme,
  })
  fitAddon = new FitAddon()
  xterm.loadAddon(fitAddon)
  try {
    const unicode11 = new Unicode11Addon()
    xterm.loadAddon(unicode11)
    xterm.unicode.activeVersion = '11'
  } catch {
    /* addon optional */
  }
  xterm.open(host.value)
  xterm.attachCustomKeyEventHandler((ev) => {
    if (ev.type !== 'keydown') return true
    if (shouldCopyInsteadOfInterrupt(xterm, ev)) {
      ev.preventDefault()
      const sel = xterm.getSelection()
      if (sel) {
        void navigator.clipboard?.writeText(sel).then(() => {
          ElMessage.success(`已复制 ${sel.length} 字符`)
        })
      }
      xterm.clearSelection()
      return false
    }
    if (shouldHandlePasteShortcut(ev)) {
      void navigator.clipboard?.readText().then((text) => {
        if (text && isRunning.value) emit('input', text)
      })
      ev.preventDefault()
      return false
    }
    return true
  })
  host.value?.addEventListener('contextmenu', (ev) => {
    ev.preventDefault()
    const sel = xterm.getSelection()
    if (sel) {
      void navigator.clipboard?.writeText(sel).then(() => ElMessage.success('已复制选区'))
    }
  })
  xterm.onData((data) => {
    if (!isRunning.value) return
    const lineBreaks = (data.match(/[\r\n]/g) || []).length
    const confirmPaste = (props.prefs?.pastePolicy || 'confirm') !== 'allow'
    if (confirmPaste && lineBreaks > 1) {
      sequencer.begin()
      ElMessageBox.confirm(`即将向终端粘贴 ${lineBreaks} 行内容，确定继续？`, '粘贴确认', {
        confirmButtonText: '粘贴',
        cancelButtonText: '取消',
        type: 'warning',
        closeOnPressEscape: true,
      })
        .then(() => {
          // Paste first, then any keys typed while the dialog was open, in order.
          for (const chunk of sequencer.flushConfirmed(data)) {
            if (isRunning.value) emit('input', chunk)
          }
        })
        .catch(() => {
          // Cancelled: still release the buffered keys so nothing is lost.
          for (const chunk of sequencer.flushCancelled()) {
            if (isRunning.value) emit('input', chunk)
          }
        })
        .finally(() => {
          restoreTerminalFocus()
          nextTick(() => setTimeout(() => xterm?.focus(), 50))
        })
      return
    }
    // While a confirmation is pending, hold keys and release them in order.
    for (const chunk of sequencer.enqueue(data)) emit('input', chunk)
  })
  xterm.textarea?.addEventListener('focus', () => {
    registerTerminalFocus(xterm.textarea)
    emit('focus-change', true)
  })
  xterm.textarea?.addEventListener('blur', () => emit('focus-change', false))
  resetToReplay(props.terminal.replay)
  for (const chunk of terminalOutputDrainPending(props.terminal.id, lastSeq)) {
    if (chunk.data) xterm.write(chunk.data)
    lastSeq = Math.max(lastSeq, chunk.seq)
  }
  unsubOutput = terminalOutputSubscribe(props.terminal.id, ({ seq, data, reset, replay }) => {
    if (!xterm) return
    if (reset) {
      resetToReplay(replay)
      return
    }
    if (!data) return
    const nextSeq = Number(seq || 0)
    if (nextSeq > lastSeq + 1) emit('gap', { from: lastSeq, to: nextSeq })
    xterm.write(data)
    lastSeq = Math.max(lastSeq, nextSeq)
  })
  resizeObserver = new ResizeObserver(() => scheduleFit())
  resizeObserver.observe(host.value)
  await nextTick()
  fit()
  xterm.focus()
  registerTerminalFocus(xterm.textarea)
  emit('focus-change', true)
})

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
  window.clearTimeout(fitTimer)
  unsubOutput?.()
  unsubOutput = null
  clearTerminalFocusRegistration(xterm?.textarea)
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
