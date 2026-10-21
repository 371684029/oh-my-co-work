<template>
  <div class="settings-layout">
    <aside class="settings-side" role="navigation" :aria-label="t('a11y.settingsSideNav')">
      <div class="settings-side-label">{{ t('settings.projectSection') }}</div>
      <el-menu
        :default-active="route.path"
        router
        class="settings-menu"
        :aria-label="t('a11y.settingsProjectMenu')"
      >
        <el-menu-item index="/settings/members">{{ t('settings.members') }}</el-menu-item>
        <el-menu-item index="/settings/groups">{{ t('settings.groups') }}</el-menu-item>
        <el-menu-item index="/settings/shortcuts">{{ t('settings.shortcuts') }}</el-menu-item>
        <el-menu-item index="/settings/snippets">{{ t('settings.snippets') }}</el-menu-item>
        <el-menu-item index="/settings/wizard">{{ t('settings.wizard') }}</el-menu-item>
      </el-menu>

      <div class="settings-side-divider" aria-hidden="true" />

      <div class="settings-side-label settings-side-label--meta">{{ t('settings.metaSection') }}</div>
      <el-menu
        :default-active="route.path"
        router
        class="settings-menu settings-menu--meta"
        :aria-label="t('a11y.settingsMetaMenu')"
      >
        <el-menu-item index="/settings/prefs" class="menu-item-meta">
          {{ t('settings.prefs') }}
        </el-menu-item>
        <el-menu-item index="/settings/restore" class="menu-item-meta">
          {{ t('settings.restore') }}
        </el-menu-item>
        <el-menu-item index="/settings/grok" class="menu-item-meta">
          {{ t('settings.grok') }}
        </el-menu-item>
        <el-menu-item index="/settings/support" class="menu-item-meta">
          {{ t('settings.support') }}
        </el-menu-item>
        <el-menu-item index="/settings/about" class="menu-item-meta">
          {{ t('settings.about') }}
        </el-menu-item>
      </el-menu>
    </aside>
    <div
      id="settings-main"
      class="settings-body"
      tabindex="-1"
      role="main"
      :aria-label="t('a11y.settingsMain')"
    >
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { t } from '../../i18n/index.js'

const route = useRoute()
</script>

<style scoped>
.settings-side-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ecw-text-3, #8e8ea0);
  padding: 4px 14px 8px;
}

.settings-side-label--meta {
  color: #b0b0b8;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0.02em;
  font-size: 11px;
}

.settings-side-divider {
  height: 1px;
  margin: 14px 12px 12px;
  background: rgba(0, 0, 0, 0.06);
}

.settings-menu {
  border-right: none !important;
  background: transparent !important;
}

/* 非项目功能：浅灰、弱化 */
.settings-menu--meta :deep(.el-menu-item) {
  color: #a8a8b3 !important;
  font-weight: 450 !important;
  height: 36px !important;
  line-height: 36px !important;
  font-size: 13px !important;
}

.settings-menu--meta :deep(.el-menu-item:hover) {
  background: rgba(0, 0, 0, 0.03) !important;
  color: #8e8ea0 !important;
}

.settings-menu--meta :deep(.el-menu-item.is-active) {
  background: rgba(0, 0, 0, 0.04) !important;
  color: #6e6e80 !important;
  box-shadow: none !important;
  font-weight: 500 !important;
}
</style>
