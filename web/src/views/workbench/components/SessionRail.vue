<template>
  <aside class="wb-left">
    <div class="wb-left-head">
      <div class="head-title">会话</div>
      <div class="wb-left-tools">
        <el-select
          v-model="startTarget"
          placeholder="群模板或成员"
          size="default"
          filterable
          class="start-target-select"
        >
          <el-option-group v-if="groups.length" label="群模板">
            <el-option
              v-for="g in groups"
              :key="'g:' + g.id"
              :label="g.title"
              :value="'g:' + g.id"
            >
              <span class="start-opt">
                <span class="start-opt-text">{{ g.title }}</span>
                <el-tag
                  v-if="abbrGroupTag(g.title)"
                  class="conv-group-tag start-opt-tag"
                  size="small"
                  round
                  effect="plain"
                  type="info"
                  :title="g.title"
                >
                  {{ abbrGroupTag(g.title) }}
                </el-tag>
              </span>
            </el-option>
          </el-option-group>
          <el-option-group v-if="startableMembers.length" label="成员">
            <el-option
              v-for="m in startableMembers"
              :key="'m:' + m.id"
              :label="(m.display_name || m.name) + (m.kind ? ` · ${m.kind}` : '')"
              :value="'m:' + m.id"
            >
              <span class="start-opt">
                <span class="start-opt-text">{{ m.display_name || m.name }}</span>
                <el-tag
                  v-if="m.kind"
                  class="conv-group-tag start-opt-tag"
                  :class="'start-opt-tag--' + m.kind"
                  size="small"
                  round
                  effect="plain"
                  type="info"
                >
                  {{ m.kind }}
                </el-tag>
              </span>
            </el-option>
          </el-option-group>
        </el-select>
        <el-button
          type="primary"
          :disabled="!startTarget || startingChat"
          :loading="startingChat"
          @click="startChat"
        >
          开聊
        </el-button>
      </div>
      <div class="wb-left-filter">
        <el-segmented
          v-model="listFilter"
          :options="filterOptions"
          size="small"
          block
        />
      </div>
    </div>
    <div class="wb-conv-wrap">
      <Conversations
        v-if="conversationItems.length"
        v-model:active="activeId"
        :items="conversationItems"
        groupable
        :label-max-width="200"
        show-tooltip
        :show-built-in-menu="true"
        :menu="convMenu"
        class="wb-conversations"
        @change="onConvChange"
        @menu-command="onConvMenu"
      >
        <template #label="{ item }">
          <div class="conv-row">
            <el-tooltip
              :content="item.hoverTitle || item.label"
              placement="right"
              :disabled="!(item.hoverTitle || item.label)"
              :show-after="200"
            >
              <span class="conv-label-wrap">
                <span v-if="item.pinned" class="conv-pin" aria-hidden="true">📌</span>
                <span v-if="item.labelPrefix" class="conv-label-text">{{ item.labelPrefix }}</span>
                <el-tag
                  v-if="item.groupAbbr"
                  class="conv-group-tag"
                  size="small"
                  round
                  effect="plain"
                  type="info"
                  :title="item.hoverTitle || item.groupAbbr"
                >
                  {{ item.groupAbbr }}
                </el-tag>
                <span
                  v-else-if="!item.labelPrefix"
                  class="conv-label-text"
                  >{{ item.label }}</span
                >
                <span
                  v-if="item.archiveOutcome === 'success'"
                  class="conv-badge conv-badge--ok"
                  title="归档成功"
                  >成</span
                >
                <span
                  v-else-if="item.archiveOutcome === 'failed'"
                  class="conv-badge conv-badge--fail"
                  title="归档失败"
                  >败</span
                >
              </span>
            </el-tooltip>
            <span v-if="item.timeLabel" class="conv-time">{{ item.timeLabel }}</span>
          </div>
        </template>
      </Conversations>
      <div v-else class="conv-empty">
        <p class="conv-empty-title">还没有会话</p>
        <p class="conv-empty-desc">群模板点「开聊」新建；成员会打开已有单聊</p>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { abbrGroupTag } from '@acw/shared'
import {
  startTarget,
  groups,
  startableMembers,
  startingChat,
  startChat,
  listFilter,
  filterOptions,
  conversationItems,
  activeId,
  convMenu,
  onConvChange,
  onConvMenu,
} from '../composables/useSessionDetail'
</script>

<style scoped>
.wb-conv-wrap {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 4px 6px 16px;
}

.conv-empty {
  padding: 36px 18px;
  text-align: center;
}

.conv-empty-title {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ecw-text-1, #0d0d0d);
}

.conv-empty-desc {
  margin: 0;
  font-size: 12px;
  color: var(--ecw-text-3, #8e8ea0);
  line-height: 1.5;
}

/* 会话列表：#1 正文 + 群缩写标签；整行 hover 看全称 */
.conv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-width: 0;
  gap: 8px;
}

.conv-row .el-tooltip {
  flex: 1;
  min-width: 0;
}

.conv-label-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-width: 0;
  position: relative;
  padding-right: 2px;
  vertical-align: middle;
  cursor: default;
}
.conv-time {
  flex-shrink: 0;
  font-size: 11.5px;
  color: var(--ecw-text-3, #8e8ea0);
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}
.conv-pin {
  flex-shrink: 0;
  font-size: 12px;
  line-height: 1;
}
.conv-label-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.conv-group-tag {
  flex-shrink: 0;
  max-width: 72px;
  height: 20px !important;
  padding: 0 8px !important;
  font-size: 11px !important;
  line-height: 18px !important;
  border-color: var(--ecw-border-strong, rgba(0, 0, 0, 0.1)) !important;
  color: var(--ecw-text-2, #6e6e73) !important;
  background: var(--ecw-surface-muted, rgba(255, 255, 255, 0.45)) !important;
}
.conv-group-tag :deep(.el-tag__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 开聊下拉：选项右侧缩写 / kind 标签 */
.start-opt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
}
.start-opt-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}
.start-opt-tag {
  margin-left: auto;
}
.start-opt-tag--script {
  color: #3d6b9a !important;
  border-color: rgba(61, 107, 154, 0.28) !important;
  background: rgba(61, 107, 154, 0.08) !important;
}
.start-opt-tag--echo {
  color: #6b7a3d !important;
  border-color: rgba(107, 122, 61, 0.28) !important;
  background: rgba(107, 122, 61, 0.08) !important;
}
.conv-badge {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  letter-spacing: 0;
  color: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}
.conv-badge--ok {
  background: linear-gradient(145deg, #85ce61, #67c23a);
}
.conv-badge--fail {
  background: linear-gradient(145deg, #f78989, #f56c6c);
}
</style>
