<template>
  <div
    ref="host"
    class="terminal-view"
    :class="{ 'is-dead': !isRunning, 'force-selection': forceSelection }"
    :aria-label="terminalViewAriaLabel()"
  >
    <div
      v-if="ctxMenu.open"
      class="terminal-ctx-menu"
      :style="{ top: `${ctxMenu.y}px`, left: `${ctxMenu.x}px` }"
      role="menu"
      @mousedown.stop
    >
      <button type="button" role="menuitem" @click="ctxCopy">{{ terminalViewCtxCopy() }}</button>
      <button type="button" role="menuitem" @click="ctxPaste">{{ terminalViewCtxPaste() }}</button>
      <button type="button" role="menuitem" @click="ctxSelectAll">{{ terminalViewCtxSelectAll() }}</button>
      <button type="button" role="menuitem" @click="ctxCopyVisible">
        {{ terminalViewCtxCopyVisible() }}
      </button>
      <button type="button" role="menuitem" @click="ctxClear">{{ terminalViewCtxClear() }}</button>
    </div>
    <div v-if="!isRunning" class="terminal-dead-overlay">
      <div class="terminal-dead-text">
        <span class="terminal-dead-icon" aria-hidden="true">⏻</span>
        {{ terminalViewProcessEnded() }}
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
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'
import { TERMINAL_THEMES, defaultTerminalPrefs } from './terminalPrefs'
import { isTerminalRunning } from '../../composables/terminalStatus'
import { createInputSequencer } from '../../composables/terminalInput'
import {
  shouldCopyInsteadOfInterrupt,
  shouldHandlePasteShortcut,
  getTerminalCopyText,
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
import { writeClipboardText, readClipboardText } from '../../composables/terminalClipboardBridge.js'
import { copyVisibleTerminalText, scrollTerminalToBottom } from '../../composables/terminalBufferUtils.js'
import {
  buildPasteConfirmMessage,
  shouldConfirmTerminalPaste,
} from '../../composables/terminalPasteConfirm.js'
import { api } from '../../api.js'
import { wrapBracketedPaste, chunkBracketedPaste } from '../../composables/bracketedPaste.js'
import { pathsToTerminalPaste } from '../../composables/terminalFilePaste.js'
import { shouldSkipPasteConfirmWhileComposing } from '../../composables/terminalIme.js'
import {
  terminalViewAriaLabel,
  terminalViewCopiedCharsMessage,
  terminalViewCopiedSelectionMessage,
  terminalViewCopiedVisibleMessage,
  terminalViewCopyEmptyMessage,
  terminalViewCopyFailedMessage,
  terminalViewCtxClear,
  terminalViewCtxCopy,
  terminalViewCtxCopyVisible,
  terminalViewCtxPaste,
  terminalViewCtxSelectAll,
  terminalViewFileIngestFailedMessage,
  terminalViewForceSelectionOffMessage,
  terminalViewForceSelectionOnMessage,
  terminalViewNeedSessionForFilesMessage,
  terminalViewPathsWrittenMessage,
  terminalViewProcessEnded,
  terminalViewSearchCancelButton,
  terminalViewSearchConfirmButton,
  terminalViewSearchNotFoundMessage,
  terminalViewSearchPlaceholder,
  terminalViewSearchPromptMessage,
  terminalViewSearchPromptTitle,
} from '../../composables/terminalViewCopy.js'

const props = defineProps({
  terminal: { type: Object, required: true },
  prefs: { type: Object, default: () => ({}) },
  /** 隐藏时禁止 fit，避免把 PTY 缩成几列 */
  active: { type: Boolean, default: true },
  /** shell | furnace | agent — furnace 多行粘贴不弹确认 (CP-08) */
  pasteContext: { type: String, default: 'shell' },
  /** 有值时支持拖入/粘贴文件到 inbox 并写入路径 (CP-09) */
  sessionId: { type: String, default: '' },
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
let searchAddon = null
let webglAddon = null
const forceSelection = ref(false)
const ctxMenu = ref({ open: false, x: 0, y: 0 })
// CLI-08: keeps keystroke order while a multi-line paste confirmation is open.
const sequencer = createInputSequencer()
let imeComposing = false

function closeCtxMenu() {
  ctxMenu.value.open = false
}

async function copyText(text, okMsg) {
  const t = String(text || '')
  if (!t) {
    ElMessage.info(terminalViewCopyEmptyMessage())
    return
  }
  const ok = await writeClipboardText(t)
  if (ok) ElMessage.success(okMsg || terminalViewCopiedCharsMessage(t.length))
  else ElMessage.warning(terminalViewCopyFailedMessage())
}

function ctxCopy() {
  closeCtxMenu()
  void copyText(getTerminalCopyText(xterm), terminalViewCopiedSelectionMessage())
}

async function ctxPaste() {
  closeCtxMenu()
  const text = await readClipboardText()
  if (text && isRunning.value) emit('input', text)
}

function ctxSelectAll() {
  closeCtxMenu()
  xterm?.selectAll()
}

function ctxCopyVisible() {
  closeCtxMenu()
  void copyText(copyVisibleTerminalText(xterm), terminalViewCopiedVisibleMessage())
}

function ctxClear() {
  closeCtxMenu()
  xterm?.clear()
}

function copyVisible() {
  void copyText(copyVisibleTerminalText(xterm), terminalViewCopiedVisibleMessage())
}

function scrollToBottom() {
  scrollTerminalToBottom(xterm)
}

function toggleForceSelection() {
  forceSelection.value = !forceSelection.value
  ElMessage.info(
    forceSelection.value
      ? terminalViewForceSelectionOnMessage()
      : terminalViewForceSelectionOffMessage(),
  )
}

async function emitPathPaste(text) {
  const payload = String(text || '').trim()
  if (!payload || !isRunning.value) return
  const chunks =
    payload.length > 4096 || payload.includes('\n')
      ? chunkBracketedPaste(payload)
      : [wrapBracketedPaste(payload)]
  for (const chunk of chunks) emit('input', chunk)
}

async function ingestTerminalFiles(fileList) {
  if (!props.sessionId || !isRunning.value) {
    ElMessage.warning(terminalViewNeedSessionForFilesMessage())
    return
  }
  const arr = [...fileList].filter(Boolean)
  if (!arr.length) return
  try {
    const r = await api.sessions.uploadFurnaceFiles(props.sessionId, arr)
    const paths = (r.files || []).map((f) => f.relPath || f.name).filter(Boolean)
    if (!paths.length) return
    const text = pathsToTerminalPaste(paths, {
      asAtRef: props.pasteContext === 'furnace',
    })
    await emitPathPaste(text)
    ElMessage.success(terminalViewPathsWrittenMessage(paths.length))
  } catch (e) {
    ElMessage.error(terminalViewFileIngestFailedMessage(e))
  }
}

function onHostDragOver(ev) {
  if (!props.sessionId || !isRunning.value) return
  ev.preventDefault()
}

function onHostDrop(ev) {
  if (!props.sessionId || !isRunning.value) return
  ev.preventDefault()
  const files = ev.dataTransfer?.files
  if (files?.length) void ingestTerminalFiles(files)
}

function onHostPaste(ev) {
  const files = ev.clipboardData?.files
  const text = String(ev.clipboardData?.getData('text') || '').trim()
  if (!props.sessionId || !isRunning.value || !files?.length || text) return
  ev.preventDefault()
  void ingestTerminalFiles(files)
}

async function findInTerminal() {
  try {
    const { value } = await ElMessageBox.prompt(
      terminalViewSearchPromptMessage(),
      terminalViewSearchPromptTitle(),
      {
        confirmButtonText: terminalViewSearchConfirmButton(),
        cancelButtonText: terminalViewSearchCancelButton(),
        inputPlaceholder: terminalViewSearchPlaceholder(),
      },
    )
    const q = String(value || '').trim()
    if (!q || !searchAddon) return
    const found = searchAddon.findNext(q, { caseSensitive: false })
    if (!found) ElMessage.info(terminalViewSearchNotFoundMessage())
  } catch {
    /* cancelled */
  }
}

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
    fontFamily: prefs.fontFamily || defaultTerminalPrefs().fontFamily,
    fontSize: Number(prefs.fontSize) || 13,
    lineHeight: Number(prefs.lineHeight) > 0 ? Number(prefs.lineHeight) : 1.35,
    letterSpacing: Number.isFinite(Number(prefs.letterSpacing)) ? Number(prefs.letterSpacing) : 0.2,
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
  try {
    xterm.loadAddon(
      new WebLinksAddon((_ev, uri) => {
        if (/^https?:/i.test(uri)) window.open(uri, '_blank', 'noopener')
      }),
    )
  } catch {
    /* optional */
  }
  try {
    searchAddon = new SearchAddon()
    xterm.loadAddon(searchAddon)
  } catch {
    searchAddon = null
  }
  xterm.open(host.value)
  if (prefs.renderer !== 'dom') {
    try {
      webglAddon = new WebglAddon()
      webglAddon.onContextLoss(() => {
        try {
          webglAddon?.dispose()
        } catch {
          /* ignore */
        }
        webglAddon = null
        try {
          webglAddon = new WebglAddon()
          xterm.loadAddon(webglAddon)
        } catch {
          /* fall back to canvas/DOM */
        }
      })
      xterm.loadAddon(webglAddon)
    } catch {
      webglAddon = null
    }
  }
  xterm.attachCustomKeyEventHandler((ev) => {
    if (ev.type !== 'keydown') return true
    if ((ev.ctrlKey || ev.metaKey) && String(ev.key || '').toLowerCase() === 'f') {
      ev.preventDefault()
      void findInTerminal()
      return false
    }
    if (shouldCopyInsteadOfInterrupt(xterm, ev)) {
      ev.preventDefault()
      const sel = getTerminalCopyText(xterm)
      if (sel) void copyText(sel, terminalViewCopiedCharsMessage(sel.length))
      xterm.clearSelection()
      return false
    }
    if (shouldHandlePasteShortcut(ev)) {
      void readClipboardText().then((text) => {
        if (text && isRunning.value) emit('input', text)
      })
      ev.preventDefault()
      return false
    }
    return true
  })
  host.value?.addEventListener('contextmenu', (ev) => {
    ev.preventDefault()
    const rect = host.value.getBoundingClientRect()
    ctxMenu.value = {
      open: true,
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top,
    }
  })
  host.value?.addEventListener('dragover', onHostDragOver)
  host.value?.addEventListener('drop', onHostDrop)
  host.value?.addEventListener('paste', onHostPaste)
  document.addEventListener('click', closeCtxMenu)
  xterm.textarea?.addEventListener('compositionstart', () => {
    imeComposing = true
  })
  xterm.textarea?.addEventListener('compositionend', () => {
    imeComposing = false
  })
  xterm.onData((data) => {
    if (!isRunning.value) return
    const pastePolicy = props.prefs?.pastePolicy || 'confirm'
    if (
      !shouldSkipPasteConfirmWhileComposing(imeComposing) &&
      shouldConfirmTerminalPaste({
        data,
        pastePolicy,
        pasteContext: props.pasteContext,
      })
    ) {
      const { title, message } = buildPasteConfirmMessage(data)
      sequencer.begin()
      ElMessageBox.confirm(message, title, {
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

defineExpose({
  copyVisible,
  scrollToBottom,
  findInTerminal,
  toggleForceSelection,
  forceSelection,
})

onBeforeUnmount(() => {
  host.value?.removeEventListener('dragover', onHostDragOver)
  host.value?.removeEventListener('drop', onHostDrop)
  host.value?.removeEventListener('paste', onHostPaste)
  document.removeEventListener('click', closeCtxMenu)
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
  position: relative;
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

.terminal-ctx-menu {
  position: absolute;
  z-index: 30;
  min-width: 140px;
  padding: 4px;
  border-radius: 8px;
  background: #252830;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.terminal-ctx-menu button {
  text-align: left;
  border: 0;
  background: transparent;
  color: #e7e9ee;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}

.terminal-ctx-menu button:hover {
  background: rgba(255, 255, 255, 0.08);
}

.terminal-view.force-selection::after {
  content: 'Shift+拖选复制';
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 10px;
  color: #9097a5;
  pointer-events: none;
  z-index: 5;
}
</style>
