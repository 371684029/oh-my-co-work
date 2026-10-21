<template>
  <div class="furnace-head-root" :class="{ 'is-dark': !isChatSurface }">
    <header class="furnace-head">
      <div class="furnace-leading">
        <button
          type="button"
          class="furnace-btn"
          :title="furnaceBackToChatTitle()"
          @click="$emit('close')"
        >
          {{ furnaceBackToChatLabel() }}
        </button>
        <span class="furnace-divider" aria-hidden="true" />
        <div class="furnace-agent-tabs" role="tablist" :aria-label="furnaceAgentTabsAria()">
          <button
            type="button"
            role="tab"
            class="furnace-agent-tab"
            :class="{ active: activeAgent === 'grok' }"
            :aria-selected="activeAgent === 'grok'"
            :title="furnaceAgentGrokTitle()"
            @click="$emit('select-agent', 'grok')"
          >
            <span class="agent-dot grok" aria-hidden="true" />
            {{ furnaceAgentGrokTabLabel() }}
          </button>
          <button
            type="button"
            role="tab"
            class="furnace-agent-tab"
            :class="{ active: activeAgent === 'cursor' }"
            :aria-selected="activeAgent === 'cursor'"
            :title="furnaceAgentCursorTitle()"
            @click="$emit('select-agent', 'cursor')"
          >
            <span class="agent-dot cursor" aria-hidden="true" />
            {{ furnaceAgentCursorTabLabel() }}
          </button>
        </div>
        <div class="furnace-identity">
          <span class="furnace-state">{{ statusText }}</span>
        </div>
      </div>
      <div class="furnace-actions">
        <button
          v-if="guiEnabled"
          type="button"
          class="furnace-btn"
          :class="{ on: surface === 'chat' }"
          :title="furnaceGuiModeTitle()"
          @click="$emit('update:surface', 'chat')"
        >
          {{ furnaceGuiLabel() }}
        </button>
        <button
          v-if="guiEnabled"
          type="button"
          class="furnace-btn"
          :class="{ on: surface === 'tui' }"
          :title="furnaceTuiModeTitle()"
          @click="$emit('update:surface', 'tui')"
        >
          {{ furnaceTuiLabel() }}
        </button>
        <button
          type="button"
          class="furnace-btn"
          :title="furnacePagefillTitle(isPagefill)"
          @click="$emit('toggle-pagefill')"
        >
          {{ furnacePagefillLabel(isPagefill) }}
        </button>
        <button
          type="button"
          class="furnace-btn"
          data-fullscreen-control
          :title="furnaceBrowserFullscreenTitle(isFullscreen)"
          @click="$emit('toggle-fullscreen')"
        >
          {{ furnaceFullscreenLabel(isFullscreen) }}
        </button>
        <details class="furnace-more">
          <summary class="furnace-btn" :title="furnaceProcessMenuTitle()">{{ furnaceProcessMenuSummary() }}</summary>
          <div class="furnace-more-menu">
            <button
              type="button"
              class="furnace-more-item"
              @click="$emit('reopen', { agent: activeAgent })"
            >
              {{ furnaceReopenLabel() }}
            </button>
            <button
              v-if="isRunning"
              type="button"
              class="furnace-more-item danger"
              @click="$emit('close-furnace')"
            >
              {{ furnaceCloseFurnaceLabel() }}
            </button>
          </div>
        </details>
      </div>
    </header>
    <div
      v-if="cliBanner"
      class="furnace-cli-banner"
      :class="`is-${cliBanner.kind}`"
      role="status"
    >
      <strong>{{ cliBanner.title }}</strong>
      <span>{{ cliBanner.hint }}</span>
    </div>
  </div>
</template>

<script setup>
import {
  furnaceAgentCursorTabLabel,
  furnaceAgentCursorTitle,
  furnaceAgentGrokTabLabel,
  furnaceAgentGrokTitle,
  furnaceAgentTabsAria,
  furnaceBackToChatLabel,
  furnaceBackToChatTitle,
  furnaceBrowserFullscreenTitle,
  furnaceCloseFurnaceLabel,
  furnaceFullscreenLabel,
  furnaceGuiLabel,
  furnaceGuiModeTitle,
  furnacePagefillLabel,
  furnacePagefillTitle,
  furnaceProcessMenuSummary,
  furnaceProcessMenuTitle,
  furnaceReopenLabel,
  furnaceTuiLabel,
  furnaceTuiModeTitle,
} from '../../composables/furnaceWorkspaceCopy.js'

defineProps({
  surface: { type: String, default: 'tui' },
  activeAgent: { type: String, default: 'grok' },
  guiEnabled: { type: Boolean, default: false },
  statusText: { type: String, default: '' },
  cliBanner: { type: Object, default: null },
  isPagefill: { type: Boolean, default: false },
  isFullscreen: { type: Boolean, default: false },
  isRunning: { type: Boolean, default: false },
  isChatSurface: { type: Boolean, default: false },
})

defineEmits([
  'close',
  'close-furnace',
  'reopen',
  'select-agent',
  'update:surface',
  'toggle-pagefill',
  'toggle-fullscreen',
])
</script>

<style scoped>
.furnace-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.9);
}

.furnace-head-root.is-dark .furnace-head {
  background: linear-gradient(180deg, #23262e, #1e2128);
  color: #cfd4de;
  border-color: rgba(255, 255, 255, 0.07);
}

.furnace-cli-banner {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: baseline;
  margin: 0 12px 8px;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.45;
  background: rgba(64, 158, 255, 0.1);
  border: 1px solid rgba(64, 158, 255, 0.25);
}

.furnace-cli-banner.is-error {
  background: rgba(245, 108, 108, 0.12);
  border-color: rgba(245, 108, 108, 0.35);
}

.furnace-cli-banner.is-auth,
.furnace-cli-banner.is-approval {
  background: rgba(230, 162, 60, 0.12);
  border-color: rgba(230, 162, 60, 0.35);
}

.furnace-cli-banner strong {
  font-size: 12px;
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

.furnace-divider {
  width: 1px;
  height: 18px;
  background: rgba(0, 0, 0, 0.12);
  flex-shrink: 0;
}

.furnace-head-root.is-dark .furnace-divider {
  background: rgba(255, 255, 255, 0.12);
}

.furnace-agent-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.08);
  padding: 3px;
  border-radius: 10px;
}

.furnace-head-root.is-dark .furnace-agent-tabs {
  background: rgba(255, 255, 255, 0.08);
}

.furnace-agent-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  border-radius: 7px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 550;
  background: transparent;
  color: #8b90a0;
  cursor: pointer;
  transition: all 0.15s ease;
}

.furnace-agent-tab.active {
  background: #fff;
  color: #1d1d1f;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

.furnace-head-root.is-dark .furnace-agent-tab.active {
  background: #2d313c;
  color: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

.agent-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.agent-dot.grok {
  background: #34c759;
}

.agent-dot.cursor {
  background: #5e5ce6;
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

.furnace-head-root.is-dark .furnace-state {
  color: #9aa0ad;
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

.furnace-head-root.is-dark .furnace-btn {
  background: rgba(255, 255, 255, 0.07);
  color: #dce0e8;
}

.furnace-btn.on {
  background: #007aff;
  color: #fff;
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

.furnace-head-root.is-dark .furnace-more-menu {
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

.furnace-head-root.is-dark .furnace-more-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.furnace-more-item.danger {
  color: #ff3b30;
}
</style>
