<template>
  <article class="terminal-card" :class="`is-${terminal.status}`">
    <header class="terminal-card-head">
      <div class="terminal-card-title">
        <span class="terminal-status-dot" aria-hidden="true" />
        <span class="terminal-label">{{ terminal.label || terminalCardDefaultLabel() }}</span>
        <span class="terminal-runtime">{{ terminal.runtime || 'terminal' }}</span>
      </div>
      <span class="terminal-status">{{ statusText }}</span>
    </header>

    <section v-if="showFailure" class="terminal-failure" role="alert">
      <div class="terminal-failure-head">
        <span class="terminal-failure-icon" aria-hidden="true">⚠</span>
        <span class="terminal-failure-title">{{ terminalCardFailureTitle() }}</span>
        <button type="button" class="terminal-failure-copy" @click="copyDiagnostics">
          {{ terminalCardCopyDiagnostics() }}
        </button>
      </div>
      <p class="terminal-failure-msg">{{ failureReason || terminalCardFailureFallback() }}</p>
      <dl class="terminal-failure-meta">
        <div v-if="terminal.command" class="terminal-failure-row">
          <dt>{{ terminalCardMetaCommand() }}</dt>
          <dd>{{ terminal.command }}</dd>
        </div>
        <div v-if="terminal.cwd" class="terminal-failure-row">
          <dt>{{ terminalCardMetaCwd() }}</dt>
          <dd>{{ terminal.cwd }}</dd>
        </div>
      </dl>
    </section>

    <pre class="terminal-preview" :class="{ 'is-empty': !hasOutput }"><span
      class="terminal-preview-body"
    >{{ preview }}</span></pre>

    <footer class="terminal-card-foot">
      <span class="terminal-meta">
        <span class="terminal-card-cwd" :title="terminal.cwd">
          <AcwIcon name="folder" :size="14" /> {{ terminal.cwd || '—' }}
        </span>
        <template v-if="elapsedText">
          <span class="terminal-meta-sep">·</span>
          {{ elapsedText }}
        </template>
        <template v-if="terminal.exitCode != null"> · exit {{ terminal.exitCode }}</template>
      </span>
      <div class="terminal-actions">
        <button type="button" class="terminal-action primary" @click="$emit('open', terminal.id)">
          {{ isRunning ? terminalCardEnterTerminal() : terminalCardViewTerminal() }}
        </button>
        <button
          v-if="isRunning"
          type="button"
          class="terminal-action danger"
          @click="$emit('kill', terminal.id)"
        >
          {{ terminalCardStop() }}
        </button>
      </div>
    </footer>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { stripAnsi } from '@acw/shared'
import { isTerminalRunning, terminalStatusText } from '../../composables/terminalStatus'
import {
  terminalCardCopyDiagnostics,
  terminalCardCopyFailed,
  terminalCardDefaultLabel,
  terminalCardDiagnosticsCopied,
  terminalCardElapsedMinutes,
  terminalCardElapsedSeconds,
  terminalCardEnterTerminal,
  terminalCardFailureFallback,
  terminalCardFailureTitle,
  terminalCardMetaCommand,
  terminalCardMetaCwd,
  terminalCardPreviewIdle,
  terminalCardStatusUnknown,
  terminalCardStop,
  terminalCardViewTerminal,
} from '../../composables/terminalSessionCardCopy.js'
import AcwIcon from '../icons/AcwIcon.vue'

const props = defineProps({
  terminal: { type: Object, required: true },
})

defineEmits(['open', 'kill'])

// 预览保留的最大行数：足够铺满放大后的卡片，超出部分进全屏终端看
const PREVIEW_LINES = 40

const isRunning = computed(() => isTerminalRunning(props.terminal.status))

const statusText = computed(
  () => terminalStatusText(props.terminal.status, 'card') || terminalCardStatusUnknown(),
)

// CLI-05: surface the real failure reason + command/cwd instead of leaving it
// buried in the replay, plus a copyable diagnostic blob.
const failureReason = computed(() =>
  String(props.terminal.lastError || props.terminal.error?.message || ''),
)
const showFailure = computed(
  () => props.terminal.status === 'failed' || !!props.terminal.lastError,
)

function diagnosticText() {
  const t = props.terminal
  return [
    `label: ${t.label || ''}`,
    `runtime: ${t.runtime || ''}`,
    `command: ${t.command || ''}`,
    `cwd: ${t.cwd || ''}`,
    `status: ${t.status || ''}`,
    `exitCode: ${t.exitCode ?? ''}`,
    `error: ${t.lastError || ''}`,
    `at: ${new Date().toISOString()}`,
  ].join('\n')
}

async function copyDiagnostics() {
  const text = diagnosticText()
  try {
    if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      ElMessage.success(terminalCardDiagnosticsCopied())
      return
    }
  } catch {
    /* fall through to the execCommand path */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    ElMessage.success(terminalCardDiagnosticsCopied())
  } catch {
    ElMessage.error(terminalCardCopyFailed())
  }
}

const previewLines = computed(() =>
  stripAnsi(props.terminal.previewReplay || props.terminal.replay)
    .split('\n')
    .filter((line) => line.trim()),
)

const hasOutput = computed(() => previewLines.value.length > 0)

const preview = computed(
  () => previewLines.value.slice(-PREVIEW_LINES).join('\n') || terminalCardPreviewIdle(),
)

const elapsedText = computed(() => {
  const start = Date.parse(props.terminal.startedAt || '')
  const end = Date.parse(props.terminal.finishedAt || '') || Date.now()
  // 底栏已单独渲染 cwd，这里缺开始时间时直接留空，避免目录被打印两次
  if (!Number.isFinite(start)) return ''
  const seconds = Math.max(0, Math.round((end - start) / 1000))
  if (seconds < 60) return terminalCardElapsedSeconds(seconds)
  const minutes = Math.floor(seconds / 60)
  return terminalCardElapsedMinutes(minutes, seconds % 60)
})
</script>

<style scoped>
.terminal-card {
  width: min(1080px, 100%);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 16px;
  background:
    radial-gradient(circle at 85% -20%, rgba(64, 158, 255, 0.17), transparent 45%),
    linear-gradient(145deg, #20232b 0%, #17191f 100%);
  color: #e7e9ee;
  box-shadow:
    0 14px 36px rgba(15, 18, 25, 0.18),
    inset 0 1px rgba(255, 255, 255, 0.04);
}

.terminal-card-head,
.terminal-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 12px;
}

.terminal-card-head {
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.terminal-card-title,
.terminal-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.terminal-status-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #8b919e;
  box-shadow: 0 0 0 3px rgba(139, 145, 158, 0.12);
}

.is-running .terminal-status-dot,
.is-starting .terminal-status-dot {
  background: #56d68b;
  box-shadow: 0 0 0 3px rgba(86, 214, 139, 0.14);
  animation: terminal-pulse 1.8s ease-in-out infinite;
}

.is-failed .terminal-status-dot {
  background: #ff6b6b;
}

.terminal-label {
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.terminal-runtime,
.terminal-status,
.terminal-meta {
  font-size: 10.5px;
  color: #959ba8;
}

.terminal-runtime {
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.07);
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
}

.terminal-failure {
  margin: 8px 12px 0;
  padding: 9px 11px;
  border: 1px solid rgba(255, 107, 107, 0.35);
  border-radius: 10px;
  background: rgba(255, 107, 107, 0.1);
}

.terminal-failure-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.terminal-failure-icon {
  color: #ff6b6b;
  font-size: 13px;
}

.terminal-failure-title {
  font-size: 12px;
  font-weight: 700;
  color: #ff9a9a;
}

.terminal-failure-copy {
  margin-left: auto;
  border: 0;
  border-radius: 7px;
  padding: 3px 8px;
  background: rgba(255, 255, 255, 0.1);
  color: #ffd0d0;
  font-size: 10.5px;
  cursor: pointer;
}

.terminal-failure-copy:hover {
  background: rgba(255, 255, 255, 0.18);
}

.terminal-failure-msg {
  margin: 0 0 6px;
  color: #f2c0c0;
  font-size: 12px;
  line-height: 1.45;
  word-break: break-word;
}

.terminal-failure-meta {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.terminal-failure-row {
  display: flex;
  gap: 6px;
  font-size: 10.5px;
  color: #b9a2a5;
}

.terminal-failure-row dt {
  flex: 0 0 auto;
  opacity: 0.75;
}

.terminal-failure-row dd {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
}

.terminal-preview {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  height: clamp(260px, 46vh, 620px);
  margin: 0;
  overflow: hidden;
  padding: 10px 12px;
  color: #cdd2dc;
  font-family: ui-monospace, 'SFMono-Regular', 'Cascadia Code', Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 无输出时不撑出一整块纯黑：收成一行提示 */
.terminal-preview.is-empty {
  height: auto;
  min-height: 46px;
  justify-content: center;
  color: #7f8693;
  font-style: italic;
}

.terminal-preview-body {
  display: block;
}

.terminal-card-cwd {
  overflow: hidden;
  max-width: 46%;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
}

.terminal-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.terminal-meta-sep {
  opacity: 0.5;
}

.terminal-card-foot {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.terminal-action {
  border: 0;
  border-radius: 8px;
  padding: 5px 9px;
  background: rgba(255, 255, 255, 0.08);
  color: #cfd4de;
  font-size: 11px;
  cursor: pointer;
}

.terminal-action:hover {
  background: rgba(255, 255, 255, 0.14);
}

.terminal-action.primary {
  background: rgba(64, 158, 255, 0.18);
  color: #8fc5ff;
}

.terminal-action.danger {
  color: #ff9494;
}

@keyframes terminal-pulse {
  50% {
    box-shadow: 0 0 0 5px rgba(86, 214, 139, 0.06);
  }
}
</style>
