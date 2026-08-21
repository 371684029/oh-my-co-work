<template>
  <Teleport to="body" :disabled="!isPagefill">
    <section
      ref="workspaceRoot"
      class="furnace-workspace"
      :class="{ 'is-pagefill': isPagefill, 'is-chat': surface === 'chat' }"
    >
      <header class="furnace-head">
        <div class="furnace-leading">
          <button
            type="button"
            class="furnace-btn"
            title="关掉这层皮，回到群聊。Grok 进程还在，对话也会继续堆；要清上下文请关熔炉或新开。"
            @click="$emit('close')"
          >
            返回群聊
          </button>
          <span class="furnace-divider" />
          <div class="furnace-identity">
            <strong>熔炉</strong>
            <span class="furnace-state">{{ statusText }}</span>
          </div>
        </div>
        <div class="furnace-actions">
          <button
            type="button"
            class="furnace-btn"
            :class="{ on: surface === 'chat' }"
            title="GUI：可读正文 + 底部输入；模型菜单请用 TUI"
            @click="surface = 'chat'"
          >
            GUI
          </button>
          <button
            type="button"
            class="furnace-btn"
            :class="{ on: surface === 'tui' }"
            title="TUI：原 Grok 终端"
            @click="surface = 'tui'"
          >
            TUI
          </button>
          <button
            type="button"
            class="furnace-btn"
            :title="
              isPagefill
                ? '缩小到工作台三栏，熔炉仍在中间'
                : '铺满整个页面'
            "
            @click="togglePagefill"
          >
            {{ isPagefill ? '缩小到三栏' : '铺满页面' }}
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
          <details class="furnace-more">
            <summary class="furnace-btn" title="关掉或新开 Grok 进程；返回群聊只关皮">进程</summary>
            <div class="furnace-more-menu">
              <button type="button" class="furnace-more-item" @click="$emit('reopen')">新开熔炉</button>
              <button
                v-if="isRunning"
                type="button"
                class="furnace-more-item danger"
                @click="$emit('close-furnace')"
              >
                关闭熔炉
              </button>
            </div>
          </details>
        </div>
      </header>

      <div v-show="surface === 'chat'" class="furnace-chat">
        <div ref="logEl" class="furnace-log" @scroll.passive="onLogScroll">
          <aside class="furnace-buddy">
            <FurnaceAvatar size="lg" :mood="buddyMood" :live="isRunning" :title="buddyTitle" />
            <p class="furnace-buddy-line">{{ buddyLine }}</p>
          </aside>
          <div class="furnace-log-main">
            <div v-if="showFail" class="furnace-welcome is-fail">
              <p class="furnace-welcome-kicker">{{ welcomeKicker }}</p>
              <h3>Grok 没在跑，所以这里是空的</h3>
              <p>{{ failHint }}</p>
              <ul>
                <li>先确认本机终端能直接运行 <code>grok</code>（已安装并在 PATH 里）</li>
                <li>Windows 运行包请关掉窗口后重开，让新 PATH 生效</li>
                <li>聊太长、模型发懵时点「新开熔炉」：杀掉这条 Grok，再开一条空对话</li>
              </ul>
              <div class="furnace-chips">
                <button type="button" class="furnace-chip" @click="surface = 'tui'">看 TUI 报错</button>
                <button type="button" class="furnace-chip" @click="$emit('reopen')">新开熔炉</button>
                <button type="button" class="furnace-chip" @click="$emit('close')">返回群聊</button>
              </div>
            </div>
            <div v-else-if="showWelcome" class="furnace-welcome">
              <p class="furnace-welcome-kicker">{{ welcomeKicker }}</p>
              <h3>本机 Grok 已接进协同台</h3>
              <p>
                同一条进程：这里读回答，菜单和模型在 TUI。细节在工作目录
                <code>AGENTS.md</code> / <code>ACTIVE.md</code>，不用整段粘贴。聊太长就「新开熔炉」。
              </p>
              <ul>
                <li>问这场群<strong>现在做到哪</strong>、当前格缺什么</li>
                <li>让她<strong>适配</strong>：把当前成员或步骤接到工作台</li>
                <li>过闸时只说<strong>通过或拒绝</strong>，不要改编排</li>
                <li>附件落到 <code>inbox/</code>，发送时写成一行相对路径再回车</li>
              </ul>
              <div class="furnace-chips">
                <button
                  v-for="chip in quickChips"
                  :key="chip"
                  type="button"
                  class="furnace-chip"
                  :disabled="!isRunning"
                  @click="sendChip(chip)"
                >
                  {{ chip }}
                </button>
              </div>
            </div>
            <div v-if="showBody" class="screen">
              <span class="bubble-label">Grok · 可读正文</span>
              <pre>{{ liveText }}</pre>
            </div>
          </div>
        </div>
        <div v-if="sent.length" class="furnace-sent">
          <span class="furnace-sent-label">已写入进程</span>
          <span v-for="item in sent.slice(-3)" :key="item.id" class="furnace-sent-chip">{{
            item.text
          }}</span>
        </div>
        <form
          class="furnace-composer"
          @submit.prevent="sendChat"
          @dragover.prevent
          @drop.prevent="onDrop"
        >
          <input
            ref="fileInput"
            type="file"
            multiple
            class="furnace-file-input"
            @change="onFileInputChange"
          />
          <div class="furnace-compose-main">
            <textarea
              ref="composerEl"
              v-model="draft"
              rows="3"
              :disabled="!isRunning"
              placeholder="问进度、适配或过闸… Enter 发送，Shift+Enter 换行"
              @keydown="onComposerKey"
              @paste="onPaste"
            />
            <div v-if="pendingFiles.length" class="furnace-pending">
              <span
                v-for="(f, i) in pendingFiles"
                :key="f.id || f.relPath"
                class="furnace-pending-chip"
              >
                {{ f.name }}
                <button type="button" title="去掉" @click="removePending(i)">×</button>
              </span>
            </div>
            <div class="furnace-compose-bar">
              <button
                type="button"
                class="furnace-btn"
                :disabled="!isRunning || uploading || !sessionId"
                title="文件落到熔炉工作目录 inbox/；发送时把相对路径写成一行写进 grok，不是官方附件通道"
                @click="pickFiles"
              >
                {{ uploading ? '上传中…' : '附件' }}
              </button>
              <span v-if="uploadError" class="furnace-upload-err">{{ uploadError }}</span>
              <span class="furnace-compose-hint">同一条 grok · 菜单请切 TUI · 附件最多 8 个</span>
            </div>
          </div>
          <button type="submit" class="furnace-send" :disabled="!canSend">发送</button>
        </form>
      </div>

      <div v-if="tuiEverShown" v-show="surface === 'tui'" class="furnace-tui">
        <TerminalView
          :key="terminal.id"
          :terminal="terminal"
          :prefs="prefs"
          :active="surface === 'tui'"
          @input="$emit('input', $event)"
          @resize="$emit('resize', $event)"
          @gap="$emit('gap', $event)"
          @focus-change="onFocusChange"
        />
      </div>

      <footer class="furnace-foot">
        <span>{{ isPagefill ? '铺满页面' : '三栏中栏' }} · {{ surface === 'chat' ? 'GUI' : 'TUI' }}</span>
        <span v-if="terminal.cwd" class="furnace-cwd" :title="terminal.cwd">{{ terminal.cwd }}</span>
        <span>{{ footerHint }}</span>
      </footer>
    </section>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { buildFurnacePtyAttachText, furnaceGuiTranscript, furnaceGuiReadable } from '@acw/shared'
import { ElMessage } from 'element-plus'
import { api } from '../../api'
import FurnaceAvatar from '../FurnaceAvatar.vue'
import TerminalView from './TerminalView.vue'
import {
  exitFullscreen,
  fullscreenElement,
  requestFullscreen,
} from '../../composables/fullscreen'
import { furnaceWorkspaceOpen } from '../../composables/furnaceUi.js'

const props = defineProps({
  terminal: { type: Object, required: true },
  terminals: { type: Array, default: () => [] },
  connectionStatus: { type: String, default: 'open' },
  prefs: { type: Object, default: () => ({}) },
  defaultPagefill: { type: Boolean, default: true },
  defaultSurface: { type: String, default: 'chat' },
  sessionId: { type: String, default: '' },
})

const emit = defineEmits(['close', 'kill', 'close-furnace', 'reopen', 'input', 'resize', 'select', 'download-log', 'gap'])

const workspaceRoot = ref(null)
const logEl = ref(null)
const isFullscreen = ref(false)
const isPagefill = ref(props.defaultPagefill !== false)
const surface = ref(props.defaultSurface === 'tui' ? 'tui' : 'chat')
/** 首次进 TUI 再挂 xterm；之后用 v-show，避免每次切皮拆掉终端 */
const tuiEverShown = ref(surface.value === 'tui')
const focused = ref(false)
const draft = ref('')
const sent = ref([])
const pendingFiles = ref([])
const uploading = ref(false)
const uploadError = ref('')
const fileInput = ref(null)
const composerEl = ref(null)
const stickBottom = ref(true)

const quickChips = [
  '现在做到哪了？只看当前格。',
  '当前格缺什么？',
  '过闸的话只说通过或拒绝，先告诉我卡在哪。',
]

const isRunning = computed(() => ['starting', 'running'].includes(props.terminal.status))
const isStopped = computed(() =>
  ['exited', 'failed', 'killed', 'timed_out'].includes(props.terminal.status),
)
const liveText = computed(() =>
  furnaceGuiTranscript(props.terminal.replay || '', {
    cols: props.terminal.cols || 120,
    rows: props.terminal.rows || 40,
    maxLines: 40,
  }),
)
const showBody = computed(() => furnaceGuiReadable(liveText.value))
const showFail = computed(() => isStopped.value && !showBody.value)
const showWelcome = computed(() => !showBody.value && !showFail.value)
const failHint = computed(() => {
  const err = String(props.terminal.lastError || props.terminal.error?.message || '').trim()
  if (err) return err
  if (props.terminal.status === 'failed') {
    return '本机没有把 grok 跑起来。常见原因：没装 Grok、没进 PATH、或还没登录。'
  }
  if (props.terminal.exitCode != null && Number(props.terminal.exitCode) !== 0) {
    return `进程已退出（exit ${props.terminal.exitCode}）。`
  }
  return '这轮已经停了，所以没有新画面，也不能往进程里打字。'
})
const canSend = computed(
  () =>
    isRunning.value &&
    !uploading.value &&
    (!!draft.value.trim() || pendingFiles.value.length > 0),
)

/** 干活面换表情：交互中用工作态，等人/结束用等待态，其余闲置 */
const buddyMood = computed(() => {
  const st = String(props.terminal.status || '')
  if (st === 'running') return 'working'
  if (st === 'starting' || props.connectionStatus === 'connecting') return 'idle'
  if (['exited', 'failed', 'killed'].includes(st) || props.connectionStatus !== 'open') {
    return 'waiting'
  }
  return 'idle'
})

const buddyTitle = computed(() => {
  if (buddyMood.value === 'working') return '熔炉 · 在干活'
  if (buddyMood.value === 'waiting') return '熔炉 · 等人'
  return '熔炉 · 闲置'
})

const buddyLine = computed(() => {
  if (!isRunning.value) return '这轮停了。记录还在。'
  if (!showBody.value) return '她准备好后会先介绍，再等你。'
  return '同一条 Grok。问当前格即可。'
})

const welcomeKicker = computed(() => {
  if (props.connectionStatus === 'connecting') return '正在连工作台…'
  if (props.terminal.status === 'starting') return '正在启动本机 grok…'
  if (isRunning.value) return '已就绪 · 短规则在 AGENTS.md'
  return '进程未在跑'
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
  }
  return map[props.terminal.status] || props.terminal.status
})

const footerHint = computed(() => {
  if (!isRunning.value) return '进程已结束 · 点「新开熔炉」开空对话；返回群聊只关皮'
  if (surface.value === 'chat') {
    return isPagefill.value
      ? '可读正文 · 长合同在文件里 · 菜单请切 TUI'
      : '已在三栏中栏 · 可再铺满页面'
  }
  if (focused.value) return 'TUI 输入中 · Esc 退出焦点'
  if (isPagefill.value) return '再按 Esc 缩小回工作台'
  return '点 TUI 继续输入'
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
  const payload = buildFurnacePtyAttachText(draft.value, pendingFiles.value)
  if (!payload || !isRunning.value || uploading.value) return
  sent.value.push({ id: `${Date.now()}-${sent.value.length}`, text: payload })
  emit('input', `${payload}\r`)
  draft.value = ''
  pendingFiles.value = []
  stickBottom.value = true
  nextTick(scrollLog)
}

function sendChip(text) {
  draft.value = text
  if (showBody.value) sendChat()
  else nextTick(() => composerEl.value?.focus?.())
}

function onLogScroll() {
  const el = logEl.value
  if (!el) return
  stickBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 64
}

function pickFiles() {
  if (!props.sessionId) {
    ElMessage.warning('没有会话，没法落到熔炉目录')
    return
  }
  fileInput.value?.click()
}

function removePending(i) {
  pendingFiles.value.splice(i, 1)
}

async function addLocalFiles(fileList) {
  uploadError.value = ''
  if (!props.sessionId) {
    ElMessage.warning('没有会话，没法上传')
    return
  }
  const arr = [...fileList].filter(Boolean)
  if (!arr.length) return
  if (pendingFiles.value.length + arr.length > 8) {
    ElMessage.warning('一次最多 8 个附件')
    return
  }
  uploading.value = true
  try {
    const r = await api.sessions.uploadFurnaceFiles(props.sessionId, arr)
    const files = r.files || []
    pendingFiles.value = [...pendingFiles.value, ...files]
    ElMessage.success(`已放入熔炉目录 ${files.length} 个文件`)
  } catch (e) {
    uploadError.value = e.message || '上传失败'
    ElMessage.error(uploadError.value)
  } finally {
    uploading.value = false
  }
}

function onFileInputChange(e) {
  const files = e.target?.files
  if (files?.length) addLocalFiles(files)
  if (e.target) e.target.value = ''
}

function onPaste(ev) {
  const files = ev.clipboardData?.files
  const text = String(ev.clipboardData?.getData('text') || '')
  if (files?.length && !text.trim()) {
    ev.preventDefault()
    addLocalFiles(files)
  }
}

function onDrop(ev) {
  const files = ev.dataTransfer?.files
  if (files?.length) addLocalFiles(files)
}

function onComposerKey(ev) {
  if (ev.key !== 'Enter' || ev.shiftKey) return
  if (ev.isComposing || ev.keyCode === 229) return
  ev.preventDefault()
  sendChat()
}

function scrollLog() {
  const el = logEl.value
  if (!el || !stickBottom.value) return
  el.scrollTop = el.scrollHeight
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
  if (mode === 'tui') tuiEverShown.value = true
  if (mode === 'chat') {
    emit('resize', { cols: 120, rows: 40 })
    nextTick(() => composerEl.value?.focus?.())
  }
  nextTick(() => window.dispatchEvent(new Event('resize')))
})

watch(
  () => [isStopped.value, showBody.value],
  () => {
    if (isStopped.value && !showBody.value) surface.value = 'chat'
  },
  { immediate: true },
)

watch(isRunning, (on) => {
  if (on && surface.value === 'chat') {
    nextTick(() => composerEl.value?.focus?.())
  }
})

onMounted(() => {
  furnaceWorkspaceOpen.value = true
  document.addEventListener('fullscreenchange', syncFullscreenState)
  document.addEventListener('keydown', onKeydown)
  syncFullscreenState()
  if (isPagefill.value) document.documentElement.classList.add('acw-terminal-pagefill')
  if (surface.value === 'chat') emit('resize', { cols: 120, rows: 40 })
  nextTick(scrollLog)
})

onUnmounted(() => {
  furnaceWorkspaceOpen.value = false
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

.furnace-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}

.furnace-leading {
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

.furnace-more {
  position: relative;
}

.furnace-more summary {
  list-style: none;
}

.furnace-more summary::-webkit-details-marker {
  display: none;
}

.furnace-more-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 5;
  min-width: 132px;
  padding: 4px;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(20, 16, 28, 0.16);
}

.furnace-workspace:not(.is-chat) .furnace-more-menu {
  background: #2a2d36;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.furnace-more-item {
  display: block;
  width: 100%;
  border: 0;
  border-radius: 8px;
  padding: 7px 10px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.furnace-more-item:hover {
  background: rgba(0, 0, 0, 0.06);
}

.furnace-workspace:not(.is-chat) .furnace-more-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.furnace-more-item.danger {
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
  padding: 20px 6% 12px;
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  gap: 20px 16px;
  align-items: start;
}

.furnace-buddy {
  position: sticky;
  top: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.furnace-buddy-line {
  margin: 0;
  max-width: 7.5rem;
  font-size: 11px;
  line-height: 1.45;
  color: #6e6e73;
}

.furnace-log-main {
  min-width: 0;
}

.furnace-empty {
  color: #6e6e73;
  font-size: 14px;
  line-height: 1.6;
  max-width: 52rem;
  margin: 8vh 0 0;
}

.furnace-welcome {
  max-width: 40rem;
  margin: 4vh 0 0;
  padding: 18px 20px 16px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 1px 10px rgba(0, 0, 0, 0.06);
  color: #1d1d1f;
}

.furnace-welcome.is-fail {
  background: #fff6f6;
  box-shadow: 0 1px 10px rgba(255, 59, 48, 0.08);
}

.furnace-welcome-kicker {
  margin: 0 0 6px;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: #6e6e73;
}

.furnace-welcome h3 {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.furnace-welcome p,
.furnace-welcome li {
  font-size: 14px;
  line-height: 1.65;
  color: #3a3a40;
}

.furnace-welcome p {
  margin: 0 0 10px;
}

.furnace-welcome ul {
  margin: 0 0 14px;
  padding-left: 1.15rem;
}

.furnace-welcome code {
  font-size: 12px;
  padding: 1px 5px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.05);
}

.furnace-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.furnace-chip {
  border: 0;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  background: rgba(0, 122, 255, 0.1);
  color: #007aff;
}

.furnace-chip:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.screen {
  max-width: min(56rem, 100%);
  margin: 0 auto 16px;
}

.bubble-label {
  display: block;
  font-size: 11px;
  font-weight: 650;
  color: #6e6e73;
  margin-bottom: 6px;
}

.screen pre {
  margin: 0;
  padding: 16px 18px;
  border-radius: 16px;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
  font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', ui-sans-serif, system-ui, sans-serif;
  font-size: 15px;
  line-height: 1.7;
  background: #fff;
  color: #1d1d1f;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
}

.furnace-sent {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 8% 0;
}

.furnace-sent-label {
  font-size: 11px;
  color: #6e6e73;
  flex-shrink: 0;
}

.furnace-sent-chip {
  max-width: 28rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(0, 122, 255, 0.1);
  color: #007aff;
}

.furnace-composer {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  padding: 12px 8% 16px;
  background: rgba(255, 255, 255, 0.92);
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.furnace-file-input {
  display: none;
}

.furnace-compose-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.furnace-composer textarea {
  flex: 1;
  width: 100%;
  resize: none;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 14px;
  padding: 12px 14px;
  font: inherit;
  font-size: 15px;
  min-height: 72px;
  box-sizing: border-box;
}

.furnace-pending {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.furnace-pending-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 16rem;
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
}

.furnace-pending-chip button {
  border: 0;
  background: transparent;
  cursor: pointer;
  color: #6e6e73;
  font-size: 14px;
  line-height: 1;
  padding: 0;
}

.furnace-compose-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.furnace-compose-hint,
.furnace-upload-err {
  font-size: 11px;
  color: #6e6e73;
}

.furnace-upload-err {
  color: #ff3b30;
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

@media (max-width: 820px) {
  .furnace-log {
    grid-template-columns: minmax(0, 1fr);
  }

  .furnace-buddy {
    position: static;
    flex-direction: row;
    text-align: left;
    max-width: none;
  }
}
</style>
