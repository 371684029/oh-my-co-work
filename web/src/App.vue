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
          <span class="brand-sub" title="节点是死的，人是活的 — 流动的 Workflow"
            >人机协同 · 万物归元 · 皆可 Workflow</span
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
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AppLogo from './components/AppLogo.vue'
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

onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreenState)
  syncFullscreenState()
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
