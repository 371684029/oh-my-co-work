<template>
  <div ref="appRoot" class="ecw-layout">
    <header class="ecw-topbar">
      <div class="top-left">
        <!-- macOS 交通灯装饰（仅视觉，不绑窗口操作） -->
        <div class="traffic-lights" aria-hidden="true">
          <span class="tl tl-close" />
          <span class="tl tl-min" />
          <span class="tl tl-max" />
        </div>
        <AppLogo size="md" class="brand-logo" />
        <div class="brand-block">
          <span class="brand">oh-my-co-work</span>
          <span class="brand-sub" title="节点是死的，人是活的 — 流动的 Workflow · 终端守护者"
            >人机协同 · 万物归元 · 皆可 Workflow · <em class="brand-guard">终端守护者</em></span
          >
        </div>
        <nav class="top-nav" aria-label="主导航" data-fullscreen-control>
          <button
            type="button"
            class="nav-item"
            :class="{ active: nav === 'workbench' }"
            @click="go('workbench')"
          >
            工作台
          </button>
          <button
            type="button"
            class="nav-item"
            title="新标签打开文档中心"
            @click="openDocs"
          >
            文档
          </button>
          <button
            type="button"
            class="nav-item"
            :class="{ active: nav === 'settings' }"
            @click="go('settings')"
          >
            设置
          </button>
        </nav>
      </div>
      <div class="top-right">
        <button
          type="button"
          class="fullscreen-button"
          data-fullscreen-control
          :title="isFullscreen ? '退出工作台全屏' : '工作台全屏'"
          @click="toggleWorkbenchFullscreen"
        >
          <span class="fullscreen-icon" aria-hidden="true">{{ isFullscreen ? '↙' : '⛶' }}</span>
          <span>{{ isFullscreen ? '退出全屏' : '全屏' }}</span>
        </button>
        <span class="mvp-pill">MVP</span>
      </div>
    </header>
    <main class="ecw-main">
      <router-view />
    </main>
    <FurnaceSprite
      v-show="!furnaceWorkspaceOpen"
      :state="furnaceSpriteState"
      :title="furnaceTitle"
      @click="onFurnaceClick"
    />
    <el-dialog
      v-model="grokGuideOpen"
      title="Grok Build 教程"
      width="720px"
      class="grok-guide-dialog"
      destroy-on-close
    >
      <GrokSetupGuide :status="grokGuideStatus" :example-toml="grokExampleToml" />
      <template #footer>
        <el-button @click="grokGuideOpen = false">关闭</el-button>
        <el-button v-if="grokCanContinue" type="primary" @click="openFurnaceAnyway">打开熔炉</el-button>
        <el-button :type="grokCanContinue ? 'default' : 'primary'" @click="goGrokSettings">去设置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElNotification } from 'element-plus'
import AppLogo from './components/AppLogo.vue'
import FurnaceSprite from './components/FurnaceSprite.vue'
import GrokSetupGuide from './components/GrokSetupGuide.vue'
import {
  furnaceSpriteState,
  furnaceWorkspaceOpen,
  grokProbe,
  setGrokConfigured,
  setFurnaceGrokGate,
  grokCanRun,
  grokSetupNeeded,
} from './composables/furnaceUi.js'
import { FURNACE_DISPLAY_NAME } from '@acw/shared'
import { api } from './api'
import {
  exitFullscreen,
  fullscreenElement,
  requestFullscreen,
} from './composables/fullscreen'

const route = useRoute()
const router = useRouter()
const nav = ref(route.path.startsWith('/settings') ? 'settings' : 'workbench')
const appRoot = ref(null)
const isFullscreen = ref(false)
const grokGuideOpen = ref(false)
const grokGuideStatus = ref({})
const grokExampleToml = ref('')
const grokCanContinue = computed(() => grokCanRun(grokGuideStatus.value))
const furnaceTitle = computed(() => {
  const probe = grokProbe.value
  const gaps = probe?.gaps || []
  if (!grokCanRun(probe)) {
    if (gaps.includes('install')) return `${FURNACE_DISPLAY_NAME} · 待安装 Grok`
    if (gaps.includes('login')) return `${FURNACE_DISPLAY_NAME} · 待登录 Grok`
    if (gaps.includes('config')) return `${FURNACE_DISPLAY_NAME} · 待配置 Grok`
    return `${FURNACE_DISPLAY_NAME} · 待配置 Grok`
  }
  const st = furnaceSpriteState.value
  if (st === 'working') return `${FURNACE_DISPLAY_NAME} · 工作中`
  if (st === 'waiting') return `${FURNACE_DISPLAY_NAME} · 等人`
  return `${FURNACE_DISPLAY_NAME} · 闲置`
})

function syncFullscreenState() {
  isFullscreen.value = !!fullscreenElement()
}

async function toggleWorkbenchFullscreen() {
  const ok = fullscreenElement()
    ? await exitFullscreen()
    : await requestFullscreen(appRoot.value)
  if (!ok) ElMessage.warning('浏览器未允许进入全屏，请检查站点权限')
}

watch(
  () => route.path,
  (p) => {
    nav.value = p.startsWith('/settings') ? 'settings' : 'workbench'
  },
)

function go(v) {
  nav.value = v
  router.push(v === 'settings' ? '/settings/members' : '/workbench')
}

/** 文档中心：新开标签打开（§3.5），不导航当前工作台 */
function openDocs() {
  window.open('/docs', '_blank', 'noopener')
}

async function refreshGrokGate() {
  try {
    const [s, probe] = await Promise.all([api.appSettings.get(), api.grok.status()])
    grokGuideStatus.value = probe
    grokExampleToml.value = probe.exampleToml || ''
    setFurnaceGrokGate({ probe })
    return { s, probe }
  } catch {
    setGrokConfigured(false)
    return { s: null, probe: null }
  }
}

function openFurnaceSession() {
  const path = route.path.startsWith('/workbench') ? route.path : '/workbench'
  router.push({ path, query: { ...route.query, furnace: '1' } })
}

/** 本机已能跑 Grok 时，把熔炉成员接到 grok 命令，否则只开聊天回声 */
async function ensureFurnaceGrokWired(s, probe) {
  if (!grokCanRun(probe) || s?.grok?.configured) return s
  try {
    const next = await api.appSettings.update({
      grok: {
        command: s?.grok?.command || probe?.command || 'grok',
        configured: true,
      },
    })
    setFurnaceGrokGate({ probe })
    return next
  } catch {
    return s
  }
}

async function onFurnaceClick() {
  const { s, probe } = await refreshGrokGate()
  grokGuideStatus.value = probe || {}
  if (grokSetupNeeded(probe)) {
    grokGuideOpen.value = true
    return
  }
  grokGuideOpen.value = false
  await ensureFurnaceGrokWired(s, probe)
  try {
    await api.furnace.prepare({})
  } catch (e) {
    ElMessage.warning(e?.message || '熔炉短规则未写完，仍打开')
  }
  openFurnaceSession()
}

// 4.2.0 启动时检查更新（静默，仅发现新版本时通知）
async function startupCheckUpdate() {
  try {
    const s = await api.appSettings.get()
    if (s.updateCheck?.startup === false) return
    const r = await api.update.check()
    if (!r.checked || !r.hasUpdate) return
    const notesPreview = (r.notes || '').slice(0, 120)
    ElNotification({
      title: `发现新版本 v${r.latest}`,
      message: notesPreview
        ? `${notesPreview}${(r.notes || '').length > 120 ? '…' : ''}\n前往设置 → 关于查看详情`
        : '前往设置 → 关于查看详情',
      type: 'info',
      duration: 8000,
    })
  } catch {
    // 静默失败，不打扰用户
  }
}

async function openFurnaceAnyway() {
  grokGuideOpen.value = false
  const { s, probe } = await refreshGrokGate()
  await ensureFurnaceGrokWired(s, probe)
  try {
    await api.furnace.prepare({})
  } catch {
    /* 教程入口允许先开 */
  }
  openFurnaceSession()
}

function goGrokSettings() {
  grokGuideOpen.value = false
  router.push('/settings/prefs')
}

onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreenState)
  syncFullscreenState()
  refreshGrokGate()
  startupCheckUpdate()
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', syncFullscreenState)
})
</script>

<style scoped>
.top-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

/* macOS 红黄绿 */
.traffic-lights {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 4px 0 2px;
  flex-shrink: 0;
}

.tl {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.12);
  transition: filter 0.15s ease, transform 0.15s ease;
}

.tl-close {
  background: #ff5f57;
}
.tl-min {
  background: #febc2e;
}
.tl-max {
  background: #28c840;
}

.traffic-lights:hover .tl {
  filter: brightness(1.05);
}

.brand-logo {
  flex-shrink: 0;
}

.brand-block {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  line-height: 1.15;
}

.brand-block .brand-sub {
  border: none !important;
  padding: 0 !important;
  margin: 0 !important;
  font-size: 11px !important;
  letter-spacing: 0.01em;
  font-weight: 400 !important;
}

.brand-block .brand-guard {
  font-style: normal;
  font-weight: 700 !important;
  color: var(--ecw-accent, #007aff);
}

.top-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.fullscreen-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 5px 10px;
  border: 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.52);
  color: var(--ecw-text-2, #6e6e73);
  box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.06);
  font-size: 11.5px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    transform 0.15s ease;
}

.fullscreen-button:hover {
  background: rgba(255, 255, 255, 0.82);
  color: var(--ecw-accent, #007aff);
}

.fullscreen-button:active {
  transform: scale(0.97);
}

.fullscreen-icon {
  font-size: 14px;
  line-height: 1;
}

/* 分段控件：macOS segmented */
.top-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 14px;
  padding: 3px;
  background: rgba(0, 0, 0, 0.05);
  border: none;
  border-radius: 10px;
  box-shadow: inset 0 0.5px 1px rgba(0, 0, 0, 0.06);
}

.nav-item {
  border: none;
  background: transparent;
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ecw-text-2, #6e6e73);
  cursor: pointer;
  transition:
    background 0.18s cubic-bezier(0.25, 0.1, 0.25, 1),
    color 0.18s cubic-bezier(0.25, 0.1, 0.25, 1),
    box-shadow 0.18s cubic-bezier(0.25, 0.1, 0.25, 1),
    transform 0.15s cubic-bezier(0.25, 0.1, 0.25, 1);
  letter-spacing: -0.01em;
}

.nav-item:hover {
  color: var(--ecw-text-1, #1d1d1f);
  background: rgba(255, 255, 255, 0.45);
}

.nav-item:active {
  transform: scale(0.98);
}

.nav-item.active {
  background: #fff;
  color: var(--ecw-text-1, #1d1d1f);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 0.5px 0 rgba(0, 0, 0, 0.04);
  font-weight: 600;
}

.mvp-pill {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--ecw-accent, #007aff);
  background: rgba(0, 122, 255, 0.1);
  border: 0.5px solid rgba(0, 122, 255, 0.22);
  padding: 4px 11px;
  border-radius: 999px;
}
</style>
