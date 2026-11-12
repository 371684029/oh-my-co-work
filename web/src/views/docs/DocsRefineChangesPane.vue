<template>
  <div class="refine-ledger" :class="{ 'is-compact': compact }">
    <div class="rl-head">
      <div>
        <div class="rl-title">节点炼化与源码修改记录</div>
        <p class="rl-sub">
          展示熔炉炼化/适配时对成员脚本的修改备份，以及工作流各节点执行前后的 Git 代码改动，支持一键还原。
        </p>
      </div>
      <el-button size="small" plain :loading="loading" @click="load">刷新</el-button>
    </div>

    <div v-if="loading" class="rl-empty">加载中…</div>
    <div v-else-if="!refineMembers.length && !sessions.length" class="rl-empty">
      暂无炼化或节点代码修改记录。开启成员/步骤的「炼化」或「适配」，或运行产生文件改动的节点后，修改记录与还原入口会显示在这里。
    </div>

    <template v-else>
      <section v-if="refineMembers.length" class="rl-section">
        <h4 class="rl-sec-title">成员炼化 / 适配源码备份</h4>
        <div v-for="m in refineMembers" :key="m.id" class="rl-card">
          <div class="rl-card-head">
            <div class="rl-card-main">
              <strong>{{ m.name }}</strong>
              <span v-if="m.refineEnabled" class="rl-tag rl-tag--ok">已开启炼化</span>
              <span v-else-if="m.adaptEnabled" class="rl-tag rl-tag--adapt">已开启适配</span>
              <span v-else class="rl-tag">已还原</span>
            </div>
            <el-button
              v-if="m.refineBackup || m.history?.length"
              size="small"
              type="warning"
              :loading="restoringKey === m.id"
              @click="restoreMember(m)"
            >
              还原最新备份
            </el-button>
          </div>
          <div v-if="m.verifyLast" class="rl-verify">
            <span
              class="rl-tag"
              :class="m.verifyLast.ok && !m.verifyFailed ? 'rl-tag--ok' : 'rl-tag--warn'"
            >
              {{ m.verifyLast.ok && !m.verifyFailed ? '试跑通过' : '试跑未通过' }}
            </span>
            <span class="rl-time" v-if="m.verifyLast.at">{{ fmtTime(m.verifyLast.at) }}</span>
            <span class="rl-verify-detail">{{
              (m.verifyLast.checks || [])
                .filter((c) => !c.ok)
                .map((c) => c.detail)
                .join('；') || '炼化探针已记录'
            }}</span>
            <el-button
              v-if="props.sessionId"
              size="small"
              link
              type="primary"
              @click="openVerifyTimeline"
            >
              运行验证记录
            </el-button>
            <el-button v-else size="small" link type="primary" @click="goMembersSettings(m.id)">
              成员试跑记录
            </el-button>
          </div>

          <div v-if="m.history?.length" class="rl-history">
            <div v-for="h in m.history" :key="h.id" class="rl-hist-item">
              <div class="rl-hist-bar">
                <span class="rl-tag" :class="h.kind === 'refine' ? 'rl-tag--refine' : 'rl-tag--adapt'">
                  {{ h.kind === 'refine' ? '炼化' : '适配' }}
                </span>
                <span class="rl-time">{{ fmtTime(h.createdAt) }}</span>
                <span class="rl-files-count">{{ h.files?.length || 0 }} 个文件</span>
                <el-button
                  v-if="h.canRestore"
                  size="small"
                  link
                  type="warning"
                  :loading="restoringKey === `${m.id}:${h.id}`"
                  @click="restoreMember(m, h.id)"
                >
                  还原到此版本
                </el-button>
              </div>
              <div v-for="f in h.files || []" :key="f.path" class="rl-file">
                <div class="rl-file-row" @click="toggleDiff(`${h.id}:${f.path}`)">
                  <code class="rl-path">{{ f.path }}</code>
                  <span class="rl-diff-toggle">
                    {{ f.diff ? (openDiffs[`${h.id}:${f.path}`] ? '收起修改对比' : '查看修改对比') : '与备份一致' }}
                  </span>
                </div>
                <pre v-if="f.diff && openDiffs[`${h.id}:${f.path}`]" class="rl-diff">{{ f.diff }}</pre>
              </div>
            </div>
          </div>
          <div v-else-if="m.refineBackup" class="rl-path-only">
            备份文件：<code>{{ m.refineBackup }}</code>
          </div>
        </div>
      </section>

      <section v-if="sessions.length" class="rl-section">
        <h4 class="rl-sec-title">工作流节点代码改动（Git 快照）</h4>
        <div v-for="s in sessions" :key="s.sessionId" class="rl-card">
          <div class="rl-card-head">
            <strong>{{ s.title || s.sessionId }}</strong>
          </div>
          <div v-for="n in s.nodes" :key="n.id" class="rl-node">
            <div class="rl-node-bar">
              <div class="rl-node-title">
                <span class="rl-step-badge">#{{ (n.stepIndex ?? 0) + 1 }}</span>
                <span>{{ n.title }}</span>
                <span class="rl-stat">
                  {{ n.filesChanged }} 个文件
                  <template v-if="n.insertions || n.deletions">
                    （+{{ n.insertions || 0 }} / -{{ n.deletions || 0 }}）
                  </template>
                </span>
              </div>
              <div class="rl-node-actions">
                <el-button
                  v-if="n.patch"
                  size="small"
                  link
                  type="primary"
                  @click="toggleDiff(`node:${n.id}`)"
                >
                  {{ openDiffs[`node:${n.id}`] ? '收起改动' : '查看改动' }}
                </el-button>
                <el-button
                  size="small"
                  type="warning"
                  plain
                  :loading="restoringKey === `node:${n.id}`"
                  @click="revertNode(s.sessionId, n)"
                >
                  回退此步改动
                </el-button>
              </div>
            </div>
            <pre v-if="n.summary" class="rl-stat-block">{{ n.summary }}</pre>
            <pre v-if="n.patch && openDiffs[`node:${n.id}`]" class="rl-diff">{{ n.patch }}</pre>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ElMessage from 'element-plus/es/components/message/index.mjs'
import ElMessageBox from 'element-plus/es/components/message-box/index.mjs'
import { api } from '../../api'
import { useFlowStore } from '../../stores/flow.js'

const props = defineProps({
  sessionId: { type: String, default: '' },
  compact: { type: Boolean, default: false },
})

const router = useRouter()
const flowStore = useFlowStore()

const data = ref(null)
const loading = ref(false)
const restoringKey = ref('')
const openDiffs = reactive({})

const refineMembers = computed(() =>
  (data.value?.members || []).filter(
    (m) =>
      m.refineEnabled ||
      m.refineBackup ||
      m.adaptEnabled ||
      m.adaptBackup ||
      (m.history && m.history.length),
  ),
)
const sessions = computed(() => data.value?.sessions || [])

function toggleDiff(key) {
  openDiffs[key] = !openDiffs[key]
}

function openVerifyTimeline() {
  if (!props.sessionId) return
  flowStore.openSessionTimeline('verify')
}

function goMembersSettings(memberId) {
  router.push({ path: '/settings/members', query: memberId ? { id: memberId } : {} })
}

function fmtTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

async function load() {
  loading.value = true
  try {
    data.value = await api.restoreCenter.list(props.sessionId || '')
  } catch (e) {
    ElMessage.error(e?.message || '加载修改记录失败')
  } finally {
    loading.value = false
  }
}

async function restoreMember(member, manifestId = '') {
  try {
    await ElMessageBox.confirm(
      `将把成员「${member.name}」的源脚本恢复到炼化/适配前的备份版本。继续？`,
      '还原源码备份',
      { type: 'warning', confirmButtonText: '还原', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  const key = manifestId ? `${member.id}:${manifestId}` : member.id
  restoringKey.value = key
  try {
    await api.members.restoreRefine(member.id, { manifestId })
    ElMessage.success('已还原源文件')
    await load()
  } catch (e) {
    if (e?.status === 409 || e?.data?.code === 'RESTORE_CONFLICT' || String(e?.message || '').includes('改动')) {
      try {
        await ElMessageBox.confirm(
          `${e.message}。是否强制覆盖还原？`,
          '源文件有后续改动',
          { type: 'warning', confirmButtonText: '强制还原', cancelButtonText: '取消' },
        )
        await api.members.restoreRefine(member.id, { force: true, manifestId })
        ElMessage.success('已强制还原源文件')
        await load()
      } catch (e2) {
        if (e2 !== 'cancel' && e2 !== 'close') ElMessage.error(e2?.message || '还原失败')
      }
    } else {
      ElMessage.error(e?.message || '还原失败')
    }
  } finally {
    restoringKey.value = ''
  }
}

async function revertNode(sessionId, node) {
  restoringKey.value = `node:${node.id}`
  try {
    const preview = await api.sessions.previewStepRevert(sessionId, node.id)
    if (!preview.ok) {
      ElMessage.warning(preview.message || '该节点没有可回退的快照')
      return
    }
    await ElMessageBox.confirm(
      preview.message || `将把工作区回退到步骤「${node.title}」执行前的状态。继续？`,
      '回退节点代码改动',
      {
        type: 'warning',
        confirmButtonText: preview.needsForce ? '强制回退' : '回退',
        cancelButtonText: '取消',
      },
    )
    await api.sessions.applyStepRevert(sessionId, node.id, { force: !!preview.needsForce })
    ElMessage.success('已回退到该步骤执行前的代码状态')
    await load()
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    if (e?.status === 409 || e?.data?.code === 'CONFLICT') {
      try {
        await ElMessageBox.confirm(
          `${e.message || '工作区存在后续改动'}。是否强制覆盖回退？`,
          '工作区有后续改动',
          { type: 'warning', confirmButtonText: '强制回退', cancelButtonText: '取消' },
        )
        await api.sessions.applyStepRevert(sessionId, node.id, { force: true })
        ElMessage.success('已强制回退到该步骤执行前的代码状态')
        await load()
        return
      } catch (e2) {
        if (e2 !== 'cancel' && e2 !== 'close') ElMessage.error(e2?.message || '回退失败')
        return
      }
    }
    ElMessage.error(e?.message || '回退失败')
  } finally {
    restoringKey.value = ''
  }
}

watch(() => props.sessionId, () => load())
onMounted(load)
</script>

<style scoped>
.refine-ledger {
  padding: 16px 20px;
  overflow-y: auto;
}
.refine-ledger.is-compact {
  padding: 8px 4px;
}
.rl-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.rl-title {
  font-size: 15px;
  font-weight: 700;
  color: #1d1d1f;
}
.rl-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6e6e73;
}
.rl-empty {
  padding: 24px 12px;
  font-size: 13px;
  color: #86868b;
  text-align: center;
}
.rl-section {
  margin-bottom: 18px;
}
.rl-sec-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 650;
  color: #1d1d1f;
}
.rl-card {
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.rl-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.rl-card-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.rl-tag {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
  color: #6e6e73;
  white-space: nowrap;
}
.rl-tag--ok,
.rl-tag--refine {
  background: rgba(0, 122, 255, 0.12);
  color: #0066cc;
}
.rl-tag--adapt {
  background: rgba(255, 149, 0, 0.15);
  color: #b25000;
}
.rl-tag--warn {
  background: rgba(255, 59, 48, 0.12);
  color: #c9342b;
}
.rl-verify {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #6e6e73;
}
.rl-verify-detail {
  flex: 1 1 120px;
  min-width: 0;
}
.rl-history {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rl-hist-item {
  border-top: 1px dashed rgba(0, 0, 0, 0.08);
  padding-top: 8px;
}
.rl-hist-bar,
.rl-node-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
}
.rl-time,
.rl-files-count,
.rl-stat {
  color: #6e6e73;
  font-size: 12px;
}
.rl-file {
  margin-top: 4px;
}
.rl-file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.03);
}
.rl-path {
  font-size: 11.5px;
  word-break: break-all;
}
.rl-diff-toggle {
  font-size: 11.5px;
  color: #0066cc;
  white-space: nowrap;
}
.rl-diff,
.rl-stat-block {
  margin: 6px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: #17191f;
  color: #e7e9ee;
  font-size: 11.5px;
  line-height: 1.45;
  max-height: 280px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.rl-node {
  border-top: 1px dashed rgba(0, 0, 0, 0.08);
  padding-top: 8px;
  margin-top: 8px;
}
.rl-node-title {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.rl-step-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.06);
}
</style>
