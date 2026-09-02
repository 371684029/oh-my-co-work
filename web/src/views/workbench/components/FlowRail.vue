<template>
  <aside class="wb-right">
    <div class="wb-right-tabs">
      <button
        type="button"
        class="wb-right-tab"
        :class="{ active: rightTab === 'flow' }"
        @click="rightTab = 'flow'"
      >
        流程
      </button>
      <button
        type="button"
        class="wb-right-tab"
        :class="{ active: rightTab === 'announce' }"
        @click="rightTab = 'announce'"
      >
        群报告
      </button>
    </div>

    <!-- Tab：流程（适配步骤直接在节点标题上打「适配」角标，不再单开筛选 Tab） -->
    <div v-show="rightTab === 'flow'" class="wb-right-pane">
      <p v-if="detail?.session?.status === 'archived'" class="flow-archive-hint">
        已归档
        <template v-if="archiveOutcomeTag">
          ·
          <span
            class="flow-archive-outcome"
            :class="archiveOutcomeTag.ok ? 'is-ok' : 'is-fail'"
            >{{ archiveOutcomeTag.label }}</span
          >
        </template>
      </p>
      <p v-else-if="offsiteActive" class="flow-offsite-hint">
        临时协助进行中
      </p>
      <template v-if="flowEntries.length">
        <template v-for="entry in flowEntries" :key="entry.key">
          <div
            v-if="entry.type === 'skipped'"
            class="flow-skipped-group"
            :class="{ open: isSkippedFlowGroupExpanded(entry) }"
          >
            <button
              type="button"
              class="flow-skipped-toggle"
              :aria-expanded="isSkippedFlowGroupExpanded(entry)"
              @click="toggleSkippedFlowGroup(entry)"
            >
              <span class="flow-skipped-toggle-icon" aria-hidden="true">{{
                isSkippedFlowGroupExpanded(entry) ? '⌄' : '›'
              }}</span>
              <span>{{
                isSkippedFlowGroupExpanded(entry)
                  ? `收起 ${entry.nodes.length} 个未执行的废弃步骤`
                  : `${entry.nodes.length} 个未执行的废弃步骤已折叠`
              }}</span>
            </button>
          </div>
          <template v-if="entry.type !== 'skipped' || isSkippedFlowGroupExpanded(entry)">
            <div
              v-for="n in entry.nodes"
              :key="n.id"
              :data-flow-node-id="n.id"
              class="flow-step"
              :class="[
                flowClass(n),
                {
                  open: expandedNodeId === n.id,
                  'is-extra': n.step_type === 'offsite',
                  'is-offsite-current': isCurrentOffsiteSegment(n),
                  'is-offsite-archived': n.step_type === 'offsite' && !!n.output?.archived,
                  'is-flow-history': isFlowHistoryNode(n),
                  'is-cloned': isClonedNode(n),
                  'is-flow-anchor': n.id === flowAnchorNodeId,
                },
              ]"
            >
              <div class="flow-dot" aria-hidden="true" />
              <div class="flow-step-body">
                <button type="button" class="flow-step-head" @click="toggleNodeExpand(n)">
                  <div class="flow-step-title">
                    <span
                      class="flow-idx"
                      :class="{ 'flow-idx--extra': n.step_type === 'offsite' }"
                      >{{ n.step_index + 1 }}</span
                    >
                    <span class="flow-step-name">{{ n.title }}</span>
                    <el-tag
                      v-if="nodeHasAdapt(n)"
                      size="small"
                      type="warning"
                      effect="plain"
                      round
                    >
                      适配
                    </el-tag>
                    <el-tag
                      v-if="n.step_type === 'offsite'"
                      size="small"
                      type="warning"
                      effect="plain"
                      round
                    >
                      临时
                    </el-tag>
                    <el-tag
                      v-else-if="n.step_type === 'archive'"
                      size="small"
                      type="info"
                      effect="plain"
                      round
                    >
                      归档
                    </el-tag>
                    <el-tag
                      v-else-if="isClonedNode(n)"
                      size="small"
                      type="success"
                      effect="plain"
                      round
                    >
                      克隆
                    </el-tag>
                    <el-tag
                      v-if="isCurrentOffsiteSegment(n)"
                      size="small"
                      type="warning"
                      effect="dark"
                      round
                    >
                      当前段
                    </el-tag>
                    <el-tag
                      v-if="n.step_type === 'offsite' && n.output?.archived"
                      size="small"
                      type="info"
                      effect="plain"
                      round
                    >
                      已归档
                    </el-tag>
                    <el-tag
                      v-else-if="offsiteEntryLabel(n)"
                      size="small"
                      type="warning"
                      effect="plain"
                      round
                    >
                      {{ offsiteEntryLabel(n) }}
                    </el-tag>
                    <el-tag
                      v-else-if="n.step_type !== 'offsite' && n.status === 'skipped'"
                      size="small"
                      type="info"
                      effect="plain"
                      round
                    >
                      {{ nodeBypassed(n) ? '已绕过' : '跳过' }}
                    </el-tag>
                    <el-tag
                      v-else-if="n.step_type !== 'offsite' && n.status === 'waiting_human' && isCurrent(n)"
                      size="small"
                      type="danger"
                      effect="dark"
                      round
                    >
                      待确认
                    </el-tag>
                    <el-tag
                      v-else-if="n.step_type !== 'offsite' && n.status === 'waiting_human'"
                      size="small"
                      type="info"
                      effect="plain"
                      round
                    >
                      已挂起
                    </el-tag>
                    <el-tag
                      v-else-if="n.step_type !== 'offsite' && isCurrent(n) && n.status === 'pending'"
                      size="small"
                      type="info"
                      effect="plain"
                      round
                    >
                      待跑
                    </el-tag>
                    <el-tag
                      v-else-if="n.step_type !== 'offsite' && isCurrent(n)"
                      size="small"
                      type="primary"
                      effect="light"
                      round
                    >
                      当前
                    </el-tag>
                  </div>
                  <div class="flow-step-meta">
                    {{ stepTypeLabel(n.step_type) }} · {{ statusLabel(n.status) || n.status }}
                    <span v-if="offsiteInvokedLabel(n)" class="meta-offsite-member">
                      · {{ offsiteInvokedLabel(n) }}
                    </span>
                    <span v-if="reviewLabel(n)" class="meta-review" :class="'is-' + reviewAction(n)">
                      · {{ reviewLabel(n) }}
                    </span>
                    <span v-if="n.gate" class="meta-gate"> · 待确认</span>
                    <span class="flow-expand-caret">{{
                      expandedNodeId === n.id ? '收起' : '展开'
                    }}</span>
                  </div>
                </button>
                <div class="flow-step-actions">
                  <template v-if="n.step_type === 'offsite' || n.step_type === 'archive'">
                    <!-- 说明集中在输入区归档提示；此处不重复上课 -->
                  </template>
                  <el-button
                    v-else
                    size="small"
                    text
                    type="primary"
                    @click.stop="restartFromNode(n)"
                  >
                    从这里继续
                  </el-button>
                </div>
                <div v-if="expandedNodeId === n.id" class="flow-io">
                  <div class="flow-io-block">
                    <div class="flow-io-label">输入（用户说了啥）</div>
                    <pre class="flow-io-pre">{{ formatIo(n.input, 'input') }}</pre>
                  </div>
                  <div class="flow-io-block">
                    <div class="flow-io-label">输出（做了啥）</div>
                    <pre class="flow-io-pre">{{ formatIo(n.output, 'output') }}</pre>
                  </div>
                  <div v-if="n.journalPath" class="flow-io-path">台账：{{ n.journalPath }}</div>
                </div>
              </div>
            </div>
          </template>
        </template>

        <div
          class="flow-current-bar"
          :class="{
            'is-human-attention': needsHuman && !offsiteActive,
            'is-offsite-attention': offsiteActive,
          }"
        >
          <span class="flow-current-label">{{
            offsiteActive
              ? offsiteMode === 'planned'
                ? '临时协助'
                : '临时协助'
              : needsHuman
                ? '待确认'
                : '当前节点'
          }}</span>
          <strong>
            {{
              offsiteActive
                ? activeOffsiteNode?.title || '临时协助'
                : detail.nodes.find((n) => isCurrent(n))?.title ||
                  (detail.session.status === 'archived' ? '已归档（可重开）' : '—')
            }}
          </strong>
        </div>
      </template>
      <div v-else class="flow-empty">
        <p>开聊后显示流程步骤</p>
      </div>
    </div>

    <!-- Tab：群报告（# 参数 + 各节点入出 + 备注） -->
    <div v-show="rightTab === 'announce'" class="wb-right-pane announce-pane">
      <div class="announce-toolbar">
        <span class="announce-title">群报告</span>
        <div class="announce-actions">
          <el-button
            size="small"
            plain
            :disabled="!activeId"
            @click="openDocsHub"
          >
            打开 MD
          </el-button>
          <el-button
            size="small"
            text
            :disabled="!activeId"
            :loading="announceOpenLoading"
            :title="announceMdHint"
            @click="openAnnouncementMd"
          >
            系统打开
          </el-button>
          <el-button
            size="small"
            type="primary"
            plain
            :disabled="!activeId"
            :loading="announceLoading"
            @click="rebuildAnnouncement"
          >
            刷新报告
          </el-button>
        </div>
      </div>

      <div v-if="detail" class="announce-card">
        <div class="announce-card-head">
          <div class="announce-card-title">{{ detail.session.title || '未命名任务' }}</div>
          <div class="announce-card-meta">
            <el-tag size="small" round effect="plain" :type="statusType(detail.session.status)">
              {{ statusLabel(detail.session.status) }}
            </el-tag>
            <el-tag
              v-if="archiveOutcomeTag"
              size="small"
              round
              effect="dark"
              :type="archiveOutcomeTag.type"
            >
              {{ archiveOutcomeTag.label }}
            </el-tag>
            <span v-if="detail.session.updated_at" class="announce-card-time">{{
              formatTime(detail.session.updated_at)
            }}</span>
          </div>
        </div>

        <div class="announce-section">
          <div class="announce-section-title"># 参数</div>
          <div
            v-if="sessionParamsList.length || sessionGroupCard || sessionGroupFolder"
            class="announce-params"
          >
            <div v-if="sessionGroupCard" class="announce-param announce-param--card">
              <div class="announce-param-head">
                <code>#群聊</code>
                <span class="announce-param-head-label">群聊名片</span>
              </div>
              <pre class="announce-param-card-body">{{ sessionGroupCard }}</pre>
            </div>
            <div v-if="sessionGroupFolder" class="announce-param">
              <code>#文件夹</code>
              <span :title="sessionGroupFolder">{{ sessionGroupFolder }}</span>
            </div>
            <div
              v-for="(v, i) in sessionParamsList"
              :key="i"
              class="announce-param"
            >
              <code>#{{ i + 1 }}</code>
              <span :title="v">{{ v }}</span>
            </div>
          </div>
          <p v-else class="announce-empty-line">
            暂无 · 开聊后有 #群聊 / #文件夹；人工提交后有 #1…
          </p>
        </div>

        <div v-if="announceKickoff" class="announce-section">
          <div class="announce-section-title">启动说明</div>
          <pre class="announce-io-block">{{ announceKickoff }}</pre>
        </div>

        <div class="announce-section">
          <div class="announce-section-title">节点输入 / 输出</div>
          <ul v-if="announceProgress.length" class="announce-steps">
            <li v-for="row in announceProgress" :key="row.id" class="announce-step">
              <span class="announce-step-idx">{{ row.idx }}</span>
              <div class="announce-step-main">
                <div class="announce-step-top">
                  <span class="announce-step-name">{{ row.title }}</span>
                  <el-tag size="small" round :type="row.tagType" effect="plain">{{
                    row.statusLabel
                  }}</el-tag>
                </div>
                <div v-if="row.nodeHash?.length" class="announce-step-hash">
                  <div
                    v-for="h in row.nodeHash"
                    :key="h.key"
                    class="announce-param announce-param--inline"
                  >
                    <code>{{ h.key }}</code>
                    <span :title="h.value">{{ h.value }}</span>
                  </div>
                </div>
                <div v-if="row.inText" class="announce-io">
                  <span class="announce-io-label">入</span>
                  <pre class="announce-io-block">{{ row.inText }}</pre>
                </div>
                <div v-if="row.outText" class="announce-io">
                  <span class="announce-io-label">出</span>
                  <pre class="announce-io-block">{{ row.outText }}</pre>
                </div>
                <div v-if="row.note" class="announce-io announce-io--note">
                  <span class="announce-io-label">审</span>
                  <p class="announce-step-digest">{{ row.note }}</p>
                </div>
                <p
                  v-if="!row.inText && !row.outText && !row.note && row.pendingHint"
                  class="announce-step-digest"
                >
                  {{ row.pendingHint }}
                </p>
              </div>
            </li>
          </ul>
          <p v-else class="announce-empty-line">暂无步骤</p>
        </div>

        <div v-if="announceUserNotes.length" class="announce-section">
          <div class="announce-section-title">用户参与</div>
          <ul class="announce-notes-list">
            <li v-for="(u, i) in announceUserNotes" :key="i" class="announce-note-item">
              <span class="announce-note-meta"
                >{{ u.actionLabel }}<template v-if="u.nodeTitle"> · {{ u.nodeTitle }}</template></span
              >
              <span class="announce-note-text">{{ u.text }}</span>
            </li>
          </ul>
        </div>

        <div class="announce-section announce-notes-section">
          <div class="announce-section-title">备注</div>
          <el-input
            v-model="sessionNotesDraft"
            type="textarea"
            :rows="4"
            maxlength="2000"
            show-word-limit
            placeholder="写给自己/团队的备注（不覆盖自动进度）"
            :disabled="!activeId || notesSaving"
          />
          <div class="announce-notes-actions">
            <el-button
              size="small"
              type="primary"
              :loading="notesSaving"
              :disabled="!activeId"
              @click="saveSessionNotes"
            >
              保存备注
            </el-button>
          </div>
        </div>
      </div>
      <div v-else class="announce-empty">
        <p>选择会话后查看群报告</p>
      </div>
    </div>

  </aside>
</template>

<script setup>
import {
  detail,
  activeId,
  archiveOutcomeTag,
  offsiteActive,
  offsiteMode,
  activeOffsiteNode,
  needsHuman,
  rightTab,
  expandedNodeId,
  flowEntries,
  flowAnchorNodeId,
  announceProgress,
  announceUserNotes,
  announceKickoff,
  sessionParamsList,
  sessionGroupCard,
  sessionGroupFolder,
  sessionNotesDraft,
  announceLoading,
  announceOpenLoading,
  notesSaving,
  announceMdHint,
  isSkippedFlowGroupExpanded,
  toggleSkippedFlowGroup,
  flowClass,
  isCurrentOffsiteSegment,
  isFlowHistoryNode,
  isClonedNode,
  toggleNodeExpand,
  nodeHasAdapt,
  stepTypeLabel,
  isCurrent,
  offsiteEntryLabel,
  offsiteInvokedLabel,
  reviewLabel,
  reviewAction,
  restartFromNode,
  formatIo,
  nodeBypassed,
  statusLabel,
  statusType,
  formatTime,
  openAnnouncementMd,
  openDocsHub,
  rebuildAnnouncement,
  saveSessionNotes,
} from '../composables/useSessionDetail'
</script>

<style scoped>
.flow-skipped-group {
  position: relative;
  margin: 2px 0 10px 7px;
  padding: 0 0 0 16px;
  border-left: 2px dashed rgba(0, 0, 0, 0.1);
}

.flow-skipped-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 5px 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.025);
  color: var(--ecw-text-3, #8e8ea0);
  font-size: 11.5px;
  line-height: 1.35;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}

.flow-skipped-toggle:hover {
  border-color: rgba(0, 122, 255, 0.2);
  background: rgba(0, 122, 255, 0.05);
  color: var(--ecw-accent, #007aff);
}

.flow-skipped-toggle-icon {
  flex-shrink: 0;
  font-size: 15px;
  line-height: 11px;
  transition: transform 0.15s ease;
}

.flow-skipped-group.open .flow-skipped-toggle-icon {
  transform: rotate(90deg);
}

.flow-step-body {
  min-width: 0;
}

.flow-step-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  color: var(--ecw-text-1, #0d0d0d);
  line-height: 1.35;
}

.flow-idx {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.05);
  font-size: 11px;
  font-weight: 700;
  color: var(--ecw-text-2, #6e6e80);
}

.flow-step.current .flow-idx {
  background: var(--ecw-accent-soft, #ecf5ff);
  color: var(--ecw-accent, #409eff);
}

.flow-step.running .flow-idx {
  background: rgba(0, 122, 255, 0.12);
  color: var(--ecw-accent, #007aff);
}

.flow-step-name {
  min-width: 0;
}

.flow-step-meta {
  font-size: 11.5px;
  color: var(--ecw-text-3, #8e8ea0);
  margin-top: 3px;
  letter-spacing: -0.01em;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.wb-right-tabs {
  display: flex;
  gap: 4px;
  margin: 0 0 14px;
  padding: 3px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.05);
  box-shadow: inset 0 0.5px 1px rgba(0, 0, 0, 0.04);
}

.wb-right-tab {
  flex: 1;
  border: none;
  background: transparent;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 550;
  color: var(--ecw-text-2, #6e6e73);
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.wb-right-tab:hover {
  color: var(--ecw-text-1, #1d1d1f);
}

.wb-right-tab.active {
  background: #fff;
  color: var(--ecw-text-1, #1d1d1f);
  font-weight: 650;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.wb-right-tab-badge {
  margin-left: 4px;
  min-width: 14px;
  padding: 0 4px;
  border-radius: 8px;
  font-size: 10px;
  line-height: 14px;
  background: rgba(230, 162, 60, 0.25);
  color: #9a6414;
}

.wb-right-pane {
  min-height: 0;
}

.announce-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.announce-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  gap: 8px;
  flex-shrink: 0;
}

.announce-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--ecw-text-1, #1d1d1f);
}

.announce-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.announce-card {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 14px 18px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(248, 249, 252, 0.88) 100%);
  border: 0.5px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.announce-card-head {
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
}

.announce-card-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--ecw-text-1, #1d1d1f);
  line-height: 1.35;
  margin-bottom: 8px;
  word-break: break-word;
}

.announce-card-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.announce-card-time {
  font-size: 11px;
  color: var(--ecw-text-3, #86868b);
  margin-left: 2px;
}

.announce-section {
  margin-bottom: 16px;
}

.announce-section:last-child {
  margin-bottom: 0;
}

.announce-section-title {
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ecw-text-3, #86868b);
  margin-bottom: 8px;
}

.announce-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.announce-step {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 10px 10px 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  border: 0.5px solid rgba(0, 0, 0, 0.05);
}

.announce-step-idx {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--ecw-accent, #007aff);
  background: rgba(0, 122, 255, 0.1);
}

.announce-step-main {
  flex: 1;
  min-width: 0;
}

.announce-step-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.announce-step-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ecw-text-1, #1d1d1f);
  line-height: 1.35;
}

.announce-step-digest {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ecw-text-2, #6e6e73);
  word-break: break-word;
}

.announce-io {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.announce-io-label {
  align-self: flex-start;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--ecw-accent, #007aff);
  background: rgba(0, 122, 255, 0.1);
  padding: 1px 6px;
  border-radius: 4px;
}

.announce-io--note .announce-io-label {
  color: #e6a23c;
  background: rgba(230, 162, 60, 0.12);
}

.announce-io-block {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.03);
  border: 0.5px solid rgba(0, 0, 0, 0.05);
  font-size: 12px;
  line-height: 1.5;
  color: var(--ecw-text-1, #1d1d1f);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace;
  max-height: 180px;
  overflow: auto;
}

.announce-notes-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.announce-note-item {
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  border: 0.5px solid rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.announce-note-meta {
  font-size: 11px;
  font-weight: 650;
  color: var(--ecw-text-3, #86868b);
}

.announce-note-text {
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--ecw-text-1, #1d1d1f);
  word-break: break-word;
}

.announce-empty-line {
  margin: 0;
  font-size: 12.5px;
  color: var(--ecw-text-3, #86868b);
}

.announce-params {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.announce-step-hash {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0 0 8px;
}

.announce-param--inline {
  padding: 6px 8px !important;
  background: rgba(0, 122, 255, 0.04) !important;
}

.announce-param--inline span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.announce-param {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--ecw-text-1, #1d1d1f);
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.65);
  border: 0.5px solid rgba(0, 0, 0, 0.05);
  word-break: break-word;
}

.announce-param code {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 650;
  color: var(--ecw-accent, #007aff);
  background: rgba(0, 122, 255, 0.08);
  padding: 1px 6px;
  border-radius: 4px;
}

.announce-param--card {
  flex-direction: column;
  gap: 6px;
}

.announce-param-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.announce-param-head-label {
  font-size: 11px;
  color: var(--ecw-text-3, #86868b);
}

.announce-param-card-body {
  margin: 0;
  width: 100%;
  max-height: 160px;
  overflow: auto;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.03);
  border: 0.5px solid rgba(0, 0, 0, 0.05);
  font-size: 11.5px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace;
  color: var(--ecw-text-2, #6e6e73);
  box-sizing: border-box;
}

.announce-notes-section :deep(.el-textarea__inner) {
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
  min-height: 96px;
}

.announce-notes-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.announce-empty {
  padding: 28px 12px;
  text-align: center;
  color: var(--ecw-text-3, #86868b);
  font-size: 13px;
}

.flow-archive-hint {
  margin: 0 0 12px;
  font-size: 11.5px;
  color: var(--ecw-text-3, #8b8f9a);
}
.flow-step.is-flow-history {
  opacity: 0.72;
}
.flow-step.is-flow-anchor {
  scroll-margin-block: 12px;
}
.flow-offsite-hint {
  margin: 0 0 12px;
  font-size: 11.5px;
  color: #9a6414;
  line-height: 1.45;
}
.flow-offsite-action-tip {
  font-size: 11px;
  color: var(--ecw-text-3, #8b8f9a);
  line-height: 1.4;
}
.flow-archive-outcome.is-ok {
  color: var(--el-color-success);
  font-weight: 600;
}
.flow-archive-outcome.is-fail {
  color: var(--el-color-danger);
  font-weight: 600;
}
.flow-step-actions {
  padding: 0 4px 6px 28px;
}

.flow-params {
  margin: 0 0 14px;
  padding: 12px 12px 10px;
  border-radius: 12px;
  background: linear-gradient(160deg, #f5f9ff 0%, #fff 70%);
  border: 1px solid rgba(64, 158, 255, 0.16);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.05);
}

.flow-params-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--ecw-accent, #409eff);
  margin-bottom: 8px;
}

.flow-param-card {
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(64, 158, 255, 0.12);
}

.flow-param-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.flow-param-card-label {
  font-size: 11px;
  color: var(--ecw-text-3, #8b8f9a);
}

.flow-param-card-body {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--ecw-text-2, #5c5f6a);
  max-height: 120px;
  overflow: auto;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
}

.flow-params-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 160px;
  overflow: auto;
}

.flow-param-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  font-size: 12px;
}

.flow-param-item--folder {
  margin-bottom: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(64, 158, 255, 0.1);
}

.flow-param-key {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(64, 158, 255, 0.1);
  color: var(--ecw-accent, #409eff);
}

.flow-param-val {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ecw-text-1, #0b0c0f);
}

.flow-step-head {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  padding: 0;
  text-align: left;
  cursor: pointer;
}

.flow-step-head:hover .flow-step-title {
  color: var(--ecw-accent, #409eff);
}

.flow-expand-caret {
  margin-left: auto;
  font-size: 11px;
  color: var(--ecw-accent, #409eff);
  font-weight: 600;
}

.flow-io {
  margin-top: 10px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.flow-io-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--ecw-text-3, #8b8f9a);
  margin-bottom: 4px;
}

.flow-io-pre {
  margin: 0;
  max-height: 160px;
  overflow: auto;
  font-size: 11.5px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--ecw-text-1, #0b0c0f);
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
}

.flow-io-path {
  font-size: 10.5px;
  color: var(--ecw-text-3, #8b8f9a);
  word-break: break-all;
}

.flow-current-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ecw-text-3, #8e8ea0);
  margin-bottom: 2px;
}

.flow-empty {
  padding: 28px 8px;
  text-align: center;
  color: var(--ecw-text-3, #8e8ea0);
  font-size: 12.5px;
}

.flow-empty p {
  margin: 0;
}

.meta-gate {
  color: var(--ecw-text-3, #8e8ea0);
}

.meta-offsite-member {
  color: var(--el-color-primary, #409eff);
  font-weight: 550;
}

.meta-review.is-pending {
  color: #c45c26;
  font-weight: 600;
}
.meta-review.is-approve {
  color: #2f6f4e;
}
.meta-review.is-reject {
  color: #b42318;
}
</style>
