<template>
  <div ref="appRoot" class="ecw-layout" :class="{ 'reduce-effects': reduceEffects }">
    <a class="skip-link" href="#main-content">{{ t('a11y.skipToMain') }}</a>
    <header class="ecw-topbar" :class="{ 'is-docs-topbar': isDocsRoute }">
      <!-- 文档中心独立顶栏：脱离原项目结构，只留 logo + 文档中心标题 -->
      <template v-if="isDocsRoute">
        <div class="top-left docs-top-left">
          <AppLogo
            size="md"
            class="brand-logo brand-logo--clickable"
            :title="shellLogoBackWorkbenchTitle()"
            @click="goWorkbench"
          />
          <h1 class="docs-brand-title">{{ shellDocsHubTitle() }}</h1>
        </div>
        <div class="top-right docs-top-right">
          <div class="zoom-ctrl" data-fullscreen-control role="group" :aria-label="shellZoomGroupAria()">
            <button
              type="button"
              :aria-label="shellZoomOutAria()"
              :title="shellZoomOutTitle()"
              :disabled="zoom <= ZOOM_MIN"
              @click="stepZoom(-1)"
            >
              −
            </button>
            <button
              type="button"
              class="zoom-val"
              :aria-label="shellZoomResetAria()"
              :title="shellZoomResetTitle()"
              @click="setZoom(1)"
            >
              {{ Math.round(zoom * 100) }}%
            </button>
            <button
              type="button"
              :aria-label="shellZoomInAria()"
              :title="shellZoomInTitle()"
              :disabled="zoom >= ZOOM_MAX"
              @click="stepZoom(1)"
            >
              +
            </button>
          </div>
          <button type="button" class="dh-back-btn" @click="goWorkbench">
            {{ shellBackToWorkbenchLabel() }}
          </button>
          <button
            type="button"
            class="fullscreen-button"
            data-fullscreen-control
            :title="shellFullscreenTitle(isFullscreen)"
            @click="toggleWorkbenchFullscreen"
          >
            <AcwIcon
              class="fullscreen-icon"
              :name="isFullscreen ? 'fullscreen-exit' : 'fullscreen'"
              :size="16"
            />
            <span>{{ shellFullscreenLabel(isFullscreen) }}</span>
          </button>
        </div>
      </template>

      <!-- 工作台与设置：常规项目顶栏 -->
      <template v-else>
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
            <span class="brand-sub" :title="`${shellBrandTagline()} ${shellBrandGuardEmphasis()}`"
              >{{ shellBrandTagline() }} <em class="brand-guard">{{ shellBrandGuardEmphasis() }}</em></span
            >
          </div>
          <nav class="top-nav" :aria-label="shellPrimaryNavAria()" data-fullscreen-control>
            <button
              type="button"
              class="nav-item"
              :class="{ active: nav === 'workbench' }"
              @click="go('workbench')"
            >
              {{ shellNavWorkbench() }}
            </button>
            <el-popover
              placement="bottom"
              :width="280"
              trigger="hover"
              :show-after="200"
              popper-class="nav-docs-preview-pop"
            >
              <template #reference>
                <button
                  type="button"
                  class="nav-item nav-item--docs"
                  :class="{ active: nav === 'docs' }"
                  :title="shellNavDocsTitle()"
                  @click="goDocs()"
                >
                  {{ shellNavDocs() }}
                  <span v-if="flowStore.docsUnread > 0" class="nav-docs-badge">{{
                    flowStore.docsUnread > 9 ? '9+' : flowStore.docsUnread
                  }}</span>
                </button>
              </template>
              <div v-if="navDocsPreview.length" class="nav-docs-preview">
                <div class="nav-docs-preview-title">{{ shellDocsPreviewTitle() }}</div>
                <button
                  v-for="item in navDocsPreview"
                  :key="`${item.sessionId}:${item.name}`"
                  type="button"
                  class="nav-docs-preview-item"
                  @click="goDocsItem(item)"
                >
                  <span class="nav-docs-preview-name">{{ item.label || item.name }}</span>
                  <span v-if="item.sessionTitle" class="nav-docs-preview-sub">{{ item.sessionTitle }}</span>
                </button>
              </div>
              <p v-else class="nav-docs-preview-empty">{{ shellDocsPreviewEmpty() }}</p>
            </el-popover>
            <button
              type="button"
              class="nav-item"
              :class="{ active: nav === 'settings' }"
              @click="go('settings')"
            >
              {{ shellNavSettings() }}
            </button>
          </nav>
        </div>
        <div class="top-right">
          <div class="zoom-ctrl" data-fullscreen-control role="group" :aria-label="shellZoomGroupAria()">
            <button
              type="button"
              :aria-label="shellZoomOutAria()"
              :title="shellZoomOutTitle()"
              :disabled="zoom <= ZOOM_MIN"
              @click="stepZoom(-1)"
            >
              −
            </button>
            <button
              type="button"
              class="zoom-val"
              :aria-label="shellZoomResetAria()"
              :title="shellZoomResetTitle()"
              @click="setZoom(1)"
            >
              {{ Math.round(zoom * 100) }}%
            </button>
            <button
              type="button"
              :aria-label="shellZoomInAria()"
              :title="shellZoomInTitle()"
              :disabled="zoom >= ZOOM_MAX"
              @click="stepZoom(1)"
            >
              +
            </button>
          </div>
          <button
            type="button"
            class="fullscreen-button"
            data-fullscreen-control
            :title="shellWorkbenchFullscreenTitle(isFullscreen)"
            @click="toggleWorkbenchFullscreen"
          >
            <AcwIcon
              class="fullscreen-icon"
              :name="isFullscreen ? 'fullscreen-exit' : 'fullscreen'"
              :size="16"
            />
            <span>{{ shellWorkbenchFullscreenLabel(isFullscreen) }}</span>
          </button>
        </div>
      </template>
    </header>
    <main id="main-content" class="ecw-main" tabindex="-1">
      <router-view />
    </main>
    <FurnaceSprite
      v-show="showFurnaceSprite"
      :state="furnaceSpriteState"
      :title="furnaceTitle"
      :docs-notify-seq="flowStore.docsNotifySeq"
      @click="onFurnaceClick"
      @open-docs="onSpriteOpenDocs"
    />
    <el-dialog
      v-model="firstRunGuideOpen"
      :title="onboardingFirstRunTitle()"
      width="560px"
      destroy-on-close
      :aria-label="onboardingFirstRunTitle()"
    >
      <p class="first-run-lead">{{ onboardingFirstRunLead() }}</p>
      <ul class="first-run-list">
        <li>{{ onboardingFirstRunListGroup() }}</li>
        <li>{{ onboardingFirstRunListMembers() }}</li>
        <li><kbd>Ctrl/Cmd+K</kbd> {{ onboardingFirstRunListPalette() }}</li>
      </ul>
      <template #footer>
        <el-button type="primary" @click="dismissFirstRun">{{ onboardingFirstRunExplore() }}</el-button>
        <el-button @click="go('settings/wizard')">{{ onboardingFirstRunWizard() }}</el-button>
        <el-button @click="go('settings')">{{ onboardingFirstRunSettings() }}</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="grokGuideOpen"
      :title="onboardingGrokGuideTitle()"
      width="720px"
      class="grok-guide-dialog"
      destroy-on-close
      :aria-label="onboardingGrokGuideTitle()"
    >
      <GrokSetupGuide :status="grokGuideStatus" :example-toml="grokExampleToml" />
      <template #footer>
        <el-button @click="grokGuideOpen = false">{{ onboardingGrokClose() }}</el-button>
        <el-button v-if="grokCanContinue" type="primary" @click="openFurnaceAnyway">
          {{ onboardingGrokOpenFurnace() }}
        </el-button>
        <el-button :type="grokCanContinue ? 'default' : 'primary'" @click="goGrokSettings">
          {{ onboardingGrokGoSettings() }}
        </el-button>
      </template>
    </el-dialog>

    <CommandPalette v-model="paletteOpen" />
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AppLogo from './components/AppLogo.vue'
import AcwIcon from './components/icons/AcwIcon.vue'
import FurnaceSprite from './components/FurnaceSprite.vue'
import GrokSetupGuide from './components/GrokSetupGuide.vue'
import CommandPalette from './components/CommandPalette.vue'
import { useCommandPalette } from './composables/useCommandPalette.js'
import {
  furnaceSpriteState,
  grokProbe,
  grokCanRun,
  grokSetupNeeded,
} from './composables/furnaceUi.js'
import { FURNACE_DISPLAY_NAME } from '@acw/shared'
import { api } from './api'
import { t } from './i18n/index.js'
import {
  shellLogoBackWorkbenchTitle,
  shellDocsHubTitle,
  shellBackToWorkbenchLabel,
  shellZoomGroupAria,
  shellZoomOutAria,
  shellZoomOutTitle,
  shellZoomResetAria,
  shellZoomResetTitle,
  shellZoomInAria,
  shellZoomInTitle,
  shellFullscreenTitle,
  shellFullscreenLabel,
  shellWorkbenchFullscreenTitle,
  shellWorkbenchFullscreenLabel,
  shellPrimaryNavAria,
  shellNavWorkbench,
  shellNavDocs,
  shellNavDocsTitle,
  shellNavSettings,
  shellDocsPreviewTitle,
  shellDocsPreviewEmpty,
  shellBrandTagline,
  shellBrandGuardEmphasis,
} from './composables/appShellCopy.js'
import {
  onboardingFirstRunTitle,
  onboardingFirstRunLead,
  onboardingFirstRunListGroup,
  onboardingFirstRunListMembers,
  onboardingFirstRunListPalette,
  onboardingFirstRunExplore,
  onboardingFirstRunWizard,
  onboardingFirstRunSettings,
  onboardingGrokGuideTitle,
  onboardingGrokClose,
  onboardingGrokOpenFurnace,
  onboardingGrokGoSettings,
} from './composables/appOnboardingCopy.js'
import { exitFullscreen, fullscreenElement, requestFullscreen } from './composables/fullscreen'
import { useAppInit } from './composables/useAppInit.js'
import { useFlowStore } from './stores/flow.js'
import {
  readDocsReadingHistory,
  recentDocsPreview,
} from './views/docs/docsReadingHistory.js'
import {
  ZOOM_MIN,
  ZOOM_MAX,
  applyUiZoom,
  readStoredZoom,
  persistZoom,
  stepUiZoom,
  exposeUiZoomBridge,
} from './composables/uiZoom.js'
import {
  normalizeFurnacePetPolicy,
  shouldShowFurnacePet,
} from './composables/furnacePetPolicy.js'

const route = useRoute()
const { paletteOpen, showPalette, hidePalette } = useCommandPalette()
const flowStore = useFlowStore()
const navDocsPreview = ref(recentDocsPreview(readDocsReadingHistory().recent, 3))
const router = useRouter()
const nav = ref(route.path.startsWith('/settings') ? 'settings' : 'workbench')
const appRoot = ref(null)

const {
  isFullscreen,
  grokGuideOpen,
  firstRunGuideOpen,
  dismissFirstRunGuide,
  grokGuideStatus,
  grokExampleToml,
  grokCanContinue,
  refreshGrokGate,
  ensureFurnaceGrokWired,
  reduceEffects,
} = useAppInit()

function dismissFirstRun() {
  void dismissFirstRunGuide()
}

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

const zoom = ref(readStoredZoom())

function setZoom(f) {
  const v = applyUiZoom(f)
  zoom.value = v
  persistZoom(v)
}

function stepZoom(dir) {
  setZoom(stepUiZoom(zoom.value, dir))
}

if (zoom.value !== 1) applyUiZoom(zoom.value)

const isDocsRoute = computed(() => route.path.startsWith('/docs'))

const furnacePetPolicy = ref(normalizeFurnacePetPolicy())
onMounted(async () => {
  try {
    const s = await api.appSettings.get()
    furnacePetPolicy.value = normalizeFurnacePetPolicy(s?.ui?.furnacePet)
  } catch {
    /* defaults */
  }
})

const showFurnaceSprite = computed(() =>
  shouldShowFurnacePet({
    routePath: route.path,
    policy: furnacePetPolicy.value,
    terminalFullscreen: isFullscreen.value,
  }),
)

async function toggleWorkbenchFullscreen() {
  const ok = fullscreenElement()
    ? await exitFullscreen()
    : await requestFullscreen(appRoot.value)
  if (!ok) ElMessage.warning('浏览器未允许进入全屏，请检查站点权限')
}

watch(
  () => route.path,
  (p) => {
    if (p.startsWith('/settings')) nav.value = 'settings'
    else if (p.startsWith('/docs')) nav.value = 'docs'
    else nav.value = 'workbench'
  },
  { immediate: true },
)

function go(v) {
  nav.value = v
  router.push(v === 'settings' ? '/settings/members' : '/workbench')
}

function goDocs(query = {}) {
  nav.value = 'docs'
  flowStore.clearDocsUnread()
  router.push({ path: '/docs', query })
}

function goDocsItem(item) {
  if (!item?.sessionId || !item?.name) return goDocs()
  goDocs({ session: item.sessionId, file: item.name })
}

function onSpriteOpenDocs() {
  flowStore.clearDocsUnread()
  goDocs()
}

function refreshNavDocsPreview() {
  navDocsPreview.value = recentDocsPreview(readDocsReadingHistory().recent, 3)
}

watch(
  () => route.path,
  (p) => {
    if (p.startsWith('/docs')) refreshNavDocsPreview()
  },
)

function onGlobalKeydown(ev) {
  const mod = ev.metaKey || ev.ctrlKey
  if (mod && String(ev.key || '').toLowerCase() === 'k') {
    ev.preventDefault()
    if (paletteOpen.value) hidePalette()
    else showPalette()
    return
  }
  if (mod && ev.shiftKey && String(ev.key || '').toLowerCase() === 'd') {
    ev.preventDefault()
    goDocs()
    return
  }
  if (mod && (ev.key === '=' || ev.key === '+' || ev.key === '-')) {
    ev.preventDefault()
    stepZoom(ev.key === '-' ? -1 : 1)
    return
  }
  if (mod && (ev.key === '0' || ev.code === 'Digit0')) {
    ev.preventDefault()
    setZoom(1)
  }
}

onMounted(() => {
  exposeUiZoomBridge({ getZoom: () => zoom.value, setZoom })
  const api = window.__ACW_DESKTOP_API__
  api?.onZoomMenu?.((payload) => {
    if (payload?.reset) setZoom(1)
    else if (payload?.step) stepZoom(Number(payload.step))
  })
  window.addEventListener('keydown', onGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
})

function goWorkbench() {
  router.push('/workbench')
}

function openFurnaceSession() {
  const path = route.path.startsWith('/workbench') ? route.path : '/workbench'
  router.push({ path, query: { ...route.query, furnace: '1' } })
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
</script>

<style scoped>
.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 1000;
  padding: 8px 12px;
  background: #16161a;
  color: #fff;
  border-radius: 0 0 8px 0;
  text-decoration: none;
  font-size: 13px;
}
.skip-link:focus {
  left: 0;
}
.top-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.brand-logo--clickable {
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.brand-logo--clickable:hover {
  transform: scale(1.05);
  opacity: 0.9;
}

.docs-top-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.docs-brand-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--ecw-text-1, #1d1d1f);
}

.docs-top-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dh-back-btn {
  border: none;
  background: rgba(255, 255, 255, 0.65);
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 550;
  color: var(--ecw-accent, #007aff);
  box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}

.dh-back-btn:hover {
  background: rgba(255, 255, 255, 0.9);
}

.dh-back-btn:active {
  transform: scale(0.97);
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

.nav-item--docs {
  border: 1px solid rgba(0, 122, 255, 0.35);
  background: rgba(0, 122, 255, 0.06);
}

.nav-item--docs.active {
  background: rgba(0, 122, 255, 0.14);
  color: var(--ecw-accent, #007aff);
}

.nav-docs-badge {
  margin-left: 6px;
  min-width: 16px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  background: #ff3b30;
  color: #fff;
  vertical-align: middle;
}

.nav-docs-preview-title {
  font-size: var(--ecw-font-xs, 12px);
  font-weight: 700;
  color: var(--ecw-text-3, #86868b);
  margin: 0 0 6px;
}

.nav-docs-preview-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  border: none;
  background: transparent;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
}

.nav-docs-preview-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

.nav-docs-preview-name {
  font-size: var(--ecw-font-sm, 13px);
  font-weight: 600;
  color: var(--ecw-text-1, #1d1d1f);
}

.nav-docs-preview-sub {
  font-size: var(--ecw-font-xs, 12px);
  color: var(--ecw-text-3, #86868b);
}

.nav-docs-preview-empty {
  margin: 0;
  font-size: var(--ecw-font-xs, 12px);
  color: var(--ecw-text-3, #86868b);
}

.nav-item.active {
  background: #fff;
  color: var(--ecw-text-1, #1d1d1f);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 0.5px 0 rgba(0, 0, 0, 0.04);
  font-weight: 600;
}

.zoom-ctrl {
  display: inline-flex;
  align-items: center;
  margin-right: 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}
.zoom-ctrl button {
  border: 0;
  background: transparent;
  height: 24px;
  min-width: 24px;
  padding: 0 6px;
  font-size: 14px;
  line-height: 1;
  color: #444;
  cursor: pointer;
}
.zoom-ctrl button:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.06);
}
.zoom-ctrl button:disabled {
  opacity: 0.35;
  cursor: default;
}
.zoom-ctrl .zoom-val {
  font-size: 11px;
  min-width: 44px;
}
</style>
