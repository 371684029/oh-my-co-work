<template>
  <div
    ref="host"
    class="terminal-view"
    :class="{ 'is-dead': !isRunning, 'is-blurred': !focused }"
    :style="{ background: theme.background }"
    aria-label="交互式终端"
  >
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
import { SearchAddon } from '@xterm/addon-search'
import { ElMessage, ElMessageBox } from 'element-plus'
import { inspectTerminalPaste } from '@acw/shared'
import {
  fontFamilyFromPrefs,
  themeFromPrefs,
  useTerminalPrefs,
} from '../../composables/terminalPrefs'
import '@xterm/xterm/css/xterm.css'

const props = defineProps({
  terminal: { type: Object, required: true },
})

const isRunning = computed(() => ['starting', 'running'].includes(props.terminal.status))

const emit = defineEmits(['input', 'resize', 'focus-change', 'search'])
const host = ref(null)
const focused = ref(false)
const { prefs } = useTerminalPrefs()
const theme = computed(() => themeFromPrefs(prefs.value))

let xterm = null
let fitAddon = null
let searchAddon = null
let resizeObserver = null
let lastSeq = 0
let pasteBusy = false
let detachFocus = null

function fit() {
  if (!xterm || !fitAddon || !host.value?.isConnected) return
  try {
    fitAddon.fit()
    emit('resize', { cols: xterm.cols, rows: xterm.rows })
  } catch {
    /* 容器切换动画期间尺寸可能暂不可用 */
  }
}

function applyPrefs() {
  if (!xterm) return
  const next = prefs.value
  xterm.options.fontFamily = fontFamilyFromPrefs(next)
  xterm.options.fontSize = next.fontSize
  xterm.options.lineHeight = next.lineHeight
  xterm.options.cursorStyle = next.cursorStyle
  xterm.options.cursorBlink = next.cursorBlink
  xterm.options.scrollback = next.scrollback
  xterm.options.theme = themeFromPrefs(next)
  fit()
}

function resetToReplay(value) {
  if (!xterm) return
  const text = String(value || '')
  xterm.reset()
  if (text) xterm.write(text)
  lastSeq = Number(props.terminal.seq || 0)
}

function focusTerminal() {
  xterm?.focus()
}

function blurTerminal() {
  xterm?.blur()
  host.value?.blur?.()
}

function clearScreen() {
  xterm?.clear()
}

function copySelection() {
  const text = xterm?.getSelection?.() || ''
  if (!text) {
    ElMessage.info('没有选中的文本')
    return false
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => ElMessage.success('已复制选区'),
      () => ElMessage.error('复制失败'),
    )
  }
  return true
}

function findNext(query) {
  if (!searchAddon || !query) return false
  return !!searchAddon.findNext(query)
}

function findPrevious(query) {
  if (!searchAddon || !query) return false
  return !!searchAddon.findPrevious(query)
}

async function maybeSendInput(data) {
  if (!isRunning.value || !xterm) return
  const decision = inspectTerminalPaste(data, prefs.value.pastePolicy)
  if (decision.action === 'send') {
    emit('input', data)
    return
  }
  if (decision.action === 'reject') {
    ElMessage.warning(
      decision.lines >= 2
        ? `已拦截 ${decision.lines} 行粘贴（设置里可改为确认或允许）`
        : '已拦截过长粘贴',
    )
    return
  }
  if (pasteBusy) return
  pasteBusy = true
  try {
    await ElMessageBox.confirm(
      decision.lines >= 2
        ? `即将向终端粘贴 ${decision.lines} 行（${decision.chars} 字符）。多行可能被工具立刻执行。`
        : `即将向终端粘贴 ${decision.chars} 个字符。`,
      '粘贴确认',
      {
        type: 'warning',
        confirmButtonText: '粘贴到终端',
        cancelButtonText: '取消',
      },
    )
    emit('input', data)
  } catch {
    /* 取消 */
  } finally {
    pasteBusy = false
    focusTerminal()
  }
}

onMounted(async () => {
  const next = prefs.value
  xterm = new Terminal({
    allowProposedApi: true,
    convertEol: false,
    disableStdin: false,
    cursorBlink: next.cursorBlink,
    cursorStyle: next.cursorStyle,
    fontFamily: fontFamilyFromPrefs(next),
    fontSize: next.fontSize,
    lineHeight: next.lineHeight,
    letterSpacing: 0,
    scrollback: next.scrollback,
    theme: themeFromPrefs(next),
  })
  fitAddon = new FitAddon()
  searchAddon = new SearchAddon()
  xterm.loadAddon(fitAddon)
  xterm.loadAddon(searchAddon)
  xterm.open(host.value)
  xterm.attachCustomKeyEventHandler((ev) => {
    if (ev.type !== 'keydown') return true
    if (ev.key === 'Escape') {
      blurTerminal()
      ev.preventDefault()
      return false
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && ev.key.toLowerCase() === 'c') {
      copySelection()
      ev.preventDefault()
      return false
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && ev.key.toLowerCase() === 'f') {
      emit('search')
      ev.preventDefault()
      return false
    }
    return true
  })
  xterm.onData((data) => {
    if (!isRunning.value) return
    maybeSendInput(data)
  })
  const textarea = xterm.textarea
  const onFocus = () => {
    focused.value = true
    emit('focus-change', true)
  }
  const onBlur = () => {
    focused.value = false
    emit('focus-change', false)
  }
  textarea?.addEventListener('focus', onFocus)
  textarea?.addEventListener('blur', onBlur)
  detachFocus = () => {
    textarea?.removeEventListener('focus', onFocus)
    textarea?.removeEventListener('blur', onBlur)
  }
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

watch(prefs, () => applyPrefs(), { deep: true })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  detachFocus?.()
  detachFocus = null
  xterm?.dispose()
  xterm = null
  fitAddon = null
  searchAddon = null
})

defineExpose({
  focusTerminal,
  blurTerminal,
  clearScreen,
  copySelection,
  findNext,
  findPrevious,
  focused,
})
</script>

<style scoped>
.terminal-view {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 6px 4px 4px 8px;
}

.terminal-view :deep(.xterm) {
  height: 100%;
}

.terminal-view :deep(.xterm-viewport) {
  scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
  scrollbar-width: thin;
}

.terminal-view.is-dead,
.terminal-view.is-blurred {
  position: relative;
}

.terminal-view.is-dead {
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
