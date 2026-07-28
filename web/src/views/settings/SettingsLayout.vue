<template>
  <div class="settings-layout">
    <aside class="settings-side">
      <div class="settings-side-label">项目</div>
      <el-menu :default-active="route.path" router class="settings-menu">
        <el-menu-item index="/settings/members">成员管理</el-menu-item>
        <el-menu-item index="/settings/groups">群聊模板</el-menu-item>
        <el-menu-item index="/settings/shortcuts">斜杠 / 快捷键</el-menu-item>
      </el-menu>

      <div class="settings-side-divider" aria-hidden="true" />

      <div class="settings-side-label settings-side-label--meta">其它</div>
      <el-menu :default-active="route.path" router class="settings-menu settings-menu--meta">
        <el-menu-item index="/settings/prefs" class="menu-item-meta">
          设置
        </el-menu-item>
        <el-menu-item index="/settings/support" class="menu-item-meta">
          支持与交流
        </el-menu-item>
        <el-menu-item index="/settings/about" class="menu-item-meta">
          关于与更新
        </el-menu-item>
      </el-menu>
    </aside>
    <div class="settings-body">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
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
