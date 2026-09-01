<template>
  <div class="workbench">
    <!-- 左：会话 -->
    <SessionRail />

    <!-- 中：主对话（Codex 式主舞台） -->
    <section class="wb-center">
      <template v-if="detail">
        <div class="wb-chat-header" :class="{ 'is-human-attention': needsHuman }">
          <div class="header-left">
            <el-input
              v-model="editTitle"
              class="title-input"
              size="large"
              placeholder="未命名任务"
              @change="rename"
            />
            <el-tag
              size="small"
              :effect="needsHuman ? 'dark' : 'plain'"
              round
              :type="statusType(detail.session.status)"
            >
              {{ statusLabel(detail.session.status) }}
            </el-tag>
            <el-tag
              v-if="archiveOutcomeTag"
              size="small"
              effect="dark"
              round
              :type="archiveOutcomeTag.type"
            >
              {{ archiveOutcomeTag.label }}
            </el-tag>
            <span v-if="needsHuman" class="human-attention-pill">需人工处理</span>
          </div>
          <div class="header-actions">
            <el-button
              v-if="detail.session"
              size="default"
              text
              bg
              :type="detail.session.pinned ? 'primary' : 'default'"
              @click="togglePin(detail.session.id, !detail.session.pinned)"
            >
              {{ detail.session.pinned ? '取消置顶' : '置顶' }}
            </el-button>
            <el-button size="default" text bg type="danger" @click="doDelete()">删除</el-button>
          </div>
        </div>

        <FurnaceWorkspace
          v-if="activeTerminal && furnaceTuiPagefill"
          :terminal="activeTerminal"
          :terminals="terminalSessions"
          :connection-status="terminalConnectionStatus"
          :prefs="terminalPrefs"
          :default-pagefill="true"
          :default-surface="furnaceSurface"
          :session-id="activeId"
          @close="activeTerminalId = null"
          @kill="killTerminal"
          @close-furnace="closeFurnaceProcess"
          @reopen="reopenFurnaceProcess"
          @input="sendTerminalInput"
          @resize="resizeTerminal"
          @select="openTerminal"
          @download-log="downloadTerminalLog"
          @gap="onTerminalSeqGap"
        />
        <TerminalWorkspace
          v-else-if="activeTerminal"
          :terminal="activeTerminal"
          :terminals="terminalSessions"
          :connection-status="terminalConnectionStatus"
          :prefs="terminalPrefs"
          :default-pagefill="false"
          @close="activeTerminalId = null"
          @kill="killTerminal"
          @input="sendTerminalInput"
          @resize="resizeTerminal"
          @select="openTerminal"
          @download-log="downloadTerminalLog"
          @gap="onTerminalSeqGap"
        />

        <!-- 经典布局：上消息滚动 · 下闸门+输入固定 -->
        <div v-else class="wb-chat-main">
          <div class="wb-chat-scroll">
            <div class="wb-chat-col" :class="{ 'is-wide': terminalSessions.length > 0 }">
              <BubbleList
                :list="bubbleList"
                max-height="100%"
                :auto-scroll="true"
                :show-back-button="false"
                :always-show-scrollbar="false"
                item-key="id"
              >
                <template #avatar="{ item }">
                  <div
                    class="bubble-avatar"
                    :class="`kind-${item._kind || 'agent'}`"
                    :title="item.senderFull || item.senderShort"
                  >
                    {{ item.senderInitial }}
                  </div>
                </template>
                <template #header="{ item }">
                  <div
                    class="bubble-sender"
                    :class="[
                      `kind-${item._kind || 'agent'}`,
                      item.placement === 'end' ? 'is-end' : 'is-start',
                    ]"
                  >
                    <span class="bubble-sender-name">{{ item.senderShort }}</span>
                    <span
                      v-if="item.senderFull && item.senderFull !== item.senderShort"
                      class="bubble-sender-full"
                    >
                      {{ item.senderFull }}
                    </span>
                  </div>
                </template>
                <template #content="{ item }">
                  <TerminalSessionCard
                    v-if="item._kind === 'terminal'"
                    :terminal="item.terminal"
                    @open="openTerminal"
                    @kill="killTerminal"
                  />
                  <div
                    v-else
                    class="bubble-rich"
                    :class="[
                      `kind-${item._kind || 'agent'}`,
                      item.placement === 'end' ? 'is-end' : 'is-start',
                      { 'is-archive': item._kind === 'archive' },
                    ]"
                  >
                    <div v-if="item.content" class="bubble-text">{{ item.content }}</div>
                    <div v-if="item.attachments?.length" class="bubble-files">
                      <a
                        v-for="f in item.attachments"
                        :key="f.id || f.url"
                        class="file-card"
                        :href="f.url"
                        target="_blank"
                        rel="noopener"
                        @click.stop
                      >
                        <span class="file-card-icon">{{ fileIcon(f) }}</span>
                        <span class="file-card-meta">
                          <span class="file-card-name">{{ f.name }}</span>
                          <span class="file-card-size">{{ formatSize(f.size) }}</span>
                        </span>
                      </a>
                    </div>
                  </div>
                </template>
              </BubbleList>
            </div>
          </div>
          <ComposerPanel />
        </div>
      </template>
      <div v-else class="wb-welcome">
        <div class="welcome-hero">
          <div class="welcome-logo-wrap">
            <AppLogo size="lg" class="welcome-logo" :glow="false" />
          </div>
          <h1 class="core-slogan">
            <span>人机协同</span>
            <i class="dot">·</i>
            <span>万物归元</span>
            <i class="dot">·</i>
            <span>皆可 Workflow</span>
            <i class="dot">·</i>
            <span>终端守护者</span>
            <i class="dot">·</i>
            <span>熔炉连接一切</span>
          </h1>
          <p class="core-living">节点是死的，人是活的 · 可绕行、插队，临时协助再回来</p>
          <div class="welcome-actions">
            <el-button
              type="primary"
              :loading="startingChat"
              :disabled="startingChat"
              @click="startDemoChat"
            >
              一键开聊：演示流
            </el-button>
            <p class="welcome-cta">或左侧自选群模板后点「开聊」</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 右：流程轨 / 群报告 -->
    <FlowRail />
  </div>
</template>

<script setup>
import { onUnmounted, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLogo from '../components/AppLogo.vue'
import TerminalSessionCard from '../components/terminal/TerminalSessionCard.vue'
import SessionRail from './workbench/components/SessionRail.vue'
import FlowRail from './workbench/components/FlowRail.vue'
import ComposerPanel from './workbench/components/ComposerPanel.vue'
import {
  initSessionDetail,
  disposeSessionDetail,
  detail,
  activeId,
  editTitle,
  needsHuman,
  statusType,
  statusLabel,
  archiveOutcomeTag,
  rename,
  togglePin,
  doDelete,
  bubbleList,
  fileIcon,
  formatSize,
  startingChat,
  startDemoChat,
  terminalPrefs,
  furnaceSurface,
} from './workbench/composables/useSessionDetail'
import {
  initTerminalSessions,
  disposeTerminalSessions,
  activeTerminal,
  furnaceTuiPagefill,
  terminalSessions,
  terminalConnectionStatus,
  activeTerminalId,
  killTerminal,
  closeFurnaceProcess,
  reopenFurnaceProcess,
  sendTerminalInput,
  resizeTerminal,
  openTerminal,
  downloadTerminalLog,
  onTerminalSeqGap,
} from './workbench/composables/useTerminalSessions'
import {
  initFurnaceSync,
  disposeFurnaceSync,
  startWorkbench,
} from './workbench/composables/useFurnaceSync'

const TerminalWorkspace = defineAsyncComponent(
  () => import('../components/terminal/TerminalWorkspace.vue'),
)
const FurnaceWorkspace = defineAsyncComponent(
  () => import('../components/terminal/FurnaceWorkspace.vue'),
)

const route = useRoute()
const router = useRouter()

// 组装：模块级 ref 单例（furnaceUi.js 同款模式）；init 绑定路由并重置路由级状态
initSessionDetail({ route, router })
initTerminalSessions()
initFurnaceSync({ route, router })
startWorkbench()

onUnmounted(() => {
  disposeFurnaceSync()
  disposeTerminalSessions()
  disposeSessionDetail()
})
</script>

<style scoped>
/* —— 会话顶栏（mac 标题栏气质） —— */
.wb-chat-header {
  height: 52px;
  flex-shrink: 0;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  z-index: 5;
  transition:
    background 0.2s cubic-bezier(0.25, 0.1, 0.25, 1),
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

/* 运行时等人：顶栏淡红提醒 */
.wb-chat-header.is-human-attention {
  background: linear-gradient(90deg, rgba(255, 241, 240, 0.95) 0%, rgba(255, 255, 255, 0.7) 48%);
  border-bottom-color: rgba(255, 59, 48, 0.25);
  box-shadow: inset 3px 0 0 #ff3b30;
}

.human-attention-pill {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #fff;
  background: var(--el-color-danger, #f56c6c);
  padding: 3px 10px;
  border-radius: 999px;
  box-shadow: 0 2px 8px rgba(245, 108, 108, 0.35);
  animation: ecw-pill-breathe 1.6s ease-in-out infinite;
}

@keyframes ecw-pill-breathe {
  0%,
  100% {
    box-shadow: 0 2px 8px rgba(245, 108, 108, 0.35);
  }
  50% {
    box-shadow: 0 2px 14px rgba(245, 108, 108, 0.55);
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.header-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.title-input {
  width: min(380px, 46vw);
}

.title-input :deep(.el-input__wrapper) {
  box-shadow: none !important;
  background: transparent;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.035em;
  padding-left: 0;
}

.title-input :deep(.el-input__inner) {
  color: var(--ecw-text-1, #0d0d0d);
}

.title-input :deep(.el-input__wrapper:hover),
.title-input :deep(.el-input__wrapper.is-focus) {
  background: var(--ecw-surface-muted, #f7f7f8);
  box-shadow: 0 0 0 1px var(--ecw-border, rgba(0, 0, 0, 0.06)) inset !important;
  border-radius: 8px;
}

/* —— 经典聊天：上消息滚动 · 下输入贴底 —— */
.wb-chat-main {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, rgba(248, 249, 251, 0.5) 0%, rgba(255, 255, 255, 0.35) 100%);
}

/* 消息区：占满剩余高度，内部滚动 */
.wb-chat-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  justify-content: center;
  padding: 16px 16px 8px;
}

/* BubbleList：撑满消息区 */
.wb-chat-scroll :deep(.elx-bubble-list) {
  height: 100% !important;
  width: 100%;
  min-height: 0;
  position: relative;
}

.wb-chat-scroll :deep(.elx-bubble-list__list) {
  max-height: 100% !important;
  height: 100%;
  overflow-y: auto;
  padding: 4px 4px 16px;
  box-sizing: border-box;
}

.wb-chat-scroll :deep(.elx-bubble-list__back-button) {
  display: none !important;
}

/* ========== 气泡：noStyle 去外壳，只留一层 ========== */
.wb-chat-scroll :deep(.elx-bubble) {
  margin-bottom: 18px !important;
  align-items: flex-end;
  gap: 12px !important;
}

.wb-chat-scroll :deep(.elx-bubble__content-wrapper) {
  max-width: 100%;
  gap: 4px;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

/* 终端气泡：撑满可用宽度，不留富文本气泡的窄边距 */
.wb-chat-scroll :deep(.elx-bubble:has(.terminal-card)) {
  gap: 8px !important;
}

.wb-chat-scroll :deep(.elx-bubble:has(.terminal-card) .elx-bubble__content-wrapper) {
  width: 100%;
  flex: 1 1 auto;
  min-width: 0;
}

.wb-chat-scroll :deep(.elx-bubble__header) {
  padding: 0 4px 2px;
  line-height: 1.2;
}

/* 组件 content 壳透明无衬，视觉只认 .bubble-rich */
.wb-chat-scroll :deep(.elx-bubble__content),
.wb-chat-scroll :deep([class*='bubble__content']) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  min-height: 0 !important;
  border-radius: 0 !important;
}

.wb-chat-scroll :deep(.elx-bubble__content:hover) {
  box-shadow: none !important;
  transform: none !important;
}

/* 唯一气泡层 */
.bubble-rich {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 100%;
  padding: 12px 16px;
  border-radius: 18px;
  line-height: 1.6;
  letter-spacing: -0.01em;
  font-size: 14.5px;
  white-space: pre-wrap;
  word-break: break-word;
  box-sizing: border-box;
  transition: box-shadow 0.18s ease;
}

.bubble-rich.is-start.kind-agent,
.bubble-rich.is-start.kind-system {
  background: linear-gradient(160deg, #ffffff 0%, #f4f6fa 100%);
  color: var(--ecw-text-1, #0b0c0f);
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-bottom-left-radius: 6px;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
}

.bubble-rich.is-start.kind-gate {
  background: rgba(255, 255, 255, 0.92);
  color: var(--ecw-text-1, #0b0c0f);
  border: 1.5px solid rgba(245, 108, 108, 0.35);
  border-bottom-left-radius: 6px;
  box-shadow: 0 4px 14px rgba(245, 108, 108, 0.08);
}

.bubble-rich.is-end.kind-user {
  background: linear-gradient(160deg, #3d9bff 0%, #007aff 55%, #0066d6 100%);
  color: #fff;
  border: none;
  border-bottom-right-radius: 6px;
  box-shadow:
    0 6px 18px rgba(0, 122, 255, 0.28),
    0 1px 3px rgba(0, 0, 0, 0.06);
}

.bubble-rich.is-archive,
.bubble-rich.kind-archive {
  background: linear-gradient(160deg, #f0f9eb 0%, #ffffff 55%) !important;
  border: 1.5px solid var(--el-color-success-light-5, #c2e7b0) !important;
  box-shadow:
    inset 3px 0 0 var(--el-color-success, #67c23a),
    0 4px 14px rgba(103, 194, 58, 0.1) !important;
  color: var(--ecw-text-1, #0b0c0f) !important;
  font-weight: 500;
}

.bubble-rich.is-archive .bubble-text,
.bubble-rich.kind-archive .bubble-text {
  color: var(--ecw-text-1, #0b0c0f);
  font-weight: 550;
}

.bubble-text {
  white-space: pre-wrap;
  word-break: break-word;
}

/* 发送人头像简称 */
.bubble-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
  border: 2px solid #fff;
  user-select: none;
}

.bubble-avatar.kind-user {
  background: linear-gradient(145deg, #79bbff 0%, #409eff 100%);
}
.bubble-avatar.kind-agent {
  background: linear-gradient(145deg, #a0cfff 0%, #79bbff 55%, #5cadff 100%);
  color: #1f5f99;
}
.bubble-avatar.kind-terminal {
  background: linear-gradient(145deg, #343944 0%, #20232b 100%);
  color: #8fc5ff;
  border-color: rgba(64, 158, 255, 0.22);
  box-shadow: 0 4px 12px rgba(23, 25, 31, 0.16);
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
}
.bubble-avatar.kind-system {
  background: linear-gradient(145deg, #e4e7ed 0%, #c0c4cc 100%);
  color: #606266;
}
/* 归档：参考红色提示的克制语气，用浅绿描边色块 */
.bubble-avatar.kind-archive {
  background: linear-gradient(145deg, #f0f9eb 0%, #e1f3d8 100%);
  color: var(--el-color-success, #67c23a);
  border-color: rgba(103, 194, 58, 0.35);
  box-shadow: 0 2px 8px rgba(103, 194, 58, 0.12);
}
.bubble-avatar.kind-gate {
  background: linear-gradient(145deg, #fbc4c4 0%, #f56c6c 100%);
}

/* 发送人名称（气泡上方） */
.bubble-sender {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  max-width: 100%;
  margin-bottom: 2px;
}

.bubble-sender.is-end {
  flex-direction: row-reverse;
  margin-left: auto;
}

.bubble-sender-name {
  font-size: 12px;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--ecw-text-2, #5c5f6a);
}

.bubble-sender.is-end .bubble-sender-name {
  color: var(--ecw-accent, #409eff);
}

.bubble-sender.kind-gate .bubble-sender-name {
  color: var(--el-color-danger, #f56c6c);
}

.bubble-sender.kind-system .bubble-sender-name {
  color: var(--ecw-text-3, #8b8f9a);
}

.bubble-sender.kind-archive .bubble-sender-name {
  color: var(--el-color-success, #67c23a);
  font-weight: 650;
}

.bubble-sender-full {
  font-size: 11px;
  color: var(--ecw-text-3, #8b8f9a);
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 10em;
}

.bubble-sender.is-end .bubble-sender-full {
  display: none; /* 右侧「我」不必再展全名 */
}

/* 头像占位：圆润色块 */
.wb-chat-scroll :deep(.elx-bubble__avatar-placeholder),
.wb-chat-scroll :deep(.elx-bubble__avatar-size .el-avatar) {
  border-radius: 50% !important;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
}

.wb-chat-scroll :deep(.elx-bubble--start .elx-bubble__avatar-placeholder) {
  background: linear-gradient(145deg, #e8f3ff 0%, #c6e2ff 100%) !important;
  border: 2px solid #fff;
}

.wb-chat-scroll :deep(.elx-bubble--end .elx-bubble__avatar-placeholder) {
  background: linear-gradient(145deg, #79bbff 0%, #409eff 100%) !important;
  border: 2px solid rgba(255, 255, 255, 0.85);
}

/* 气泡列表项间距 */
.wb-chat-scroll :deep(.elx-bubble-list-item),
.wb-chat-scroll :deep([class*='bubble-list'] > *) {
  margin-bottom: 4px;
}

.bubble-files {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.file-card {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(15, 23, 42, 0.08);
  text-decoration: none;
  color: inherit;
  transition: background 0.15s ease, box-shadow 0.15s ease;
}

.file-card:hover {
  background: #fff;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
}

.elx-bubble--end .file-card,
.wb-chat-scroll :deep(.elx-bubble--end) .file-card {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.28);
  color: #fff;
}

.file-card-icon {
  font-size: 18px;
}

.file-card-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.file-card-name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 240px;
}

.file-card-size {
  font-size: 11px;
  opacity: 0.75;
}

/* —— 欢迎态：居中主视觉，字号与颜色统一 —— */
.wb-welcome {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 32px 56px;
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #f4f7fb 0%, #f8fafc 55%, #fbfcfe 100%);
}

.welcome-hero {
  position: relative;
  z-index: 1;
  width: min(640px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  animation: welcome-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes welcome-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.welcome-logo-wrap {
  margin-bottom: 22px;
}

.welcome-logo {
  border-radius: 14px;
}

.core-slogan {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0 0.12em;
  margin: 0 0 10px;
  max-width: 100%;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.01em;
  line-height: 1.75;
  color: var(--ecw-text-1, #3a3a3c);
}

.core-slogan span {
  white-space: nowrap;
}

.core-slogan .dot {
  font-style: normal;
  font-weight: 400;
  color: #c5c5c7;
}

.core-living {
  margin: 0 0 28px;
  max-width: 36em;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.7;
  color: var(--ecw-text-2, #6a6a6e);
}

.welcome-cta {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ecw-text-3, #8a8a8e);
}

.welcome-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .welcome-hero {
    animation: none !important;
  }
}

@media (max-width: 720px) {
  .wb-welcome {
    padding: 28px 20px 32px;
  }
}
</style>
