import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { buildFurnacePtyAttachText, furnaceGuiTranscript, furnaceGuiReadable, takeFurnaceAssistantDelta } from '@acw/shared'
import { ElMessage } from 'element-plus'
import { api } from '../api'
import { PET_CREDIT_SHORT } from './furnacePetAtlas.js'
import { furnaceWorkspaceOpen } from './furnaceUi.js'
import { isTerminalRunning, terminalStatusText, connectionStatusText } from './terminalStatus'
import { useLocalUploads } from './localUploads'

/**
 * 熔炉干活面（GUI/TUI 同一条 grok 进程）的状态与逻辑。
 * 从 FurnaceWorkspace.vue 抽出，保持原有函数签名、时序与文案不变。
 *
 * @param {object} props 组件 props
 * @param {(name: string, ...args: any[]) => void} emit 组件 emit
 * @param {object} refs 组件侧模板 ref 与 pagefill 状态
 */
export function useFurnaceWorkspace(props, emit, refs) {
  const { surface, focused, isPagefill, logEl, tuiHistEl, fileInput, composerEl } = refs

  /** 首次进 TUI 再挂 xterm；之后用 v-show，避免每次切皮拆掉终端 */
  const tuiEverShown = ref(surface.value === 'tui')
  const draft = ref('')
  const sent = ref([])
  const chatTurns = ref([])
  const pendingFiles = ref([])
  const uploading = ref(false)
  const uploadError = ref('')
  const stickBottom = ref(true)

  const { addLocalFiles, onFileInputChange, removePending } = useLocalUploads({
    pendingFiles,
    uploading,
    getTargetId: () => props.sessionId,
    upload: (id, files) => api.sessions.uploadFurnaceFiles(id, files),
    noTargetAddMessage: '没有会话，没法上传',
    successMessage: (n) => `已放入熔炉目录 ${n} 个文件`,
    onStart: () => {
      uploadError.value = ''
    },
    onError: (e) => {
      uploadError.value = e.message || '上传失败'
      return uploadError.value
    },
  })

  const quickChips = [
    '现在做到哪了？只看当前格。',
    '当前格缺什么？',
    '过闸的话只说通过或拒绝，先告诉我卡在哪。',
  ]

  const isRunning = computed(() => isTerminalRunning(props.terminal.status))
  const isStopped = computed(() =>
    ['exited', 'failed', 'killed', 'timed_out'].includes(props.terminal.status),
  )
  const liveText = computed(() =>
    furnaceGuiTranscript(props.terminal.replay || '', {
      cols: props.terminal.cols || 120,
      rows: props.terminal.rows || 40,
      maxLines: 2000,
    }),
  )
  const showBody = computed(() => furnaceGuiReadable(liveText.value) || chatTurns.value.length > 0)
  const showFail = computed(() => isStopped.value && !showBody.value)
  const showWelcome = computed(() => !showBody.value && !showFail.value)
  const awaitingReply = computed(() => {
    if (!isRunning.value || !chatTurns.value.length) return false
    return chatTurns.value[chatTurns.value.length - 1].role === 'user'
  })
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
    const base =
      buddyMood.value === 'working'
        ? '熔炉 · 在干活'
        : buddyMood.value === 'waiting'
          ? '熔炉 · 等人'
          : '熔炉 · 闲置'
    return `${base} · ${PET_CREDIT_SHORT}`
  })

  const buddyLine = computed(() => {
    if (!isRunning.value) return '这轮停了。记录还在，可上翻。'
    if (!showBody.value) return '她准备好后会先介绍，再等你。'
    return '同一条 Grok。问当前格即可。可上翻看更早的话。'
  })

  const welcomeKicker = computed(() => {
    if (props.connectionStatus === 'connecting') return '正在连工作台…'
    if (props.terminal.status === 'starting') return '正在启动本机 grok…'
    if (isRunning.value) return '已就绪 · 短规则在 AGENTS.md'
    return '进程未在跑'
  })

  const statusText = computed(() => {
    if (props.connectionStatus !== 'open') {
      return connectionStatusText(props.connectionStatus)
    }
    return terminalStatusText(props.terminal.status, 'furnace')
  })

  const footerHint = computed(() => {
    if (!isRunning.value) return '进程已结束 · 点「新开熔炉」开空对话；返回群聊只关皮'
    if (surface.value === 'chat') {
      return isPagefill.value
        ? '对话框可上翻 · 长合同在文件里 · 模型菜单切 TUI 用键盘'
        : '已在三栏中栏 · 可再铺满页面'
    }
    if (focused.value) return 'TUI 输入中 · Esc 退出焦点 · 上方可上翻记录 · 菜单用键盘'
    if (isPagefill.value) return '再按 Esc 缩小回工作台'
    return '点 TUI 继续输入'
  })

  function nextTurnId() {
    return `${Date.now()}-${chatTurns.value.length}-${Math.random().toString(36).slice(2, 7)}`
  }

  function priorAssistantText() {
    const items = chatTurns.value
    const last = items[items.length - 1]
    return items
      .filter((t, i) => t.role === 'assistant' && !(last?.role === 'assistant' && i === items.length - 1))
      .map((t) => t.text)
      .join('\n')
  }

  function collapseDupBlocks(text) {
    const parts = String(text || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    const out = []
    for (const p of parts) {
      if (out[out.length - 1] === p) continue
      out.push(p)
    }
    return out.join('\n\n')
  }

  function stripUserEchoes(text) {
    let next = String(text || '')
    for (const item of sent.value) {
      const u = String(item.text || '').trim()
      if (!u) continue
      next = next.split(u).join('')
    }
    next = next
      .split('\n')
      .filter((line) => !/^\s*你[：:]\s*/.test(line))
      .join('\n')
    return collapseDupBlocks(next.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim())
  }

  function syncAssistantFromTranscript() {
    const text = liveText.value
    if (!furnaceGuiReadable(text)) return
    const last = chatTurns.value[chatTurns.value.length - 1]
    const body = collapseDupBlocks(stripUserEchoes(takeFurnaceAssistantDelta(text, priorAssistantText())))
    if (!body || !furnaceGuiReadable(body)) return
    if (last?.role === 'assistant') last.text = body
    else chatTurns.value.push({ id: nextTurnId(), role: 'assistant', text: body })
  }

  function scrollLog() {
    const el = logEl.value
    if (!el || !stickBottom.value) return
    el.scrollTop = el.scrollHeight
  }

  function scrollTuiHistory() {
    const el = tuiHistEl.value
    if (!el) return
    el.scrollTop = el.scrollHeight
  }

  function jumpToLatest() {
    stickBottom.value = true
    nextTick(scrollLog)
  }

  function sendChat() {
    const payload = buildFurnacePtyAttachText(draft.value, pendingFiles.value)
    if (!payload || !isRunning.value || uploading.value) return
    sent.value.push({ id: `${Date.now()}-${sent.value.length}`, text: payload })
    chatTurns.value.push({ id: nextTurnId(), role: 'user', text: payload })
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

  watch(liveText, () => {
    syncAssistantFromTranscript()
    nextTick(scrollLog)
    nextTick(scrollTuiHistory)
  })

  watch(
    () => props.terminal.id,
    () => {
      chatTurns.value = []
      sent.value = []
      nextTick(() => syncAssistantFromTranscript())
    },
  )

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
    if (surface.value === 'chat') emit('resize', { cols: 120, rows: 40 })
    syncAssistantFromTranscript()
    nextTick(scrollLog)
  })

  onUnmounted(() => {
    furnaceWorkspaceOpen.value = false
  })

  return {
    tuiEverShown,
    draft,
    chatTurns,
    pendingFiles,
    uploading,
    uploadError,
    stickBottom,
    isRunning,
    isStopped,
    statusText,
    footerHint,
    buddyMood,
    buddyTitle,
    buddyLine,
    welcomeKicker,
    failHint,
    showBody,
    showFail,
    showWelcome,
    awaitingReply,
    canSend,
    quickChips,
    addLocalFiles,
    onFileInputChange,
    removePending,
    sendChat,
    sendChip,
    jumpToLatest,
    onLogScroll,
    onDrop,
    onPaste,
    onComposerKey,
    pickFiles,
  }
}
