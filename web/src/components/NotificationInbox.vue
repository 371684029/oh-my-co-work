<template>
  <el-popover placement="bottom-end" :width="380" trigger="click" @show="onOpen">
    <template #reference>
      <el-badge :value="unreadInboxCount || undefined" :hidden="!unreadInboxCount" class="inbox-badge">
        <el-button size="default" text bg aria-label="通知收件箱">🔔</el-button>
      </el-badge>
    </template>
    <div class="inbox-panel">
      <div class="inbox-head">
        <strong>通知</strong>
        <div class="inbox-head-actions">
          <el-button size="small" text :disabled="!items.length" @click="markAllInboxRead">全部已读</el-button>
          <el-button size="small" text type="danger" :disabled="!items.length" @click="clearInbox">清空</el-button>
        </div>
      </div>
      <p v-if="startupHint" class="inbox-hint">{{ startupHint }}</p>
      <div v-if="!items.length" class="inbox-empty">暂无通知记录</div>
      <ul v-else class="inbox-list">
        <li
          v-for="it in items"
          :key="it.id"
          class="inbox-item"
          :class="{ 'is-unread': !it.read, [`level-${it.level}`]: true }"
          @click="openItem(it)"
        >
          <div class="inbox-item-title">{{ it.title }}</div>
          <div v-if="it.body" class="inbox-item-body">{{ it.body }}</div>
          <div class="inbox-item-meta">{{ formatTime(it.at) }}</div>
        </li>
      </ul>
    </div>
  </el-popover>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  notificationInboxRef,
  unreadInboxCount,
  markInboxRead,
  markAllInboxRead,
  clearInbox,
  inboxSummarySince,
} from '../composables/notificationInbox.js'
import { parseNotificationDeepLink } from '../composables/notificationDeepLink.js'

const router = useRouter()
const items = notificationInboxRef()
const lastOpenKey = 'acw.inbox.lastOpen'
const startupHint = ref('')

function formatTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function onOpen() {
  let last = ''
  try {
    last = localStorage.getItem(lastOpenKey) || ''
  } catch {
    /* ignore */
  }
  const sum = inboxSummarySince(last)
  if (sum.count > 0) {
    startupHint.value = `离开期间共 ${sum.count} 条通知（${sum.unread} 条未读）`
  } else {
    startupHint.value = ''
  }
  try {
    localStorage.setItem(lastOpenKey, new Date().toISOString())
  } catch {
    /* ignore */
  }
}

function openItem(it) {
  markInboxRead(it.id)
  const parsed = parseNotificationDeepLink(it.deepLink)
  if (!parsed) return
  if (parsed.type === 'docs') {
    router.push({
      path: '/docs',
      query: { session: parsed.sessionId, file: parsed.file || 'ANNOUNCEMENT.md' },
    })
    return
  }
  router.push(`/workbench/${parsed.sessionId}`)
}
</script>

<style scoped>
.inbox-badge :deep(.el-badge__content) {
  font-size: 10px;
}
.inbox-panel {
  max-height: 420px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.inbox-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.inbox-head-actions {
  display: flex;
  gap: 4px;
}
.inbox-hint {
  margin: 0;
  font-size: 12px;
  color: var(--el-color-primary);
}
.inbox-empty {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  padding: 12px 0;
}
.inbox-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow: auto;
  max-height: 340px;
}
.inbox-item {
  padding: 8px 6px;
  border-radius: 8px;
  cursor: pointer;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.inbox-item.is-unread {
  background: rgba(64, 158, 255, 0.08);
}
.inbox-item-title {
  font-size: 13px;
  font-weight: 600;
}
.inbox-item-body {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-top: 2px;
}
.inbox-item-meta {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
</style>
