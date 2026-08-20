<template>
  <div class="workbench">
    <!-- 左：会话 -->
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
            <el-button size="default" text bg type="danger" @click="doDelete">删除</el-button>
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
                      <span class="composer-toolbar-hint">{{ composerToolbarHint }}</span>
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
          :class="{ active: rightTab === 'adapt' }"
          @click="rightTab = 'adapt'"
        >
          适配
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

      <!-- Tab：流程 -->
      <div v-show="rightTab === 'flow' || rightTab === 'adapt'" class="wb-right-pane">
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
        <template v-if="visibleFlowEntries.length">
          <template v-for="entry in visibleFlowEntries" :key="entry.key">
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
          <p v-if="rightTab === 'adapt'">本会话还没有带适配标记的步骤</p>
          <p v-else>开聊后显示流程步骤</p>
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
              :loading="announceOpenLoading"
              :title="announceMdHint"
              @click="openAnnouncementMd"
            >
              打开 MD
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
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted, nextTick, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  formatBusinessIo,
  digestBusinessIo,
  wholeOutputText,
  abbrGroupTag,
  formatSessionAutoTitle,
  extractCallArgsFromSlash,
  isMentionAssistOnly,
  nodeStatusLabel,
  isDiscardedUnexecutedFlowNode,
  stepTypeLabel as sharedStepTypeLabel,
  MAX_PROJECT_PARAMS,
  isFurnaceMember,
  FURNACE_DISPLAY_NAME,
} from '@acw/shared'
import { api, connectSessionWs } from '../api'
import AppLogo from '../components/AppLogo.vue'
import TerminalSessionCard from '../components/terminal/TerminalSessionCard.vue'
import { syncFurnaceSpriteState } from '../composables/furnaceUi.js'

const TerminalWorkspace = defineAsyncComponent(
  () => import('../components/terminal/TerminalWorkspace.vue'),
)
const FurnaceWorkspace = defineAsyncComponent(
  () => import('../components/terminal/FurnaceWorkspace.vue'),
)

const route = useRoute()
const router = useRouter()

const sessions = ref([])
const groups = ref([])
const members = ref([])
const detail = ref(null)
const activeId = ref(null)
const terminalSessions = ref([])
const activeTerminalId = ref(null)
const terminalConnectionStatus = ref('connecting')
const lastTerminalSize = ref(null)
const furnaceSurface = ref('chat')
const terminalPrefs = ref({
  theme: 'project-dark',
  fontSize: 13,
  cursorBlink: true,
  pastePolicy: 'confirm',
  autoCollapseOnExit: false,
  scrollback: 5000,
})
const editTitle = ref('')
const startTarget = ref('')
const listFilter = ref('all')
/** XSender 实例：该组件无可靠 v-model，提交时用 ref 取文 */
const senderRef = ref(null)
/** 刚用 # 快捷覆写输入框后，短暂忽略 sync，避免面板闪回 */
let hashInsertLockUntil = 0
const sending = ref(false)
const gating = ref(false)
/** 开聊 / 一键演示防连点 */
const startingChat = ref(false)
/** 快捷指令 / */
const slashCommands = ref([])
const slashOpen = ref(false)
const slashQuery = ref('')
const slashIndex = ref(0)
/** @ 成员 */
const atOpen = ref(false)
const atQuery = ref('')
const atIndex = ref(0)
/** # 文本快捷（仅唤起；选中插正文） */
const hashOpen = ref(false)
const hashQuery = ref('')
const hashIndex = ref(0)
/** 待发送附件 */
const pendingFiles = ref([])
const uploading = ref(false)
const fileInputRef = ref(null)
/** 流程轨展开的节点 id */
const expandedNodeId = ref(null)
/** 默认折叠的连续跳过步骤；按当前会话的步骤分组 key 记录展开状态 */
const expandedSkippedFlowGroups = ref({})
/** 右侧：流程 | 群报告 */
const rightTab = ref('flow')
const announceLoading = ref(false)
const announceOpenLoading = ref(false)
const sessionNotesDraft = ref('')
const notesSaving = ref(false)
/** 底部闸门+输入区折叠 */
const footerCollapsed = ref(false)
let ws = null

const filteredSlashCmds = computed(() => {
  const q = (slashQuery.value || '').toLowerCase()
  const list = slashCommands.value.filter((c) => c.enabled !== false)
  if (!q) return list
  return list.filter(
    (c) =>
      c.slash.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q),
  )
})

const filteredAtMembers = computed(() => {
  const q = (atQuery.value || '').toLowerCase().trim()
  const list = members.value || []
  if (!q) return list
  return list.filter(
    (m) =>
      String(m.display_name || '')
        .toLowerCase()
        .includes(q) ||
      String(m.name || '')
        .toLowerCase()
        .includes(q) ||
      String(m.config?.description || '')
        .toLowerCase()
        .includes(q),
  )
})

const filterOptions = [
  { label: '全部', value: 'all' },
  { label: '进行中', value: 'active' },
  { label: '已归档', value: 'archived' },
]

/** 开聊可选成员（启用中） */
const startableMembers = computed(() =>
  (members.value || []).filter((m) => m.enabled !== false),
)

function readSenderText() {
  return readSenderTextRaw().trim()
}

/** 读输入框原文 */
function readSenderTextRaw() {
  const inst = senderRef.value
  if (!inst) return ''
  try {
    if (typeof inst.getModelValue === 'function') {
      return String(inst.getModelValue()?.text || '')
    }
    const sender = typeof inst.getSender === 'function' ? inst.getSender() : null
    if (sender?.getText) return String(sender.getText() || '')
  } catch {
    /* ignore */
  }
  return ''
}

/** 去掉末尾的 #快捷触发段（# / #xxx），可无前导空格 */
function stripTrailingHashTrigger(text) {
  let s = String(text || '')
  for (let i = 0; i < 6; i++) {
    const next = s.replace(/\s*#[^\s#]*$/u, '').replace(/[ \t]+$/u, '')
    if (next === s) break
    s = next
  }
  return s
}

/** 纯文本 → XSender chatNode（按行拆 Write） */
function textToChatNode(text) {
  const lines = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
  return lines.map((line) => [{ type: 'Write', text: line }])
}

/**
 * 整框覆写输入内容。
 * 注意：组件 setText 是光标插入；clear() 又是未 await 的 async reset，
 * 二者组合会丢字。正确做法是直接 await sender.reset({ chatNode }).
 */
async function replaceSenderText(text) {
  const inst = senderRef.value
  if (!inst) return
  const next = text == null ? '' : String(text)
  hashInsertLockUntil = Date.now() + 300
  try {
    const sender = typeof inst.getSender === 'function' ? inst.getSender() : null
    if (sender && typeof sender.reset === 'function') {
      await sender.reset({
        clearHistory: true,
        chatNode: textToChatNode(next),
      })
      return
    }
  } catch {
    /* ignore */
  }
  // 极端降级：仍尽量写进去
  try {
    if (typeof inst.clear === 'function') inst.clear()
    await nextTick()
    await new Promise((r) => setTimeout(r, 30))
    if (next) inst.setText?.(next)
  } catch {
    /* ignore */
  }
}

/** 仅在光标处追加（真正 insert） */
function appendSenderText(fragment) {
  const s = fragment == null ? '' : String(fragment)
  if (!s) return
  try {
    senderRef.value?.setText?.(s)
  } catch {
    /* ignore */
  }
}

function clearSender() {
  const inst = senderRef.value
  if (!inst) return
  try {
    if (typeof inst.clear === 'function') inst.clear()
  } catch {
    /* ignore */
  }
}

/** 一键复制输入框正文 */
async function copyComposerText() {
  const text = readSenderText()
  if (!text) {
    ElMessage.warning('输入框为空')
    return
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    ElMessage.success('已复制')
  } catch (e) {
    ElMessage.warning(e?.message || '复制失败')
  }
}

/** Element-Plus-X Conversations 菜单：必须同时有 key + command，否则 command 为 undefined 导致点击无响应 */
const convMenu = [
  { label: '置顶', key: 'pin', command: 'pin' },
  { label: '取消置顶', key: 'unpin', command: 'unpin' },
  { label: '重命名', key: 'rename', command: 'rename' },
  {
    label: '删除',
    key: 'delete',
    command: 'delete',
    divided: true,
    menuItemHoverStyle: {
      color: 'red',
      backgroundColor: 'rgba(255, 0, 0, 0.1)',
    },
  },
]

const filteredSessions = computed(() => {
  let list
  if (listFilter.value === 'all') list = sessions.value.slice()
  else if (listFilter.value === 'archived') {
    list = sessions.value.filter((s) => s.status === 'archived')
  } else {
    list = sessions.value.filter((s) => s.status !== 'archived')
  }
  // 先群模板、后成员；块内置顶优先，再按更新时间
  return list.sort((a, b) => {
    const am = a.adhoc ? 1 : 0
    const bm = b.adhoc ? 1 : 0
    if (am !== bm) return am - bm
    const pa = a.pinned ? 1 : 0
    const pb = b.pinned ? 1 : 0
    if (pb !== pa) return pb - pa
    return String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
  })
})

/** 会话列表：#1 正文 + 群模板缩写标签；hover 气泡展示全文（前缀 + 群全称） */
function sessionListParts(s) {
  const ctx = s?.context && typeof s.context === 'object' ? s.context : {}
  const groupTitle = String(s.groupTitle || ctx.groupTitle || '').trim()
  const abbr = s.groupTitleAbbr || ctx.groupTitleAbbr || abbrGroupTag(groupTitle)

  // 手改过：整段标题，不用缩写标签
  if (ctx.titleAuto === false && s.title) {
    const full = String(s.title).trim()
    return {
      label: full,
      labelPrefix: full,
      groupAbbr: '',
      hoverTitle: full,
    }
  }

  const p1 = String(
    (Array.isArray(ctx.paramsList) && ctx.paramsList[0]) ||
      ctx.params?.['#1'] ||
      '',
  ).trim()
  const groupAbbr = abbr || ''
  const labelPrefix = p1
  const label =
    formatSessionAutoTitle({
      param1: p1,
      groupTitle,
      groupTitleAbbr: groupAbbr,
    }) ||
    s.title ||
    groupTitle ||
    '未命名'

  // 全文：优先「#1 · 群全称」，否则群全称 / 会话标题
  let hoverTitle = ''
  if (p1 && groupTitle) hoverTitle = `${p1} · ${groupTitle}`
  else if (groupTitle) hoverTitle = groupTitle
  else if (p1) hoverTitle = p1
  else hoverTitle = String(s.title || label || '').trim()

  return {
    label,
    labelPrefix,
    groupAbbr,
    hoverTitle,
  }
}

/** 相对时间：最小 h，最大 w；已归档返回空 */
function relativeTime(isoOrTs) {
  if (!isoOrTs) return ''
  const t = new Date(isoOrTs).getTime()
  if (!t || Number.isNaN(t)) return ''
  const diffMs = Date.now() - t
  if (diffMs < 0) return ''
  const mins = Math.floor(diffMs / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  return `${weeks}w`
}

/** 会话历史两大块：群模板 / 成员（块内置顶+时间已在 filteredSessions 排好） */
const conversationItems = computed(() =>
  filteredSessions.value.map((s) => {
    const outcome = archiveOutcomeOf(s)
    const parts = sessionListParts(s)
    return {
      uniqueKey: s.id,
      label: parts.label,
      labelPrefix: parts.labelPrefix,
      groupAbbr: parts.groupAbbr,
      group: s.adhoc ? '成员' : '群模板',
      id: s.id,
      status: s.status,
      title: s.title,
      hoverTitle: parts.hoverTitle,
      pinned: !!s.pinned,
      archiveOutcome: outcome,
      adhoc: !!s.adhoc,
      timeLabel: ['archived'].includes(s.status) ? '' : relativeTime(s.updated_at),
    }
  }),
)

function isArchiveMessage(m) {
  if (!m) return false
  if (m.type === 'status' && /归档/.test(messageText(m) || '')) return true
  const t = messageText(m) || ''
  return m.role === 'system' && /任务已.*归档|自动归档|已归档/.test(t)
}

/** Element-Plus-X BubbleList — 大气气泡 + 发送人简称 */
const bubbleList = computed(() => {
  if (!detail.value?.messages) return []
  const messages = detail.value.messages
    .filter((m) => {
      if (m.type === 'gate' && m.content?.mode === 'archive_confirm') return false
      if (isArchiveMessage(m)) return false
      return true
    })
    .map((m) => {
    const isUser = m.role === 'user'
    const isSystem = m.role === 'system'
    const isGate = m.type === 'gate'
    const isArchive = isArchiveMessage(m)
    const full = roleLabel(m)
    const short = isArchive ? '系统' : shortSender(m, full)
    const atts = m.content?.attachments || []
    const kind = isUser
      ? 'user'
      : isArchive
        ? 'archive'
        : isSystem
          ? 'system'
          : isGate
            ? 'gate'
            : 'agent'
    return {
      id: m.id,
      content: messageText(m),
      attachments: atts,
      placement: isUser ? 'end' : 'start',
      /** 去掉组件自带外层壳，只保留我们自己的一层气泡 */
      noStyle: true,
      shape: 'round',
      maxWidth: '78%',
      avatarGap: 12,
      senderFull: full,
      senderShort: short,
      senderInitial: short.slice(0, 1),
      _kind: kind,
      _raw: m,
      _time: m.created_at || '',
    }
  })
  const terminals = terminalSessions.value.map((terminal) => ({
    id: `terminal:${terminal.id}`,
    content: '',
    placement: 'start',
    noStyle: true,
    shape: 'round',
    maxWidth: '90%',
    avatarGap: 12,
    senderFull: terminal.label || '内嵌终端',
    senderShort: '终端',
    senderInitial: 'T',
    _kind: 'terminal',
    terminal,
    _time: terminal.startedAt || '',
  }))
  return [...messages, ...terminals].sort((a, b) => String(a._time).localeCompare(String(b._time)))
})

const activeTerminal = computed(
  () => terminalSessions.value.find((terminal) => terminal.id === activeTerminalId.value) || null,
)

function isFurnaceTuiContext(terminal) {
  if (terminal?.memberId) {
    const mem = members.value.find((x) => x.id === terminal.memberId)
    if (isFurnaceMember(mem)) return true
  }
  if (isFurnaceMember({ display_name: terminal?.label, name: terminal?.label })) return true
  const fromId = detail.value?.group?.config?.fromMemberId || ''
  if (fromId) {
    const mem = members.value.find((x) => x.id === fromId)
    if (isFurnaceMember(mem)) return true
  }
  const cmd = `${terminal?.command || ''} ${terminal?.label || ''}`
  return /(^|[\s/\\])grok(\.exe)?(\s|$)/i.test(cmd)
}

const furnaceTuiPagefill = computed(() => isFurnaceTuiContext(activeTerminal.value))

const pendingGate = computed(() => {
  if (!detail.value) return null
  if (detail.value.session.status === 'archived') return null
  const msgs = [...detail.value.messages].reverse()
  const nodes = detail.value.nodes || []
  const curIdx = Number(detail.value.session.current_step_index)
  const curNode = Number.isFinite(curIdx)
    ? nodes.find((n) => Number(n.step_index) === curIdx)
    : null
  const adapterGate = msgs.find(
    (m) =>
      m.type === 'gate' &&
      m.content?.mode === 'adapter_question' &&
      m.content?.humanAction === 'pending' &&
      !m.content?.answered,
  )
  if (adapterGate) return adapterGate
  // 开聊启动闸门（无节点，等人点通过后再跑流程）
  const pendingStart = detail.value.session.context?.pendingStart
  if (pendingStart && detail.value.session.status !== 'interrupted') {
    const startGate = msgs.find(
      (m) => m.type === 'gate' && m.content?.mode === 'session_start',
    )
    if (startGate) return startGate
  }
  // R02：中断恢复闸门
  if (detail.value.session.status === 'interrupted') {
    const ig = msgs.find((m) => m.type === 'gate' && m.content?.mode === 'interrupted')
    if (ig) return ig
  }
  // 优先当前游标节点上的待确认闸门，避免旧「待确认」抢交互
  if (curNode?.status === 'waiting_human') {
    const curGate = msgs.find(
      (m) =>
        m.type === 'gate' &&
        m.node_instance_id === curNode.id &&
        isPendingGate(m),
    )
    if (curGate) return curGate
  }
  // 回退：只认仍 waiting_human、且不早于游标的闸门（已绕过节点的 gate 会被 isPendingGate 滤掉）
  return (
    msgs.find((m) => {
      if (m.type !== 'gate' || !isPendingGate(m)) return false
      const n = nodes.find((x) => x.id === m.node_instance_id)
      if (!n) return !m.node_instance_id
      if (!Number.isFinite(curIdx)) return true
      return Number(n.step_index) >= curIdx
    }) || null
  )
})

function sessionCtx() {
  const ctx = detail.value?.session?.context || detail.value?.session?.context_json
  if (typeof ctx === 'string') {
    try {
      return JSON.parse(ctx)
    } catch {
      return null
    }
  }
  return ctx || null
}

/** 会话项目参数 #1 #2…（不含系统 #群聊） */
const sessionParamsList = computed(() => {
  const c = sessionCtx()
  if (Array.isArray(c?.paramsList) && c.paramsList.length) {
    return c.paramsList.slice(0, MAX_PROJECT_PARAMS)
  }
  if (c?.params && typeof c.params === 'object') {
    const keys = Object.keys(c.params)
      .filter((k) => /^#\d+$/.test(k))
      .map((k) => Number(k.slice(1)))
      .filter((n) => n >= 1 && n <= MAX_PROJECT_PARAMS)
      .sort((a, b) => a - b)
    if (keys.length) return keys.map((n) => c.params[`#${n}`])
  }
  return []
})

/** #群聊 → 整份群聊名片 */
const sessionGroupCard = computed(() => {
  const c = sessionCtx()
  if (!c) return ''
  return c.groupCard || c.params?.['#群聊'] || c.params?.['群聊'] || ''
})

/** #文件夹 → 群聊工作目录 */
const sessionGroupFolder = computed(() => {
  const c = sessionCtx()
  if (!c) return ''
  return (
    c.groupFolder ||
    c.params?.['#文件夹'] ||
    c.params?.['文件夹'] ||
    c.primaryWorkFolder ||
    c.workFolders?.[0] ||
    ''
  )
})

/**
 * # 文本快捷候选（# 只是唤起键，选中后只插入正文）
 * label：面板展示用，不含 #
 */
const hashItems = computed(() => {
  if (!activeId.value) return []
  const items = []
  const card = sessionGroupCard.value || ''
  items.push({
    key: '群聊',
    label: '群聊',
    name: '群聊名片',
    value: card,
    preview: previewHashValue(card),
    emptyHint: '开聊后写入群名片',
  })
  const folder = sessionGroupFolder.value || ''
  items.push({
    key: '文件夹',
    label: '文件夹',
    name: '工作文件夹',
    value: folder,
    preview: previewHashValue(folder),
    emptyHint: '未配置工作目录',
  })

  // 用户输入：空格/换行切成第 1…99 段
  const list = sessionParamsList.value.slice(0, MAX_PROJECT_PARAMS)
  const shown = Math.min(MAX_PROJECT_PARAMS, Math.max(list.length, 1))
  for (let n = 1; n <= shown; n++) {
    const text = list[n - 1] == null ? '' : String(list[n - 1])
    items.push({
      key: String(n),
      label: String(n),
      name: `输入·第${n}段`,
      value: text,
      preview: previewHashValue(text),
      emptyHint: n === 1 && !list.length ? '空格/换行分隔录入；最多 #99' : '空',
    })
  }

  // 节点输出：整段不切分
  const nodes = detail.value?.nodes || []
  let outIdx = 0
  for (const n of nodes) {
    const whole = wholeOutputText(n.output)
    if (!whole) continue
    outIdx += 1
    const title = n.title || `步骤 ${n.step_index + 1}`
    items.push({
      key: `出${outIdx}`,
      label: `出${outIdx}`,
      name: `输出·${title}`,
      value: whole,
      preview: previewHashValue(whole),
      emptyHint: '',
    })
  }

  return items
})

const filteredHashItems = computed(() => {
  const q = (hashQuery.value || '').toLowerCase().trim().replace(/^#/, '')
  const list = hashItems.value
  const filtered = !q
    ? list
    : list.filter(
        (h) =>
          h.key.toLowerCase().includes(q) ||
          h.label.toLowerCase().includes(q) ||
          h.name.toLowerCase().includes(q) ||
          String(h.value || '')
            .toLowerCase()
            .includes(q),
      )
  const n = Number(q)
  if (Number.isInteger(n) && n >= 1 && n <= MAX_PROJECT_PARAMS) {
    if (!filtered.some((h) => h.key === String(n))) {
      const text = sessionParamsList.value[n - 1] == null ? '' : String(sessionParamsList.value[n - 1])
      return [
        ...filtered,
        {
          key: String(n),
          label: String(n),
          name: `输入·第${n}段`,
          value: text,
          preview: previewHashValue(text),
          emptyHint: '尚未写入',
        },
      ]
    }
  }
  return filtered
})

function previewHashValue(v) {
  const s = String(v || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return ''
  return s.length > 48 ? `${s.slice(0, 48)}…` : s
}

/** 折叠时底栏提示文案 */
const footerCollapsedHint = computed(() => {
  if (pendingGate.value) {
    if (pendingGate.value.content?.mode === 'session_start') return '确认开始 · 展开'
    if (pendingGate.value.content?.mode === 'human_input') return '请输入 · 展开'
    if (pendingGate.value.content?.mode === 'need_params') return '请输入 · 展开'
    if (pendingGate.value.content?.mode === 'adapter_question') return '工具提问 · 展开'
    if (pendingGate.value.content?.mode === 'interrupted') return '崩溃恢复 · 展开'
    if (pendingGate.value.content?.requireHuman) return '须人工同意 · 展开'
    return '待你处理 · 展开'
  }
  return '输入消息 · 展开'
})

/** 出现待处理闸门时自动展开底栏，避免漏操作 */
watch(
  [
    pendingGate,
    terminalSessions,
    () => detail.value?.session?.status,
    () => detail.value?.nodes,
  ],
  () => {
    syncFurnaceSpriteState({
      pendingGate: pendingGate.value,
      sessionStatus: detail.value?.session?.status,
      terminals: terminalSessions.value,
      nodes: detail.value?.nodes,
    })
  },
  { immediate: true },
)

watch(pendingGate, (g) => {
  if (g) footerCollapsed.value = false
})

let furnaceLaunchLock = false
async function launchFurnaceFromSprite() {
  if (furnaceLaunchLock) return
  furnaceLaunchLock = true
  try {
    await loadLists()
    const m = (members.value || []).find((x) => isFurnaceMember(x))
    if (!m) {
      ElMessage.warning('未找到熔炉成员')
      return
    }
    startTarget.value = `m:${m.id}`
    await startChat()
    if (route.query.furnace) {
      const q = { ...route.query }
      delete q.furnace
      router.replace({ path: route.path, query: q })
    }
  } finally {
    furnaceLaunchLock = false
  }
}

watch(
  () => route.query.furnace,
  (v) => {
    if (v === '1' || v === 'true') launchFurnaceFromSprite()
  },
)

/** 运行时：当前需要人介入（闸门 / 等人状态）→ 标红突出 */
const needsHuman = computed(() => {
  if (!detail.value) return false
  if (detail.value.session.status === 'archived') return false
  if (detail.value.session.status === 'waiting_human') return true
  if (detail.value.session.status === 'interrupted') return true
  return !!pendingGate.value
})

/**
 * 归档结果：success | failed | null
 * 依据 archive_reason；详情页可结合节点失败态
 */
function archiveOutcomeOf(session, nodes) {
  if (!session || session.status !== 'archived') return null
  const r = String(session.archive_reason || '').toLowerCase()
  if (['failed', 'rejected', 'error', 'fail'].includes(r)) return 'failed'
  if (Array.isArray(nodes) && nodes.some((n) => n.status === 'failed')) return 'failed'
  // auto_completed / completed / manual / timeout / 其它 → 成功归档
  return 'success'
}

const archiveOutcomeTag = computed(() => {
  if (!detail.value?.session) return null
  const o = archiveOutcomeOf(detail.value.session, detail.value.nodes)
  if (!o) return null
  if (o === 'failed') return { label: '失败', type: 'danger', ok: false }
  return { label: '成功', type: 'success', ok: true }
})

/** 群报告：启动说明 */
const announceKickoff = computed(() => {
  const k = sessionCtx()?.kickoff
  const t = k && typeof k === 'object' ? String(k.text || '').trim() : ''
  return t
})

/** 群报告：用户参与附言列表 */
const announceUserNotes = computed(() => {
  const list = sessionCtx()?.userNotes
  if (!Array.isArray(list)) return []
  return list
    .filter((u) => u && String(u.text || '').trim())
    .map((u) => ({
      actionLabel: u.actionLabel || u.action || '附言',
      nodeTitle: u.nodeTitle || '',
      text: String(u.text).trim(),
    }))
})

/**
 * 群报告：每个节点的实质入/出（含脚本额外产出、审核附言）
 * 不展示「开始/结束」空话
 */
const announceProgress = computed(() => {
  const nodes = detail.value?.nodes || []
  return nodes.map((n) => {
    const st = n.status || 'pending'
    let tagType = 'info'
    if (st === 'succeeded') tagType = 'success'
    else if (st === 'failed') tagType = 'danger'
    else if (st === 'waiting_human' || st === 'running') tagType = 'warning'

                const inText = cleanAnnounceIo(formatBusinessIo(n.input, 'input'))
    const outText = cleanAnnounceIo(formatBusinessIo(n.output, 'output'))
    const noteRaw =
      n.output && typeof n.output === 'object' && n.output.humanNote
        ? String(n.output.humanNote).trim()
        : ''
    const act =
      n.output?.humanAction === 'reject'
        ? '拒绝'
        : n.output?.humanAction === 'approve'
          ? '通过'
          : n.output?.humanAction === 'pending' || st === 'waiting_human'
            ? 'pending'
            : ''
    const note = noteRaw ? (act ? `${act}：${noteRaw}` : noteRaw) : ''

    // 节点级 # 参数（入/出里的 params / paramsList）
    const nodeHash = []
    const seen = new Set()
    const pushHash = (key, val) => {
      if (!key || seen.has(key)) return
      seen.add(key)
      nodeHash.push({ key, value: val == null ? '' : String(val) })
    }
    const ioParams = {
      ...(n.input?.params && typeof n.input.params === 'object' ? n.input.params : {}),
      ...(n.output?.params && typeof n.output.params === 'object' ? n.output.params : {}),
    }
    const ioList = Array.isArray(n.input?.paramsList)
      ? n.input.paramsList
      : Array.isArray(n.output?.paramsList)
        ? n.output.paramsList
        : []
    ioList.forEach((v, i) => pushHash(`#${i + 1}`, v))
    Object.keys(ioParams)
      .filter((k) => k.startsWith('#'))
      .sort((a, b) => {
        const na = /^#\d+$/.test(a) ? Number(a.slice(1)) : 9999
        const nb = /^#\d+$/.test(b) ? Number(b.slice(1)) : 9999
        if (na !== nb) return na - nb
        return a.localeCompare(b, 'zh')
      })
      .forEach((k) => pushHash(k, ioParams[k]))

    let pendingHint = ''
    if (st === 'pending' || st === 'not_run') pendingHint = '待跑'
    else if (st === 'running') pendingHint = '执行中…'
    else if (st === 'waiting_human' && !outText && !note) pendingHint = '待确认'

    return {
      id: n.id,
      idx: Number(n.step_index) + 1,
      title: n.title || `步骤 ${Number(n.step_index) + 1}`,
      statusLabel: statusLabel(st) || st,
      tagType,
      nodeHash,
      inText,
      outText,
      note,
      pendingHint,
    }
  })
})

/** 去掉无信息量的入出文案 */
function cleanAnnounceIo(text) {
  let t = String(text || '').trim()
  if (
    !t ||
    t === '（无）' ||
    t === '（空）' ||
    t === '（暂无实质产出）' ||
    t === '（无业务摘要）'
  ) {
    return ''
  }
  // 过滤纯空话行，保留「结果：」与实质内容
  t = t
    .split(/\r?\n/)
    .filter((line) => {
      const s = line.trim()
      if (!s) return false
      if (/开始执行|已结束任务/.test(s) && s.length < 24) return false
      if (/^状态：等待/.test(s)) return false
      return true
    })
    .join('\n')
    .trim()
  return t
}

/** 底部唯一输入框：有闸门时兼作附言/人工输入 */
const composerPlaceholder = computed(() => {
  const g = pendingGate.value
  if (!g) return '发消息… @成员 · #参数 · @节点重跑'
  const mode = g.content?.mode
  if (mode === 'session_start') {
    if (g.content?.callArgs || g.content?.captureParams === false) {
      return '可选参数全文作 #a；点「通过」启动…'
    }
    return g.content?.captureParams
      ? '可先输入说明/参数，再点「通过」启动…'
      : '可先输入说明，再点「通过」启动…'
  }
  if (mode === 'human_input' || mode === 'need_params') {
    return g.content?.captureParams || mode === 'need_params'
      ? '在此输入参数（空格/换行分段 → #1 #2…），Enter 或点「提交」'
      : '在此输入内容，Enter 或点「提交」'
  }
  if (mode === 'adapter_question') {
    return '工具在问你：可点选项，或先输入再提交'
  }
  if (mode === 'interrupted') {
    return '服务曾中断：继续=从中断处恢复 · 放弃=跳过未完成步骤（进程到设置里释放）'
  }
  // 通用审核（产出审核/节点审核等）：把闸门标题放进 placeholder
  const gateTitle = g.content?.text || g.content?.title
  return gateTitle ? `${gateTitle} · 可先写意见，再点「同意」或「拒绝」` : '可先写意见，再点「同意」或「拒绝」…'
})

const composerToolbarHint = computed(() => {
  if (pendingGate.value) {
    const mode = pendingGate.value.content?.mode
    if (mode === 'human_input' || mode === 'need_params') return '下方输入 · Enter 提交'
    if (mode === 'session_start') return 'Enter=发消息 · 点「通过」启动'
    if (mode === 'interrupted') return '点「继续」或「放弃」'
    if (mode === 'adapter_question') return '点选项或提交回答工具'
    return 'Enter=附言 · 点同意/拒绝定局'
  }
  return '@ 成员/节点 · # 参数 · / 指令 · Enter 发送'
})

const composerFooterHint = computed(() => {
  if (pendingGate.value) {
    return '待确认与消息共用下方输入框 · 附言会记入群报告'
  }
  return '# 插入正文（群聊/文件夹/参数/输出）· @成员协助 · 发送会写入 # 与群报告'
})

function statusLabel(s) {
  if (s === 'pending' || s === 'not_run') return '待跑'
  if (s === 'waiting_human') return '待确认'
  const m = {
    active: '进行中',
    interrupted: '待恢复',
    archived: '已归档',
    failed: '失败',
    paused: '暂停',
    running: '执行中',
    succeeded: '完成',
    skipped: '已绕过',
  }
  return m[s] || nodeStatusLabel(s) || s
}

function nodeBypassed(n) {
  return !!(n?.output?.bypassed || n?.input?.bypassed)
}

function stepTypeLabel(t) {
  return sharedStepTypeLabel(t) || t
}

function statusType(s) {
  // 已归档用中性 info，成功/失败另用 archiveOutcomeTag
  if (s === 'archived') return 'info'
  // 运行时等人：用危险色，强制注意
  if (s === 'waiting_human') return 'danger'
  if (s === 'interrupted') return 'warning'
  if (s === 'failed') return 'danger'
  return 'success'
}

function formatTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function roleLabel(m) {
  if (m.role === 'user') return '我'
  if (m.type === 'gate') {
    if (m.content?.mode === 'session_start') return '确认开始'
    if (m.content?.mode === 'human_input') return '请输入'
    if (m.content?.mode === 'need_params') return '请输入'
    if (m.content?.mode === 'interrupted') return '崩溃恢复'
    if (m.content?.mode === 'adapter_question') return '工具提问'
    return '待你处理'
  }
  if (m.role === 'system') return '系统'
  if (m.member_id) {
    const mem = members.value.find((x) => x.id === m.member_id)
    return mem?.display_name || '成员'
  }
  if (m.role === 'assistant' || m.role === 'member') return '成员'
  return m.role || '未知'
}

/** 气泡上展示的发送人简称 */
function shortSender(m, fullName) {
  const full = fullName || roleLabel(m)
  if (!full) return '?'
  if (full === '我' || full === '系统' || full === '待你处理' || full === '闸门' || full === '成员') return full
  if (full === '请输入' || full === '人工输入') return '输入'
  // 中文名：最多 4 字，超过取前 2 字作简称
  if (/[\u4e00-\u9fff]/.test(full)) {
    if (full.length <= 4) return full
    return full.slice(0, 2)
  }
  // 英文 / 混合：多词取首字母，否则截 4 字符
  const parts = full.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return parts
      .map((p) => p[0])
      .join('')
      .slice(0, 4)
      .toUpperCase()
  }
  return full.length <= 6 ? full : full.slice(0, 4)
}

function messageText(m) {
  const t = m.content?.text
  if (t != null && String(t).length) return String(t)
  if (m.content?.attachments?.length) return ''
  if (m.content && typeof m.content === 'object' && !m.content.text) {
    return JSON.stringify(m.content)
  }
  return ''
}

function formatSize(n) {
  const b = Number(n) || 0
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function fileIcon(f) {
  const mime = String(f.mime || '')
  const name = String(f.name || '')
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return '🖼'
  if (mime.includes('pdf') || /\.pdf$/i.test(name)) return '📄'
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return '📦'
  if (/\.(xlsx?|csv)$/i.test(name)) return '📊'
  if (/\.(docx?|txt|md)$/i.test(name)) return '📝'
  if (/\.(js|ts|py|json|vue|java|go)$/i.test(name)) return '💻'
  return '📎'
}

function triggerFilePick() {
  if (!activeId.value) {
    ElMessage.warning('请先选择会话')
    return
  }
  fileInputRef.value?.click()
}

function removePending(i) {
  pendingFiles.value.splice(i, 1)
}

async function addLocalFiles(fileList) {
  if (!activeId.value) {
    ElMessage.warning('请先选择会话再添加文件')
    return
  }
  const arr = [...fileList].filter(Boolean)
  if (!arr.length) return
  if (pendingFiles.value.length + arr.length > 8) {
    ElMessage.warning('一次最多 8 个附件')
    return
  }
  uploading.value = true
  try {
    const r = await api.sessions.uploadFiles(activeId.value, arr)
    const files = r.files || []
    pendingFiles.value = [...pendingFiles.value, ...files]
    ElMessage.success(`已添加 ${files.length} 个文件`)
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    uploading.value = false
  }
}

function onFileInputChange(e) {
  const files = e.target?.files
  if (files?.length) addLocalFiles(files)
  if (e.target) e.target.value = ''
}

/** XSender 粘贴文件 */
function onPasteFile(firstFile, fileList) {
  const list = fileList?.length ? fileList : firstFile ? [firstFile] : []
  addLocalFiles(list)
}

function isPendingGate(m) {
  if (m.type !== 'gate' || !detail.value) return false
  if (m.content?.mode === 'archive_confirm') return false
  if (m.content?.mode === 'adapter_question') {
    return m.content?.humanAction === 'pending' && !m.content?.answered
  }
  const node = detail.value.nodes.find((n) => n.id === m.node_instance_id)
  return node?.status === 'waiting_human'
}

function isCurrent(n) {
  if (!detail.value) return false
  if (n.step_type === 'offsite') return false
  const s = detail.value.session
  if (s.status === 'archived') return false
  return (
    n.step_index === s.current_step_index &&
    n.status !== 'succeeded' &&
    n.status !== 'skipped'
  )
}

function isWaitingHuman(n) {
  if (n.step_type === 'offsite') return n.status === 'waiting_human' || n.status === 'running'
  return n.status === 'waiting_human' || (isCurrent(n) && n.step_type === 'human')
}

/** 是否正处在场外协助（已归档则不算活跃） */
const offsiteActive = computed(() => {
  const s = detail.value?.session
  if (!s || s.status === 'archived') return false
  const ctx = s.context && typeof s.context === 'object' ? s.context : {}
  if (ctx.offsiteAssist?.archived && ctx.offsiteAssist?.active === false) return false
  if (ctx.offsiteAssist?.active) return true
  return (detail.value?.nodes || []).some(
    (n) =>
      n.step_type === 'offsite' &&
      !n.output?.archived &&
      (n.status === 'running' || n.status === 'waiting_human'),
  )
})

/** planned | interrupt */
const offsiteMode = computed(() => {
  const ctx = detail.value?.session?.context
  if (ctx?.offsiteAssist?.mode === 'planned' || ctx?.offsiteAssist?.planned) return 'planned'
  const n = activeOffsiteNode.value
  if (n?.output?.mode === 'planned' || n?.output?.plannedPause) return 'planned'
  if (offsiteActive.value) return 'interrupt'
  return null
})

const activeOffsiteNode = computed(() => {
  const nodes = detail.value?.nodes || []
  const ctx = detail.value?.session?.context
  const pinned = ctx?.offsiteAssist?.active ? ctx.offsiteAssist?.nodeInstanceId : null
  if (pinned) {
    const hit = nodes.find(
      (n) =>
        n.id === pinned &&
        n.step_type === 'offsite' &&
        !n.output?.archived,
    )
    if (hit) return hit
  }
  return (
    nodes.find(
      (n) =>
        n.step_type === 'offsite' &&
        !n.output?.archived &&
        (n.status === 'running' || n.status === 'waiting_human'),
    ) || null
  )
})

/** 多段场外并存时，仅高亮当前活跃段落 */
function isCurrentOffsiteSegment(n) {
  if (!n || n.step_type !== 'offsite' || n.output?.archived) return false
  if (n.status !== 'running' && n.status !== 'waiting_human') return false
  return activeOffsiteNode.value?.id === n.id
}

function offsiteEntryLabel(n) {
  if (!n || n.step_type !== 'offsite') return ''
  if (!isCurrentOffsiteSegment(n)) return ''
  const mode =
    n.output?.mode ||
    (n.output?.plannedPause ? 'planned' : null) ||
    offsiteMode.value
  if (mode === 'planned') return '计划'
  return '插队'
}

/** 审核三态：pending | approve | reject */
function reviewAction(n) {
  const a = n?.output?.humanAction
  if (a === 'approve' || a === 'reject' || a === 'pending') return a
  if (n?.status === 'waiting_human') return 'pending'
  return ''
}

function reviewLabel(n) {
  const a = reviewAction(n)
  if (a === 'approve') return '通过'
  if (a === 'reject') return '拒绝'
  if (a === 'pending') return 'pending'
  return ''
}

function flowClass(n) {
  if (n.step_type === 'offsite') {
    if (n.status === 'running' || n.status === 'waiting_human') return 'offsite-active'
    return 'offsite-idle'
  }
  if (n.step_type === 'archive') {
    if (n.status === 'waiting_human') return 'human-wait'
    if (n.status === 'succeeded') return 'done'
    return 'pending'
  }
  if (n.status === 'succeeded' || n.status === 'skipped') return 'done'
  if (n.status === 'failed') return 'failed'
  if (isWaitingHuman(n) || n.status === 'waiting_human') return 'human-wait'
  // 执行中：呼吸焦点；当前待跑：静态高亮
  if (n.status === 'running') return 'running'
  if (isCurrent(n)) return 'current'
  if (n.step_type === 'human' || n.gate) return 'human-config'
  return 'pending'
}

function toggleNodeExpand(n) {
  expandedNodeId.value = expandedNodeId.value === n.id ? null : n.id
}

/** 流程轨 I/O：业务摘要（用户输入 / 完成概况），不堆 id·路径·命令 */
function formatIo(val, role = 'auto') {
  try {
    return formatBusinessIo(val, role)
  } catch {
    if (val == null) return '（无）'
    if (typeof val === 'string') return val || '（空）'
    return '（无业务摘要）'
  }
}

async function loadLists() {
  sessions.value = await api.sessions.list()
  groups.value = await api.groups.list()
  members.value = await api.members.list()
  if (!startTarget.value) {
    if (groups.value[0]) startTarget.value = `g:${groups.value[0].id}`
    else if (startableMembers.value[0]) startTarget.value = `m:${startableMembers.value[0].id}`
  }
  try {
    const sc = await api.slashCommands.list()
    slashCommands.value = sc.commands || []
  } catch {
    slashCommands.value = []
  }
  try {
    const s = await api.appSettings.get()
    if (s?.terminal) terminalPrefs.value = { ...terminalPrefs.value, ...s.terminal }
    if (s?.grok?.surface === 'tui') furnaceSurface.value = 'tui'
    else furnaceSurface.value = 'chat'
  } catch {
    /* keep defaults */
  }
}

async function selectSession(id) {
  if (!id) return
  activeId.value = id
  activeTerminalId.value = null
  terminalSessions.value = []
  router.replace(`/workbench/${id}`)
  rightTab.value = 'flow' // 默认展示流程 Tab
  expandedSkippedFlowGroups.value = {}
  bindWs(id)
  await Promise.all([loadDetail(id), loadTerminals(id)])
  revealFurnaceTui()
}

/** 群报告 MD 路径提示（相对 dataRoot） */
const announceMdHint = computed(() => {
  const p =
    detail.value?.announcement?.path ||
    detail.value?.session?.context?.announcementPath ||
    (activeId.value
      ? `journals/sessions/${activeId.value}/ANNOUNCEMENT.md`
      : '')
  return p ? `打开 ${p}` : '打开群报告 Markdown'
})

/** 用系统默认程序打开 ANNOUNCEMENT.md */
async function openAnnouncementMd() {
  if (!activeId.value) return
  announceOpenLoading.value = true
  try {
    const r = await api.sessions.openAnnouncement(activeId.value)
    if (r?.path && detail.value) {
      detail.value.announcement = {
        ...(detail.value.announcement || {}),
        path: r.path,
      }
    }
    ElMessage.success(r?.absolutePath ? `已打开 ${r.absolutePath}` : '已打开群报告 MD')
  } catch (e) {
    ElMessage.warning(e.message || '打开失败')
  } finally {
    announceOpenLoading.value = false
  }
}

/** 刷新群报告台账文件（后台 MD）；界面始终跟节点 / # 参数走 */
async function rebuildAnnouncement() {
  if (!activeId.value) return
  announceLoading.value = true
  try {
    await api.sessions.refreshAnnouncement(activeId.value, { modes: ['io'] })
    await loadDetail(activeId.value)
    ElMessage.success('群报告已刷新')
  } catch (e) {
    ElMessage.error(e.message || '刷新失败')
  } finally {
    announceLoading.value = false
  }
}

async function saveSessionNotes() {
  if (!activeId.value) return
  notesSaving.value = true
  try {
    const r = await api.sessions.saveNotes(activeId.value, sessionNotesDraft.value)
    sessionNotesDraft.value = r.notes ?? sessionNotesDraft.value
    if (detail.value?.session) {
      detail.value.session.context = {
        ...(detail.value.session.context || {}),
        notes: sessionNotesDraft.value,
      }
    }
    ElMessage.success('备注已保存')
  } catch (e) {
    ElMessage.error(e.message || '保存备注失败')
  } finally {
    notesSaving.value = false
  }
}

async function loadDetail(id) {
  detail.value = await api.sessions.get(id)
  editTitle.value = detail.value.session.title
  sessionNotesDraft.value = detail.value.session?.context?.notes || ''
}

async function loadTerminals(id) {
  try {
    const result = await api.sessions.terminals(id)
    if (activeId.value !== id) return
    for (const terminal of result.terminals || []) {
      const current = terminalSessions.value.find((item) => item.id === terminal.id)
      if (!current || Number(terminal.seq || 0) >= Number(current.seq || 0)) {
        upsertTerminal({
          ...terminal,
          previewReplay: String(terminal.replay || '').slice(-12_000),
        })
      }
    }
    revealFurnaceTui()
  } catch {
    /* 保留 WebSocket 已收到的较新状态 */
  }
}

function upsertTerminal(next) {
  if (!next?.id) return
  const index = terminalSessions.value.findIndex((item) => item.id === next.id)
  if (index < 0) {
    terminalSessions.value = [...terminalSessions.value, next]
    return
  }
  const current = terminalSessions.value[index]
  const merged = {
    ...current,
    ...next,
    replay: next.replay ?? current.replay ?? '',
    previewReplay: next.previewReplay ?? current.previewReplay ?? '',
  }
  terminalSessions.value = terminalSessions.value.map((item, i) => (i === index ? merged : item))
}

function sendTerminalMessage(message) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    ElMessage.warning('终端连接尚未就绪')
    return false
  }
  ws.send(JSON.stringify(message))
  return true
}

function openTerminal(terminalId) {
  activeTerminalId.value = terminalId
  sendTerminalMessage({ type: 'terminal.attach', terminalId })
}

function revealFurnaceTui(terminalId) {
  const target =
    terminalSessions.value.find((t) => t.id === terminalId) ||
    terminalSessions.value.find((t) => ['starting', 'running'].includes(t.status)) ||
    terminalSessions.value[terminalSessions.value.length - 1]
  if (!target || !isFurnaceTuiContext(target)) return
  if (activeTerminalId.value === target.id) return
  openTerminal(target.id)
}

function sendTerminalInput(data) {
  if (!activeTerminalId.value) return
  sendTerminalMessage({
    type: 'terminal.input',
    terminalId: activeTerminalId.value,
    data,
  })
}

function resizeTerminal({ cols, rows }) {
  if (!activeTerminalId.value) return
  lastTerminalSize.value = { cols, rows }
  sendTerminalMessage({
    type: 'terminal.resize',
    terminalId: activeTerminalId.value,
    cols,
    rows,
  })
}

async function killTerminal(terminalId) {
  if (!activeId.value || !terminalId) return
  try {
    await api.sessions.killTerminal(activeId.value, terminalId)
  } catch (e) {
    ElMessage.error(e.message || '停止终端失败')
  }
}

function adapterChoices(m) {
  return Array.isArray(m?.content?.choices) ? m.content.choices.filter(Boolean) : []
}

async function answerAdapterQuestion(m, choice, action = 'adapter_answer') {
  if (gating.value || !activeId.value) return
  gating.value = true
  try {
    const text = readSenderText()
    await api.sessions.gate(activeId.value, {
      action,
      text: text || undefined,
      choice: choice || undefined,
      questionId: m?.content?.questionId,
      nodeInstanceId: m?.node_instance_id || undefined,
      idempotencyKey: nextIdempotencyKey('adapter_answer', m?.content?.questionId),
    })
    clearSender()
    await loadDetail(activeId.value)
    ElMessage.success('已回答工具提问')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    gating.value = false
  }
}

function onTerminalSeqGap() {
  if (!activeTerminalId.value) return
  ElMessage.info('部分输出未回放，正在重新附着')
  sendTerminalMessage({ type: 'terminal.attach', terminalId: activeTerminalId.value })
}

async function downloadTerminalLog(terminalId) {
  if (!activeId.value || !terminalId) return
  try {
    await api.sessions.downloadTerminalLog(activeId.value, terminalId)
  } catch (e) {
    ElMessage.error(e.message || '无法下载日志')
  }
}

function onConvChange(item) {
  const id = item?.uniqueKey || item?.id
  if (id) selectSession(id)
}

watch(activeId, (id, prev) => {
  if (id && id !== prev && (!detail.value || detail.value.session.id !== id)) {
    selectSession(id)
  }
})

function normalizeMenuCommand(command) {
  if (command == null) return ''
  if (typeof command === 'string' || typeof command === 'number') return String(command)
  if (typeof command === 'object') {
    return String(command.command ?? command.key ?? command.value ?? '')
  }
  return String(command)
}

async function togglePin(id, pinned) {
  if (!id) return
  try {
    const s = await api.sessions.pin(id, pinned)
    sessions.value = await api.sessions.list()
    if (detail.value?.session?.id === id) {
      detail.value = {
        ...detail.value,
        session: { ...detail.value.session, pinned: !!s?.pinned },
      }
    }
    ElMessage.success(pinned ? '已置顶' : '已取消置顶')
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}

async function onConvMenu(command, item) {
  const cmd = normalizeMenuCommand(command)
  const id = item?.uniqueKey || item?.id || item?.key
  if (!id) {
    ElMessage.warning('无法识别该会话')
    return
  }
  if (cmd === 'pin' || cmd === '置顶') {
    await togglePin(id, true)
    return
  }
  if (cmd === 'unpin' || cmd === '取消置顶') {
    await togglePin(id, false)
    return
  }
  if (cmd === 'delete' || cmd === '删除') {
    await doDelete(id)
    return
  }
  if (cmd === 'rename' || cmd === '重命名') {
    try {
      const current =
        sessions.value.find((s) => s.id === id)?.title ||
        (detail.value?.session?.id === id ? detail.value.session.title : '') ||
        ''
      const { value } = await ElMessageBox.prompt('聊天名称', '重命名', {
        inputValue: current,
        confirmButtonText: '确定',
        cancelButtonText: '取消',
      })
      if (value?.trim()) {
        await api.sessions.rename(id, value.trim())
        if (activeId.value === id) editTitle.value = value.trim()
        sessions.value = await api.sessions.list()
        if (detail.value?.session?.id === id) await loadDetail(id)
        ElMessage.success('已重命名')
      }
    } catch {
      /* 取消 */
    }
  }
}

function bindWs(sessionId) {
  if (ws) {
    ws.close()
    ws = null
  }
  ws = connectSessionWs(
    sessionId,
    async (ev) => {
      if (activeId.value !== sessionId) return
      if (ev.type === 'terminal.opened') {
        const terminal = ev.payload?.terminal
        upsertTerminal({
          ...terminal,
          previewReplay: String(terminal?.replay || '').slice(-12_000),
        })
        revealFurnaceTui(terminal?.id)
        return
      }
      if (ev.type === 'terminal.output') {
        const terminalId = ev.payload?.terminalId
        const current = terminalSessions.value.find((item) => item.id === terminalId)
        const nextSeq = Number(ev.payload?.seq)
        const prevSeq = Number(current?.seq || 0)
        if (current && nextSeq > prevSeq) {
          if (nextSeq > prevSeq + 1) {
            ElMessage.info('部分输出未回放，正在重新附着')
            sendTerminalMessage({ type: 'terminal.attach', terminalId })
          }
          const data = ev.payload.data || ''
          const replay = `${current.replay || ''}${data}`.slice(-256_000)
          upsertTerminal({
            ...current,
            seq: ev.payload.seq,
            replay,
            previewReplay: `${current.previewReplay || ''}${data}`.slice(-12_000),
            lastChunk: data,
          })
        }
        return
      }
      if (ev.type === 'terminal.snapshot') {
        if (ev.payload?.truncated) {
          ElMessage.info('回放已截断，仅显示最近输出')
        }
        upsertTerminal({
          ...(ev.payload?.terminal || {}),
          id: ev.payload?.terminalId,
          seq: ev.payload?.seq || 0,
          replay: ev.payload?.data || '',
          previewReplay: String(ev.payload?.data || '').slice(-12_000),
          snapshotKey: `${ev.payload?.seq || 0}:${Date.now()}`,
          lastChunk: '',
          replayTruncated: !!ev.payload?.truncated,
        })
        return
      }
      if (ev.type === 'terminal.exited') {
        upsertTerminal(ev.payload?.terminal)
        if (terminalPrefs.value.autoCollapseOnExit && activeTerminalId.value === ev.payload?.terminal?.id) {
          activeTerminalId.value = null
        }
        return
      }
      if (ev.type === 'terminal.error' || ev.type === 'terminal.adapter_error') {
        ElMessage.warning(ev.payload?.message || '终端连接异常')
        return
      }
      if (
        [
          'message',
          'node.status',
          'session.archived',
          'session.restart',
          'session.status',
          'gate.request',
          'announcement.updated',
        ].includes(ev.type)
      ) {
        await loadDetail(sessionId)
        // 默认保持「流程」Tab，不自动跳群报告
        // 群报告由节点 detail / # 参数驱动；备注在 context.notes
        if (ev.type === 'session.archived' || ev.type === 'session.restart') {
          rightTab.value = 'flow'
        }
        sessions.value = await api.sessions.list()
      }
    },
    {
      async onOpen() {
        if (activeId.value !== sessionId) return
        await loadTerminals(sessionId)
        if (activeTerminalId.value) {
          sendTerminalMessage({ type: 'terminal.attach', terminalId: activeTerminalId.value })
          if (lastTerminalSize.value) {
            sendTerminalMessage({
              type: 'terminal.resize',
              terminalId: activeTerminalId.value,
              ...lastTerminalSize.value,
            })
          }
        }
      },
      onStatus(status) {
        if (activeId.value === sessionId) terminalConnectionStatus.value = status
      },
    },
  )
}

async function startChat() {
  const raw = String(startTarget.value || '')
  const kind = raw.slice(0, 2)
  const id = raw.slice(2)
  if (!id || (kind !== 'g:' && kind !== 'm:')) {
    ElMessage.warning('请选择群模板或成员')
    return
  }
  if (startingChat.value) return
  startingChat.value = true
  try {
    const s =
      kind === 'm:'
        ? await api.members.startSession(id, {})
        : await api.groups.startSession(id, {})
    await loadLists()
    await selectSession(s.id)
    ElMessage.success(
      kind === 'm:'
        ? s.reused
          ? '已回到与该成员的会话'
          : '已与成员开聊'
        : '已开聊',
    )
  } catch (e) {
    // 业务异常不 toast Error；无 message 时仍给反馈，避免像「点了没反应」
    ElMessage.warning(e?.message || '开聊失败，请稍后重试')
  } finally {
    startingChat.value = false
  }
}

/** 欢迎页：一键开聊演示流 */
async function startDemoChat() {
  if (startingChat.value) return
  let demo = groups.value.find((g) => g.title === '演示流')
  if (!demo) {
    try {
      await loadLists()
    } catch (e) {
      ElMessage.warning(e?.message || '加载群模板失败，请稍后重试')
      return
    }
    demo = groups.value.find((g) => g.title === '演示流')
  }
  if (!demo) {
    ElMessage.warning('未找到「演示流」。请到设置打开「显示演示示例」。')
    return
  }
  startTarget.value = `g:${demo.id}`
  await startChat()
}

function syncSlashFromInput() {
  const text = readSenderText()
  // 仅当输入以 / 开头时当作指令模式（整段像 /editor）
  if (text.startsWith('/')) {
    slashOpen.value = true
    atOpen.value = false
    hashOpen.value = false
    const body = text.slice(1)
    slashQuery.value = body.split(/\s/)[0] || ''
    slashIndex.value = 0
  } else {
    // 删掉 /、清空输入、或改成普通消息：同步收起快捷指令气泡
    slashOpen.value = false
    slashQuery.value = ''
  }
}

/** 光标在末尾的 @query 时弹出成员面板 */
function syncAtFromInput() {
  const text = readSenderText()
  if (text.startsWith('/')) {
    atOpen.value = false
    return
  }
  // 最后一个未完成的 @片段（@ 后不含空格）
  const m = text.match(/(^|[\s])@([^\s@]*)$/)
  if (m) {
    atOpen.value = true
    slashOpen.value = false
    hashOpen.value = false
    atQuery.value = m[2] || ''
    atIndex.value = 0
  } else if (!text.endsWith('@')) {
    // 已选完 @名字 或无 @：关面板
    atOpen.value = false
    atQuery.value = ''
  }
}

/** 光标在末尾的 #query 时弹出文本快捷面板 */
function syncHashFromInput() {
  if (Date.now() < hashInsertLockUntil) return
  const text = readSenderTextRaw().replace(/\s+$/u, '')
  if (text.startsWith('/')) {
    hashOpen.value = false
    return
  }
  // 末尾 #片段：允许无前导空格（如 build#）
  const m = text.match(/(?:^|[\s])#([^\s#]*)$/u)
  if (m) {
    hashOpen.value = true
    slashOpen.value = false
    atOpen.value = false
    hashQuery.value = m[1] || ''
    hashIndex.value = 0
  } else if (!/#([^\s#]*)$/u.test(text)) {
    hashOpen.value = false
    hashQuery.value = ''
  }
}

function onSenderChange() {
  syncSlashFromInput()
  syncAtFromInput()
  syncHashFromInput()
}

function onComposerKeydown(e) {
  // # 面板：群聊 / 文件夹 / #1…
  if (hashOpen.value) {
    const list = filteredHashItems.value
    if (e.key === 'Escape') {
      e.preventDefault()
      hashOpen.value = false
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!list.length) return
      hashIndex.value = (hashIndex.value + 1) % list.length
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!list.length) return
      hashIndex.value = (hashIndex.value - 1 + list.length) % list.length
      return
    }
    if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
      if (!list.length) return
      e.preventDefault()
      e.stopPropagation()
      insertHashItem(list[hashIndex.value] || list[0])
      return
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      setTimeout(() => {
        syncHashFromInput()
        syncAtFromInput()
        syncSlashFromInput()
      }, 0)
    }
  }

  // @ 面板：仅成员协助（节点重跑已从面板移除，避免误触重头跑）
  if (atOpen.value) {
    const members = filteredAtMembers.value
    const total = members.length
    if (e.key === 'Escape') {
      e.preventDefault()
      atOpen.value = false
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!total) return
      atIndex.value = (atIndex.value + 1) % total
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!total) return
      atIndex.value = (atIndex.value - 1 + total) % total
      return
    }
    if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
      if (!total) return
      e.preventDefault()
      e.stopPropagation()
      insertAtMember(members[atIndex.value] || members[0])
      return
    }
  }

  if (!slashOpen.value) {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      setTimeout(syncSlashFromInput, 0)
    }
    if (e.key === '@' && !e.ctrlKey && !e.metaKey) {
      setTimeout(syncAtFromInput, 0)
    }
    if (e.key === '#' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      setTimeout(syncHashFromInput, 0)
    }
    return
  }
  // Backspace/Delete 删掉 / 后立刻收起（不依赖 change 是否及时）
  if (e.key === 'Backspace' || e.key === 'Delete') {
    setTimeout(() => {
      syncSlashFromInput()
      syncAtFromInput()
      syncHashFromInput()
    }, 0)
  }
  const list = filteredSlashCmds.value
  if (e.key === 'Escape') {
    e.preventDefault()
    slashOpen.value = false
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!list.length) return
    slashIndex.value = (slashIndex.value + 1) % list.length
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!list.length) return
    slashIndex.value = (slashIndex.value - 1 + list.length) % list.length
    return
  }
  if (e.key === 'Enter' && !e.shiftKey && list.length) {
    // 指令模式：Enter 执行选中项，不发消息
    const t = readSenderText()
    if (t.startsWith('/')) {
      e.preventDefault()
      e.stopPropagation()
      runSlash(list[slashIndex.value] || list[0])
    }
  }
}

function toggleSlashPanel() {
  atOpen.value = false
  hashOpen.value = false
  slashOpen.value = !slashOpen.value
  if (slashOpen.value) {
    slashQuery.value = ''
    slashIndex.value = 0
    // setText 是插入：只追加唤起符
    appendSenderText('/')
    syncSlashFromInput()
  }
}

/** 关闭 / @ # 浮层（与 Esc 一致，不关输入框里的唤起符） */
function closeComposerPanel(kind) {
  if (kind === 'slash') {
    slashOpen.value = false
    slashQuery.value = ''
    return
  }
  if (kind === 'at') {
    atOpen.value = false
    atQuery.value = ''
    return
  }
  if (kind === 'hash') {
    hashOpen.value = false
    hashQuery.value = ''
  }
}

function toggleAtPanel() {
  slashOpen.value = false
  hashOpen.value = false
  atOpen.value = !atOpen.value
  if (atOpen.value) {
    atQuery.value = ''
    atIndex.value = 0
    const cur = readSenderText()
    appendSenderText(cur && !/\s$/.test(cur) ? ' @' : '@')
    syncAtFromInput()
  }
}

function toggleHashPanel() {
  slashOpen.value = false
  atOpen.value = false
  hashOpen.value = !hashOpen.value
  if (hashOpen.value) {
    hashQuery.value = ''
    hashIndex.value = 0
    const cur = readSenderTextRaw()
    // 只追加唤起用 #（选中后 strip，不进正文）；勿把全文再 setText 一遍
    appendSenderText(cur && !/\s$/.test(cur) ? ' #' : '#')
    syncHashFromInput()
  }
}

/** 把当前 @query 替换为 @显示名  */
async function insertAtMember(m) {
  if (!m) return
  const name = m.display_name || m.name
  const text = readSenderText()
  const replaced = text.replace(/(^|[\s])@([^\s@]*)$/, `$1@${name} `)
  const next = replaced === text ? `${text}@${name} ` : replaced
  atOpen.value = false
  atQuery.value = ''
  await replaceSenderText(next)
}

/**
 * 选中项：去掉 # 唤起段，只插入正文（不含 #）。
 */
async function insertHashItem(h) {
  if (!h) return
  const insert = String(h.value || '').trim()
  const raw = readSenderTextRaw()
  let stripped = stripTrailingHashTrigger(raw)
  // 面板已开但 model 尚未带上 #：仍按触发态剥离
  if (hashOpen.value && stripped === raw.replace(/[ \t]+$/u, '')) {
    stripped = stripTrailingHashTrigger(`${stripped}#`)
  }
  hashOpen.value = false
  hashQuery.value = ''
  if (!insert) {
    await replaceSenderText(stripped)
    ElMessage.warning(`${h.name || h.label || '该项'}暂无内容可插入`)
    return
  }
  await replaceSenderText(stripped ? `${stripped} ${insert}` : insert)
}

function isDiscardedUnexecutedNode(n) {
  return isDiscardedUnexecutedFlowNode(n, {
    currentStepIndex: detail.value?.session?.current_step_index,
    isCurrent: isCurrent(n),
  })
}

/**
 * 将相邻的「未跑过且已废弃」节点归为一段并默认收起。
 * 已执行节点（成功/失败/执行中/场外）和当前轨将要跑的节点保持展开。
 */
const flowEntries = computed(() => {
  const entries = []
  for (const node of detail.value?.nodes || []) {
    if (node.step_type === 'archive') continue
    const previous = entries.at(-1)
    if (isDiscardedUnexecutedNode(node) && previous?.type === 'skipped') {
      previous.nodes.push(node)
      previous.key = `skipped-${previous.nodes[0].id}-${node.id}`
    } else if (isDiscardedUnexecutedNode(node)) {
      entries.push({ type: 'skipped', key: `skipped-${node.id}-${node.id}`, nodes: [node] })
    } else {
      entries.push({ type: 'node', key: `node-${node.id}`, nodes: [node] })
    }
  }
  return entries
})

function nodeHasAdapt(n) {
  return !!(n?.input?.adapt || n?.output?.adapt)
}

const visibleFlowEntries = computed(() => {
  if (rightTab.value !== 'adapt') return flowEntries.value
  return flowEntries.value
    .map((entry) => ({
      ...entry,
      nodes: (entry.nodes || []).filter((n) => nodeHasAdapt(n)),
    }))
    .filter((entry) => entry.nodes.length)
})

function isSkippedFlowGroupExpanded(entry) {
  return !!expandedSkippedFlowGroups.value[entry.key]
}

function toggleSkippedFlowGroup(entry) {
  expandedSkippedFlowGroups.value = {
    ...expandedSkippedFlowGroups.value,
    [entry.key]: !isSkippedFlowGroupExpanded(entry),
  }
}

function isClonedNode(n) {
  return !!(n?.output?.cloned || n?.input?.cloned)
}

/** 当前世代起点：最近一次克隆批次，否则当前步及之后（仅用于历史样式，不再折叠） */
const flowHistorySplitIndex = computed(() => {
  const nodes = detail.value?.nodes || []
  if (!nodes.length) return 0
  const last = detail.value?.session?.context?.lastRestart
  const batch = last?.cloneBatchId
  if (batch) {
    const i = nodes.findIndex(
      (n) => (n.output?.cloneBatchId || n.input?.cloneBatchId) === batch,
    )
    if (i > 0) return i
  }
  const cur = Number(detail.value?.session?.current_step_index)
  if (!Number.isFinite(cur)) return 0
  const i = nodes.findIndex((n) => Number(n.step_index) >= cur)
  return i > 0 ? i : 0
})

function isFlowHistoryNode(n) {
  const nodes = detail.value?.nodes || []
  const i = nodes.findIndex((x) => x.id === n.id)
  return i >= 0 && i < flowHistorySplitIndex.value
}

/** 流程轨应锚定滚动的节点：场外当前段 → 待确认 → 执行中 → 当前步 → 游标步 */
const flowAnchorNodeId = computed(() => {
  const nodes = detail.value?.nodes || []
  if (!nodes.length) return null
  const off = activeOffsiteNode.value
  if (off?.id) return off.id
  const archWait = nodes.find(
    (n) => n.step_type === 'archive' && n.status === 'waiting_human' && isCurrent(n),
  )
  if (archWait) return archWait.id
  const waitingAtCur = nodes.find(
    (n) => n.status === 'waiting_human' && Number(n.step_index) === Number(detail.value?.session?.current_step_index),
  )
  if (waitingAtCur) return waitingAtCur.id
  const waiting = [...nodes].reverse().find((n) => n.status === 'waiting_human')
  if (waiting) return waiting.id
  const running = nodes.find((n) => n.status === 'running')
  if (running) return running.id
  const cur = nodes.find((n) => isCurrent(n))
  if (cur) return cur.id
  const idx = Number(detail.value?.session?.current_step_index)
  if (Number.isFinite(idx)) {
    const byIdx = nodes.find((n) => Number(n.step_index) === idx)
    if (byIdx) return byIdx.id
  }
  return nodes[nodes.length - 1]?.id || null
})

let flowScrollTimer = 0
function scrollFlowToAnchor() {
  if (rightTab.value !== 'flow') return
  const id = flowAnchorNodeId.value
  if (!id) return
  window.clearTimeout(flowScrollTimer)
  flowScrollTimer = window.setTimeout(async () => {
    await nextTick()
    const el = document.querySelector(
      `[data-flow-node-id="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id}"]`,
    )
    if (!el) return
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, 40)
}

watch(
  [flowAnchorNodeId, () => rightTab.value, () => detail.value?.nodes?.length],
  () => {
    scrollFlowToAnchor()
  },
)

/** 离开场外 / 从这里继续：往前跳直达；往回/再跑追加克隆；已归档亦可 */
async function restartFromNode(n) {
  if (!n || !activeId.value) return
  if (n.step_type === 'offsite') {
    ElMessage.warning('临时协助没有「重新开始」；请点右侧正常节点「从这里继续」')
    return
  }
  if (n.step_type === 'archive') {
    ElMessage.warning('归档节点没有「重新开始」；请点右侧正常节点')
    return
  }
  if (gating.value) return
  const wasOffsite = offsiteActive.value
  const wasArchived = detail.value?.session?.status === 'archived'
  gating.value = true
  try {
    const r = await api.sessions.restartFromNode(activeId.value, {
      nodeInstanceId: n.id,
      stepIndex: n.step_index,
    })
    rightTab.value = 'flow'
    footerCollapsed.value = false
    await loadDetail(activeId.value)
    sessions.value = await api.sessions.list()
    const focusId = r.nodeInstanceId || n.id
    expandedNodeId.value = focusId
    scrollFlowToAnchor()
    const title = r.title || n.title || `步骤 ${n.step_index + 1}`
    const suffix = wasArchived
      ? ' · 已恢复'
      : wasOffsite || r.offsiteArchived
        ? ' · 临时协助本段已归档'
        : ''
    ElMessage.success(
      r.forwardJump
        ? `已跳到「${title}」继续${suffix}`
        : `已从「${title}」继续${suffix}`,
    )
  } catch (e) {
    // 业务异常由接口呈现，不再 toast Error
  } finally {
    gating.value = false
  }
}

function goShortcuts() {
  router.push('/settings/shortcuts')
}

async function runSlash(cmd) {
  if (!cmd) return
  try {
    let url
    if (cmd.kind === 'url' && cmd.promptForUrl) {
      const { value } = await ElMessageBox.prompt(cmd.description || '打开网址', cmd.name, {
        inputValue: cmd.url || 'https://',
      })
      url = value
    }
    const args = extractCallArgsFromSlash(readSenderTextRaw(), cmd.slash)
    const r = await api.slashCommands.run(cmd.id, {
      sessionId: activeId.value || undefined,
      url,
      args,
    })
    slashOpen.value = false
    slashQuery.value = ''
    if (r.kind === 'url' && r.url) {
      window.open(r.url, '_blank', 'noopener')
      clearSender()
    } else if (r.kind === 'agent') {
      // 熔炉 / 成员 Agent：写入提示语到输入框，用户可补全后发送
      await replaceSenderText(
        r.insertText || `请【${r.memberName || FURNACE_DISPLAY_NAME}】协助处理：`,
      )
    } else {
      clearSender()
    }
    ElMessage.success(r.message || `已执行 /${cmd.slash}`)
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function onSenderSubmit() {
  if (sending.value || uploading.value) return
  const text = readSenderText()
  const atts = [...pendingFiles.value]

  // /指令 提交时执行而非发消息
  if (text.startsWith('/')) {
    const token = text.slice(1).trim().split(/\s+/)[0] || ''
    const cmd =
      slashCommands.value.find((c) => c.enabled !== false && c.slash === token) ||
      filteredSlashCmds.value[slashIndex.value]
    if (cmd) {
      await runSlash(cmd)
      return
    }
    ElMessage.warning(`未找到指令 /${token}，可在 设置 → 斜杠 / 快捷键 中配置`)
    return
  }

  // 人工输入 / 缺参补齐闸门：Enter = 提交闸门（纯 @成员协助除外，不推进流程）
  const g = pendingGate.value
  const mentionAssist =
    !!text &&
    isMentionAssistOnly(
      text,
      (members.value || []).map((m) => ({
        display_name: m.display_name,
        name: m.name,
      })),
    )
  if (
    (g?.content?.mode === 'human_input' || g?.content?.mode === 'need_params') &&
    !mentionAssist
  ) {
    await submitHuman(g)
    return
  }
  // 启动闸门 / 审核闸门：Enter 只发消息，保持 pending，不默认通过或拒绝
  // 人工闸门下纯 @：走发消息协助，不当项目参数提交

  if (!text && !atts.length) return

  if (!activeId.value) {
    ElMessage.warning('请先选择会话')
    return
  }
  sending.value = true
  try {
    const r = await api.sessions.message(activeId.value, text, atts)
    clearSender()
    pendingFiles.value = []
    if (r.mentionPending) {
      ElMessage.success(
        r.offsiteMode === 'planned' ? '临时协助 · 已记入挂起节点' : '已进入临时协助',
      )
      if (r.mainGateWaiting) {
        ElMessage.info('主流程仍停在当前确认，临时协助不替代提交')
      }
    }
    if (r.newSession && r.session) {
      await loadLists()
      await selectSession(r.session.id)
      ElMessage.success('已创建新任务')
    } else {
      await loadDetail(activeId.value)
      sessions.value = await api.sessions.list()
    }
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    sending.value = false
  }
}

function nextIdempotencyKey(action, nodeInstanceId) {
  return `gate_${action || 'x'}_${nodeInstanceId || 'none'}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

async function submitHuman(m) {
  if (gating.value) return
  const text = readSenderText()
  // 闸门「提交」按钮：纯 @ 协助不当参数
  if (
    text &&
    isMentionAssistOnly(
      text,
      (members.value || []).map((x) => ({
        display_name: x.display_name,
        name: x.name,
      })),
    )
  ) {
    await onSenderSubmit()
    return
  }
  gating.value = true
  try {
    await api.sessions.gate(activeId.value, {
      action: 'submit',
      text,
      nodeInstanceId: m.node_instance_id,
      idempotencyKey: nextIdempotencyKey('submit', m.node_instance_id),
    })
    clearSender()
    await loadDetail(activeId.value)
    sessions.value = await api.sessions.list()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    gating.value = false
  }
}

/** 开聊启动闸门：通过（可带说明/参数）后才开始跑流程 */
async function approveSessionStart(m) {
  if (gating.value) return
  gating.value = true
  try {
    const text = readSenderText()
    await api.sessions.gate(activeId.value, {
      action: 'approve_start',
      text,
      nodeInstanceId: m?.node_instance_id || undefined,
      idempotencyKey: nextIdempotencyKey('approve_start', m?.node_instance_id),
    })
    clearSender()
    await loadDetail(activeId.value)
    sessions.value = await api.sessions.list()
    ElMessage.success('已通过，开始执行')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    gating.value = false
  }
}

async function gate(m, action) {
  if (gating.value) return
  gating.value = true
  try {
    // 同意/拒绝/归档等：附言取自底部唯一输入框（X07）
    const text = readSenderText()
    await api.sessions.gate(activeId.value, {
      action,
      text: text || undefined,
      nodeInstanceId: m?.node_instance_id || undefined,
      idempotencyKey: nextIdempotencyKey(action, m?.node_instance_id),
    })
    clearSender()
    await loadDetail(activeId.value)
    sessions.value = await api.sessions.list()
    if (action === 'approve_start') ElMessage.success('已通过，开始执行')
    else if (action === 'cancel_start') ElMessage.info('已取消，任务关闭')
    else if (action === 'resume_interrupted') ElMessage.success('已继续')
    else if (action === 'discard_interrupted' || action === 'archive_interrupted')
      ElMessage.info('已放弃；进程请到设置里释放')
    else if (action === 'approve' || action === 'admin_approve')
      ElMessage.success(text?.trim() ? '已同意并记录附言' : '已同意')
    else if (action === 'reject' || action === 'admin_reject')
      ElMessage.info(text?.trim() ? '已拒绝并记录附言' : '已拒绝')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    gating.value = false
  }
}

async function rename() {
  if (!activeId.value || !editTitle.value.trim()) return
  try {
    await api.sessions.rename(activeId.value, editTitle.value.trim())
    sessions.value = await api.sessions.list()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

/** @param {string} [targetId] 侧栏菜单可传指定会话 id；顶栏按钮不传则删当前 */
async function doDelete(targetId) {
  const id = targetId || activeId.value
  if (!id) {
    ElMessage.warning('没有可删除的会话')
    return
  }
  try {
    await ElMessageBox.confirm('确认删除该聊天？不可恢复', '删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await api.sessions.remove(id)
    if (activeId.value === id) {
      detail.value = null
      activeId.value = null
      if (ws) {
        try {
          ws.close()
        } catch {
          /* ignore */
        }
        ws = null
      }
      router.replace('/workbench')
    }
    await loadLists()
    ElMessage.success('已删除')
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}

onUnmounted(() => {
  window.clearTimeout(flowScrollTimer)
  if (ws) ws.close()
})

loadLists().then(() => {
  const sid = route.params.sessionId
  if (sid) selectSession(sid)
  if (route.query.furnace === '1' || route.query.furnace === 'true') {
    launchFurnaceFromSprite()
  }
})
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

/* 居中内容列 */
.wb-chat-col {
  width: 100%;
  max-width: var(--ecw-stage-max, 780px);
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 有内嵌终端时放宽消息列，给终端卡片更多空间。
   只作用于消息区：输入框保持原有阅读宽度，避免整屏排版跳动 */
.wb-chat-col.is-wide {
  max-width: var(--ecw-stage-max-wide, 1180px);
}

.wb-chat-footer .wb-chat-col {
  height: auto;
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

.composer-gate-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
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

.meta-gate {
  color: var(--ecw-text-3, #8e8ea0);
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

@keyframes welcome-rise {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
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

.composer-toolbar-hint {
  flex: 1;
  min-width: 0;
  font-size: 11.5px;
  color: var(--ecw-text-3, #8b8f9a);
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

/* —— 流程轨细节 —— */
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
</style>
