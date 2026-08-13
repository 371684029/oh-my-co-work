<template>
  <section class="terminal-workspace">
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
          </div>
          <span class="terminal-cwd" :title="terminal.cwd">{{ terminal.cwd || '—' }}</span>
        </div>
      </div>
      <div class="terminal-workspace-actions">
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
        @input="$emit('input', $event)"
        @resize="$emit('resize', $event)"
      />
    </div>

    <footer class="terminal-workspace-foot">
      <span>{{ terminal.runtime || 'terminal' }}</span>
      <span v-if="terminal.pid">PID {{ terminal.pid }}</span>
      <span v-if="terminal.exitCode != null">exit {{ terminal.exitCode }}</span>
      <span class="terminal-focus-hint">键盘输入将直接发送到终端 · 返回对话不会停止进程</span>
    </footer>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import TerminalView from './TerminalView.vue'

const props = defineProps({
  terminal: { type: Object, required: true },
})

defineEmits(['close', 'kill', 'input', 'resize'])

const isRunning = computed(() => ['starting', 'running'].includes(props.terminal.status))
const statusText = computed(() => {
  const map = {
    starting: '启动中',
    running: '交互中',
    exited: '已结束',
    failed: '启动失败',
    killed: '已停止',
    interrupted: '已中断',
  }
  return map[props.terminal.status] || props.terminal.status
})
</script>

<style scoped>
.terminal-workspace {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  margin: 0 12px 12px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 18px;
  background: #17191f;
  box-shadow:
    0 18px 50px rgba(15, 18, 25, 0.16),
    inset 0 1px rgba(255, 255, 255, 0.05);
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
  min-height: 58px;
  justify-content: space-between;
  gap: 14px;
  padding: 8px 12px;
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
  min-height: 30px;
  padding: 5px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.terminal-focus-hint {
  margin-left: auto;
}
</style>
