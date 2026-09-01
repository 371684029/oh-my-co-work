<template>
  <div
    class="wb-chat-footer"
    :class="{
      'is-collapsed': footerCollapsed,
      'has-gate': !!pendingGate,
    }"
  >
    <div class="wb-chat-col">
      <!-- 展开/折叠 -->
      <div class="footer-toggle-row">
        <button
          type="button"
          class="footer-toggle"
          :class="{ 'is-collapsed': footerCollapsed }"
          :title="footerCollapsed ? '展开输入区' : '折叠输入区'"
          :aria-expanded="!footerCollapsed"
          @click="footerCollapsed = !footerCollapsed"
        >
          <span class="footer-toggle-icon" aria-hidden="true">
            <i class="footer-chevron" />
          </span>
          <span class="footer-toggle-label">{{
            footerCollapsed ? footerCollapsedHint : '收起'
          }}</span>
        </button>
      </div>

      <div v-show="!footerCollapsed" class="footer-body">
        <!-- 待确认说明统一走下方输入框 placeholder + 按钮，不再单独显示顶部大卡片 -->

        <div class="composer" :class="{ 'composer--gate': !!pendingGate }">
          <el-alert
            v-if="detail.session.status === 'archived'"
            type="info"
            :closable="false"
            show-icon
            title="已归档。再发即可恢复；续跑点「从这里继续」。"
            class="composer-alert composer-alert--archived"
          />
          <div class="composer-shell" @keydown.capture="onComposerKeydown">
            <div v-if="slashOpen" class="slash-panel">
              <div class="slash-panel-head">
                <span class="slash-panel-head-title">斜杠指令</span>
                <div class="slash-panel-head-end">
                  <el-button link type="primary" size="small" @click="goShortcuts">
                    设置
                  </el-button>
                  <button
                    type="button"
                    class="slash-panel-close"
                    title="关闭"
                    aria-label="关闭"
                    @mousedown.prevent
                    @click="closeComposerPanel('slash')"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div v-if="!filteredSlashCmds.length" class="slash-empty">
                无匹配指令 · 可在设置中添加
              </div>
              <button
                v-for="(c, i) in filteredSlashCmds"
                :key="c.id"
                type="button"
                class="slash-item"
                :class="{ active: i === slashIndex }"
                @mousedown.prevent="runSlash(c)"
              >
                <code class="slash-token">/{{ c.slash }}</code>
                <span class="slash-name">{{ c.name }}</span>
                <span class="slash-desc">{{ c.description }}</span>
              </button>
            </div>
            <div v-if="atOpen" class="slash-panel at-panel">
              <div class="slash-panel-head">
                <span class="slash-panel-head-title">@ 提及</span>
                <div class="slash-panel-head-end">
                  <span class="at-panel-tip">将记入临时协助</span>
                  <button
                    type="button"
                    class="slash-panel-close"
                    title="关闭"
                    aria-label="关闭"
                    @mousedown.prevent
                    @click="closeComposerPanel('at')"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div class="at-section-label">成员 · 流程外协助</div>
              <div v-if="!filteredAtMembers.length" class="slash-empty">无匹配成员</div>
              <button
                v-for="(m, i) in filteredAtMembers"
                :key="m.id"
                type="button"
                class="slash-item"
                :class="{ active: i === atIndex }"
                @mousedown.prevent="insertAtMember(m)"
              >
                <span class="at-avatar">{{ (m.display_name || m.name || '?').slice(0, 1) }}</span>
                <span class="slash-name">{{ m.display_name || m.name }}</span>
                <span class="slash-desc"
                  >{{ m.kind
                  }}{{ m.config?.description ? ` · ${m.config.description}` : '' }}</span
                >
              </button>
            </div>
            <div v-if="hashOpen" class="slash-panel hash-panel">
              <div class="slash-panel-head">
                <span class="slash-panel-head-title"># 文本快捷</span>
                <div class="slash-panel-head-end">
                  <span class="at-panel-tip"># 选中后插入正文（不含 #）</span>
                  <button
                    type="button"
                    class="slash-panel-close"
                    title="关闭"
                    aria-label="关闭"
                    @mousedown.prevent
                    @click="closeComposerPanel('hash')"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div v-if="!filteredHashItems.length" class="slash-empty">
                无匹配 · 开聊后可见群聊/文件夹；人工提交参数后有第 1 段…
              </div>
              <button
                v-for="(h, i) in filteredHashItems"
                :key="h.key"
                type="button"
                class="slash-item"
                :class="{ active: i === hashIndex }"
                @mousedown.prevent="insertHashItem(h)"
              >
                <code class="slash-token">{{ h.label }}</code>
                <span class="slash-name">{{ h.name }}</span>
                <span class="slash-desc" :title="h.value || h.emptyHint">{{
                  h.preview || h.emptyHint
                }}</span>
              </button>
            </div>
            <div v-if="pendingFiles.length" class="attach-list">
              <div v-for="(f, i) in pendingFiles" :key="f.id || i" class="attach-chip">
                <span class="attach-chip-icon">{{ fileIcon(f) }}</span>
                <span class="attach-chip-body">
                  <span class="attach-chip-name" :title="f.name">{{ f.name }}</span>
                  <span class="attach-chip-size">{{ formatSize(f.size) }}</span>
                </span>
                <button
                  type="button"
                  class="attach-chip-x"
                  title="移除"
                  @click="removePending(i)"
                >
                  ×
                </button>
              </div>
            </div>
            <div class="composer-toolbar">
              <el-button
                size="small"
                round
                class="slash-btn"
                title="斜杠指令 /"
                @click="toggleSlashPanel"
              >
                /
              </el-button>
              <el-button
                size="small"
                round
                class="at-btn"
                title="@ 成员协助"
                :disabled="!activeId"
                @click="toggleAtPanel"
              >
                @
              </el-button>
              <el-button
                size="small"
                round
                class="hash-btn"
                title="# 文本快捷 · 选中插入正文（不含 #）"
                :disabled="!activeId"
                @click="toggleHashPanel"
              >
                #
              </el-button>
              <el-button
                size="small"
                round
                class="attach-btn"
                title="上传文件"
                :loading="uploading"
                :disabled="!activeId"
                @click="triggerFilePick"
              >
                附件
              </el-button>
              <el-button
                size="small"
                round
                class="copy-btn"
                title="复制输入框内容"
                @click="copyComposerText"
              >
                复制
              </el-button>
              <input
                ref="fileInputRef"
                type="file"
                multiple
                class="file-input-hidden"
                @change="onFileInputChange"
              />
              <div class="composer-toolbar-end">
                <el-tooltip
                  v-if="showComposerHintI"
                  :content="composerToolbarHint"
                  placement="top"
                  :trigger="['hover', 'focus', 'click']"
                  :show-after="200"
                >
                  <button
                    type="button"
                    class="gate-info-dot composer-hint-i"
                    :aria-label="composerToolbarHint"
                  >
                    i
                  </button>
                </el-tooltip>
                <div v-if="pendingGate" class="composer-gate-actions">
                  <template v-if="pendingGate.content?.mode === 'session_start'">
                    <el-button type="danger" @click="approveSessionStart(pendingGate)">
                      通过
                    </el-button>
                    <el-button plain @click="gate(pendingGate, 'cancel_start')">
                      取消
                    </el-button>
                  </template>
                  <template v-else-if="pendingGate.content?.mode === 'human_input'">
                    <el-button type="danger" @click="submitHuman(pendingGate)">
                      提交
                    </el-button>
                  </template>
                  <template v-else-if="pendingGate.content?.mode === 'need_params'">
                    <el-button type="danger" @click="submitHuman(pendingGate)">
                      提交
                    </el-button>
                  </template>
                  <template v-else-if="pendingGate.content?.mode === 'adapter_question'">
                    <el-button
                      v-for="choice in adapterChoices(pendingGate)"
                      :key="choice"
                      type="danger"
                      @click="answerAdapterQuestion(pendingGate, choice)"
                    >
                      {{ choice }}
                    </el-button>
                    <el-button
                      v-if="!adapterChoices(pendingGate).length"
                      type="danger"
                      @click="answerAdapterQuestion(pendingGate)"
                    >
                      提交
                    </el-button>
                    <el-button plain @click="answerAdapterQuestion(pendingGate, '取消', 'reject')">
                      拒绝
                    </el-button>
                  </template>
                  <template v-else-if="pendingGate.content?.mode === 'interrupted'">
                    <el-button type="danger" @click="gate(pendingGate, 'resume_interrupted')">
                      继续
                    </el-button>
                    <el-button plain @click="gate(pendingGate, 'discard_interrupted')">
                      放弃
                    </el-button>
                  </template>
                  <template v-else>
                    <el-tooltip
                      placement="top"
                      :show-after="200"
                      :content="pendingGate.content?.text || ''"
                    >
                      <span class="gate-info-dot" title="查看详情">i</span>
                    </el-tooltip>
                    <el-button type="danger" @click="gate(pendingGate, 'approve')">
                      {{ pendingGate.content?.lastNodeComplete ? '同意并完成' : '同意' }}
                    </el-button>
                    <el-button plain @click="gate(pendingGate, 'reject')">
                      拒绝
                    </el-button>
                  </template>
                </div>
              </div>
            </div>
            <XSender
              ref="senderRef"
              :placeholder="composerPlaceholder"
              submit-type="enter"
              variant="updown"
              clearable
              @change="onSenderChange"
              @paste-file="onPasteFile"
              @submit="onSenderSubmit"
            />
          </div>
          <p class="composer-hint">{{ composerFooterHint }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../../../api'
import { useLocalUploads } from '../../../composables/localUploads'
import {
  detail,
  pendingGate,
  footerCollapsed,
  footerCollapsedHint,
  senderRef,
  activeId,
  pendingFiles,
  uploading,
  slashOpen,
  filteredSlashCmds,
  slashIndex,
  atOpen,
  filteredAtMembers,
  atIndex,
  hashOpen,
  filteredHashItems,
  hashIndex,
  showComposerHintI,
  composerToolbarHint,
  composerPlaceholder,
  composerFooterHint,
  fileIcon,
  formatSize,
  onComposerKeydown,
  goShortcuts,
  closeComposerPanel,
  runSlash,
  insertAtMember,
  insertHashItem,
  toggleSlashPanel,
  toggleAtPanel,
  toggleHashPanel,
  copyComposerText,
  onSenderChange,
  onSenderSubmit,
  adapterChoices,
  approveSessionStart,
  gate,
  submitHuman,
  answerAdapterQuestion,
} from '../composables/useSessionDetail'

const fileInputRef = ref(null)

const { addLocalFiles, onFileInputChange, removePending } = useLocalUploads({
  pendingFiles,
  uploading,
  getTargetId: () => activeId.value,
  upload: (id, files) => api.sessions.uploadFiles(id, files),
  noTargetAddMessage: '请先选择会话再添加文件',
  successMessage: (n) => `已添加 ${n} 个文件`,
})

function triggerFilePick() {
  if (!activeId.value) {
    ElMessage.warning('请先选择会话')
    return
  }
  fileInputRef.value?.click()
}

function onPasteFile(firstFile, fileList) {
  const list = fileList?.length ? fileList : firstFile ? [firstFile] : []
  addLocalFiles(list)
}
</script>

<style scoped>
/* 底栏：闸门 + 输入，始终贴底 */
.wb-chat-footer {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
  padding: 0 16px 12px;
  background: linear-gradient(180deg, transparent 0%, rgba(250, 251, 253, 0.92) 28%, #fafbfd 100%);
}

.wb-chat-footer.is-collapsed {
  padding-bottom: 10px;
}

.wb-chat-footer .wb-chat-col {
  height: auto;
}

/* 展开/折叠开关 */
.footer-toggle-row {
  display: flex;
  justify-content: center;
  margin-bottom: 6px;
}

.footer-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.92);
  color: var(--ecw-text-3, #8b8f9a);
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  height: 28px;
  padding: 0 12px 0 8px;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
  user-select: none;
  vertical-align: middle;
}

.footer-toggle:hover {
  color: var(--ecw-accent, #409eff);
  border-color: rgba(64, 158, 255, 0.35);
  background: #fff;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.12);
}

/* 角标容器：固定方盒，几何箭头居中 */
.footer-toggle-icon {
  display: inline-flex;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
}

/* CSS 小三角，避免 Unicode 字形基线偏移 */
.footer-chevron {
  display: block;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid currentColor;
  border-bottom: 0;
  transform: translateY(0.5px);
  transition: transform 0.15s ease;
}

/* 折叠态：箭头朝上（展开） */
.footer-toggle.is-collapsed .footer-chevron {
  border-top: 0;
  border-bottom: 5px solid currentColor;
  transform: translateY(-0.5px);
}

.footer-toggle-label {
  letter-spacing: 0.01em;
  line-height: 1;
  display: inline-flex;
  align-items: center;
}

.wb-chat-footer.is-collapsed .footer-toggle {
  color: var(--ecw-text-2, #5c5f6a);
  border-color: rgba(64, 158, 255, 0.22);
  background: linear-gradient(180deg, #fff 0%, #f5f9ff 100%);
}

.wb-chat-footer.is-collapsed.has-gate .footer-toggle {
  color: var(--el-color-danger, #f56c6c);
  border-color: rgba(245, 108, 108, 0.35);
  background: linear-gradient(180deg, #fff 0%, #fff5f5 100%);
  box-shadow: 0 2px 10px rgba(245, 108, 108, 0.12);
}

.wb-chat-footer.is-collapsed .footer-toggle-row {
  margin-bottom: 0;
}

.footer-body {
  width: 100%;
  min-width: 0;
}

/* —— Composer：底部输入条 —— */
.composer {
  flex-shrink: 0;
  padding: 4px 4px 8px;
  position: relative;
  width: 100%;
  box-sizing: border-box;
}

.composer-alert {
  margin-bottom: 12px;
  border-radius: 16px;
}

/* 底栏归档条：与红色等人提示同级的轻量成功色 */
.composer-alert--archived {
  --el-alert-bg-color: linear-gradient(135deg, #f0f9eb 0%, #fff 70%);
  background: linear-gradient(135deg, #f0f9eb 0%, #fff 70%) !important;
  border: 1px solid var(--el-color-success-light-5, #c2e7b0);
  box-shadow: 0 0 0 1px rgba(103, 194, 58, 0.06);
}

.composer-shell {
  position: relative;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: saturate(160%) blur(24px);
  -webkit-backdrop-filter: saturate(160%) blur(24px);
  border: 0.5px solid rgba(0, 0, 0, 0.08);
  box-shadow:
    0 0 0 0.5px rgba(255, 255, 255, 0.6) inset,
    0 10px 36px rgba(0, 0, 0, 0.08),
    0 2px 6px rgba(0, 0, 0, 0.04);
  padding: 10px 14px 12px;
  overflow: visible;
  transition:
    box-shadow 0.2s cubic-bezier(0.25, 0.1, 0.25, 1),
    transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1),
    border-color 0.2s ease;
}

.composer-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  padding: 0 2px;
}

.slash-btn {
  font-weight: 700 !important;
  min-width: 32px;
  font-size: 15px !important;
  color: var(--ecw-accent, #007aff) !important;
  border-color: rgba(0, 122, 255, 0.22) !important;
  background: rgba(0, 122, 255, 0.08) !important;
}

.at-btn {
  font-weight: 700 !important;
  min-width: 32px;
  font-size: 14px !important;
  color: var(--ecw-text-1, #1d1d1f) !important;
  border-color: rgba(0, 0, 0, 0.1) !important;
  background: rgba(0, 0, 0, 0.04) !important;
}

.hash-btn {
  font-weight: 700 !important;
  min-width: 32px;
  font-size: 15px !important;
  color: var(--el-color-success-dark-2, #529b2e) !important;
  border-color: rgba(103, 194, 58, 0.28) !important;
  background: rgba(103, 194, 58, 0.08) !important;
}

.at-panel-tip {
  font-size: 11px;
  color: var(--ecw-text-3, #86868b);
  font-weight: 400;
}

.at-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(145deg, #5eb0ff, #007aff);
  flex-shrink: 0;
}

.attach-btn {
  font-weight: 500 !important;
  color: var(--ecw-text-2, #6e6e73) !important;
  border-color: rgba(0, 0, 0, 0.08) !important;
  background: rgba(0, 0, 0, 0.03) !important;
}

.copy-btn {
  font-weight: 500 !important;
  color: var(--ecw-text-2, #6e6e73) !important;
  border-color: rgba(0, 0, 0, 0.08) !important;
  background: rgba(0, 0, 0, 0.03) !important;
}

.file-input-hidden {
  display: none;
}

button.composer-hint-i {
  margin: 0;
  border: 0;
  font: inherit;
}

/* 附件区（参考 Plus-X 发送区附件卡片） */
.attach-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 10px;
  padding: 2px 0 4px;
}

.attach-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 220px;
  padding: 8px 10px;
  border-radius: 12px;
  background: linear-gradient(180deg, #f7f9fc 0%, #eef3fb 100%);
  border: 1px solid rgba(64, 158, 255, 0.14);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
}

.attach-chip-icon {
  font-size: 16px;
  line-height: 1;
}

.attach-chip-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.attach-chip-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ecw-text-1, #0b0c0f);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
}

.attach-chip-size {
  font-size: 11px;
  color: var(--ecw-text-3, #8b8f9a);
}

.attach-chip-x {
  border: none;
  background: transparent;
  color: var(--ecw-text-3, #8b8f9a);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  border-radius: 4px;
}

.attach-chip-x:hover {
  color: var(--el-color-danger, #f56c6c);
  background: rgba(245, 108, 108, 0.08);
}

/* 快捷指令面板 */
.slash-panel {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: calc(100% + 8px);
  max-height: 280px;
  overflow: auto;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
  z-index: 40;
  padding: 8px;
}

.slash-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 4px 8px 8px;
  font-size: 12px;
  font-weight: 650;
  color: var(--ecw-text-2, #5c5f6a);
}

.slash-panel-head-title {
  flex-shrink: 0;
}

.slash-panel-head-end {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.slash-panel-head-end .at-panel-tip {
  font-weight: 400;
  font-size: 11px;
  color: var(--ecw-text-3, #8b8f9a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slash-panel-close {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--ecw-text-3, #8b8f9a);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
}

.slash-panel-close:hover {
  color: var(--ecw-text-1, #0b0c0f);
  background: rgba(15, 23, 42, 0.06);
}

.slash-empty {
  padding: 16px 10px;
  text-align: center;
  font-size: 12.5px;
  color: var(--ecw-text-3, #8b8f9a);
}

.slash-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  padding: 10px 10px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.12s ease;
}

.slash-item:hover,
.slash-item.active {
  background: rgba(64, 158, 255, 0.08);
}

.slash-token {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--ecw-accent, #409eff);
  background: rgba(64, 158, 255, 0.1);
  padding: 2px 8px;
  border-radius: 6px;
}

.slash-name {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--ecw-text-1, #0b0c0f);
}

.slash-desc {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--ecw-text-3, #8b8f9a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-shell:focus-within {
  transform: translateY(-2px);
  border-color: rgba(64, 158, 255, 0.35);
  box-shadow:
    0 0 0 3px rgba(64, 158, 255, 0.16),
    0 16px 48px rgba(64, 158, 255, 0.18),
    0 4px 14px rgba(15, 23, 42, 0.06);
}

.composer-hint {
  margin: 12px 6px 0;
  text-align: center;
  font-size: 11.5px;
  color: var(--ecw-text-3, #8b8f9a);
  letter-spacing: 0.01em;
}

.composer-toolbar-end {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.composer-gate-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.composer-gate-actions .el-button {
  min-width: 88px;
  height: 36px;
  padding: 0 18px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 10px;
}

.gate-info-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.04);
  color: var(--ecw-text-3, #8e8ea0);
  font-size: 11px;
  font-style: italic;
  font-weight: 600;
  font-family: Georgia, 'Times New Roman', serif;
  cursor: help;
  opacity: 0.6;
  transition: opacity 0.15s ease;
}

.gate-info-dot:hover {
  opacity: 1;
  color: var(--ecw-text-2, #5a5a66);
}

.at-section-label {
  padding: 8px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--ecw-text-3, #8b8f9a);
  letter-spacing: 0.02em;
}
.at-avatar-node {
  background: rgba(64, 158, 255, 0.15) !important;
  color: var(--el-color-primary) !important;
  font-size: 11px !important;
}
.at-item-node .slash-name {
  font-weight: 600;
}

/* —— 历史闸门卡片（已并入输入区，保留样式以防回滚） —— */
.gate-float {
  flex-shrink: 0;
  margin: 0 4px 10px;
  padding-left: 22px;
  border-radius: 22px !important;
  width: auto;
  max-height: min(280px, 38vh);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.gate-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--el-color-danger, #f56c6c);
  margin-bottom: 8px;
  flex-shrink: 0;
}

.gate-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-color-danger, #f56c6c);
  box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.5);
  animation: ecw-dot-ping 1.4s ease-out infinite;
}

@keyframes ecw-dot-ping {
  0% {
    box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.55);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(245, 108, 108, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(245, 108, 108, 0);
  }
}

/* 失败详情等长文：限高内滚动，同意/拒绝始终可见 */
.gate-scroll {
  flex: 1 1 auto;
  min-height: 0;
  max-height: 140px;
  overflow-x: hidden;
  overflow-y: auto;
  margin-bottom: 4px;
  padding-right: 4px;
  overscroll-behavior: contain;
}

.gate-title {
  margin-bottom: 8px;
  font-weight: 650;
  font-size: 13.5px;
  letter-spacing: -0.02em;
  line-height: 1.4;
  color: var(--ecw-text-1, #0d0d0d);
  white-space: pre-wrap;
  word-break: break-word;
}

.gate-policy {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--ecw-text-2, #5c5f6a);
}

.gate-params-hint {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--ecw-text-3, #8b8f9a);
}
.gate-params-hint code {
  font-size: 11.5px;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(64, 158, 255, 0.08);
  color: var(--ecw-text-2, #5c5f6a);
}

.gate-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
  flex-shrink: 0;
  padding-top: 2px;
}
</style>
