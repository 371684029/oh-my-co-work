<template>
  <div class="shortcuts-page">
    <div class="page-head">
      <div>
        <h2 class="page-title">斜杠指令与快捷键脚本</h2>
        <p class="page-desc">
          聊天 <code>/</code> 为<strong>斜杠指令</strong>（脚本工作目录可自动填）。勾选<strong>快捷键触发</strong>的项用于任意位置绑键跑脚本（脚本工作目录须手填，逻辑相同）。
        </p>
      </div>
      <el-button type="primary" @click="openCreate">添加指令</el-button>
    </div>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="hint"
      title="斜杠指令：选脚本可自动填脚本工作目录。快捷键触发跑脚本：脚本工作目录必填且不会自动填写（页内/桌面绑键同一规则）。"
    />

    <el-table :data="commands" stripe v-loading="loading">
      <el-table-column label="启用" width="72">
        <template #default="{ row }">
          <el-switch v-model="row.enabled" @change="persist" />
        </template>
      </el-table-column>
      <el-table-column label="名称" prop="name" min-width="120" />
      <el-table-column label="触发" width="140">
        <template #default="{ row }">
          <code v-if="row.hotkeyScript || row.desktopHotkey" class="slash">⌨ {{ row.hotkey || '快捷键' }}</code>
          <code v-else class="slash">/{{ row.slash }}</code>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="100">
        <template #default="{ row }">
          {{ kindLabel(row.kind) }}
        </template>
      </el-table-column>
      <el-table-column label="弹窗" width="100">
        <template #default="{ row }">
          <span v-if="row.kind !== 'shell'">—</span>
          <span v-else>{{ popupLabel(row) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="目标" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <template v-if="row.kind === 'agent'">
            Agent · {{ row.memberName || row.memberKey || row.memberId || '—' }}
          </template>
          <template v-else-if="row.kind === 'url'">{{ row.url }}</template>
          <template v-else>{{ row.command }}</template>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row, $index }">
          <el-button link type="primary" @click="openEdit(row, $index)">编辑</el-button>
          <el-button link type="primary" @click="openClone(row)">克隆</el-button>
          <el-button link type="success" @click="tryRun(row)">试运行</el-button>
          <el-button link type="danger" @click="removeAt($index)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-drawer v-model="drawer" :title="drawerTitle" size="440px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="显示名称" required>
          <el-input v-model="form.name" placeholder="如：打开编辑器" />
        </el-form-item>
        <el-form-item label="快捷键触发">
          <el-switch v-model="form.hotkeyScript" />
          <p class="field-hint">
            用于页内、桌面或任意位置绑键跑脚本（非聊天 <code>/</code>）。<strong>脚本工作目录必填</strong>，选脚本也不会自动填写。
          </p>
        </el-form-item>
        <el-form-item v-if="!form.hotkeyScript" label="触发词（/ 后面）" required>
          <el-input v-model="form.slash" placeholder="editor">
            <template #prepend>/</template>
          </el-input>
        </el-form-item>
        <el-form-item v-else label="快捷键（可选，预留）">
          <el-input v-model="form.hotkey" placeholder="如 Ctrl+Shift+E（绑定位置不限，规则相同）" />
        </el-form-item>
        <el-form-item v-if="form.hotkeyScript" label="内部标识（/ 触发词，必填）" required>
          <el-input v-model="form.slash" placeholder="run_my_script">
            <template #prepend>/</template>
          </el-input>
          <p class="field-hint">仅作配置 id，聊天里不一定要用 / 唤起。</p>
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="类型" required>
          <el-radio-group v-model="form.kind">
            <el-radio value="agent">管理员/成员 Agent</el-radio>
            <el-radio value="shell">本机命令</el-radio>
            <el-radio value="url">打开网址</el-radio>
          </el-radio-group>
        </el-form-item>
        <template v-if="form.kind === 'agent'">
          <el-form-item label="绑定成员 Agent" required>
            <el-select
              v-model="form.memberId"
              filterable
              clearable
              placeholder="选择成员（默认统一管理员）"
              style="width: 100%"
              @change="onMemberPick"
            >
              <el-option
                v-for="m in members"
                :key="m.id"
                :label="m.display_name"
                :value="m.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="唤起后填入输入框的提示语">
            <el-input
              v-model="form.prompt"
              type="textarea"
              :rows="2"
              placeholder="请【统一管理员】协助处理："
            />
          </el-form-item>
        </template>
        <template v-else-if="form.kind === 'shell'">
          <el-form-item label="命令模板" required>
            <el-input
              v-model="form.command"
              type="textarea"
              :rows="2"
              placeholder='node index.mjs  或  code "{folder}"'
            />
          </el-form-item>
          <el-form-item label="脚本文件（可选）">
            <PathPicker
              v-model="form.scriptPath"
              mode="file"
              placeholder="选本机脚本；相对路径以「脚本工作目录」为基准"
              :hint="
                form.hotkeyScript
                  ? '快捷键触发：选文件不会自动填脚本工作目录'
                  : '斜杠指令：选文件后自动填脚本工作目录；仅写 node index.mjs 时保存也会从命令推断'
              "
              @update:model-value="onSlashScriptPathChange"
            />
          </el-form-item>
          <el-form-item
            label="脚本工作目录"
            :required="form.hotkeyScript && shellHasScriptAnchor(form)"
          >
            <PathPicker
              v-model="form.scriptWorkDir"
              mode="folder"
              :placeholder="
                form.hotkeyScript
                  ? '快捷键跑脚本时必填'
                  : '命令如 node index.mjs 时一般会自动填写'
              "
              :hint="
                form.hotkeyScript
                  ? '须手填；页内/桌面绑键同一规则'
                  : '运行脚本的 cwd；{folder} 仍指会话工作目录'
              "
            />
          </el-form-item>
          <el-form-item v-if="!form.hotkeyScript" label="继承成员脚本工作目录（可选）">
            <el-select
              v-model="form.anchorMemberId"
              filterable
              clearable
              placeholder="与某成员的脚本工作目录 / 脚本文件对齐"
              style="width: 100%"
            >
              <el-option
                v-for="m in scriptMembers"
                :key="m.id"
                :label="m.display_name"
                :value="m.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="工作目录目标">
            <el-select v-model="form.openTarget" style="width: 100%">
              <el-option label="当前会话/群工作文件夹" value="sessionWorkFolder" />
              <el-option label="自定义路径" value="custom" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="form.openTarget === 'custom'" label="自定义路径">
            <el-input v-model="form.customPath" placeholder="D:\projects\foo" />
          </el-form-item>
          <el-form-item label="是否展示脚本弹窗">
            <el-select v-model="form.showScriptPopupMode" style="width: 100%">
              <el-option label="跟随全局设置" value="inherit" />
              <el-option label="是（尽量显示控制台）" value="yes" />
              <el-option label="否（静默）" value="no" />
            </el-select>
            <p class="field-hint">
              优先级：本指令 &gt; 全局。打开编辑器/资源管理器等 GUI 本身会弹窗，不受此限制。
            </p>
          </el-form-item>
        </template>
        <template v-else>
          <el-form-item label="默认 URL">
            <el-input v-model="form.url" placeholder="https://" />
          </el-form-item>
          <el-form-item label="运行时询问网址">
            <el-switch v-model="form.promptForUrl" />
          </el-form-item>
        </template>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-button type="primary" @click="saveForm">保存</el-button>
      </el-form>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../../api'
import PathPicker from '../../components/PathPicker.vue'

const commands = ref([])
const members = ref([])
const loading = ref(false)
const drawer = ref(false)
const drawerTitle = ref('添加指令')
const editIndex = ref(-1)
const form = ref(emptyForm())

const scriptMembers = computed(() =>
  (members.value || []).filter((m) => m.kind === 'script'),
)

function emptyForm() {
  return {
    id: '',
    name: '',
    slash: '',
    description: '',
    enabled: true,
    kind: 'agent',
    command: 'code "{folder}"',
    url: 'https://',
    promptForUrl: false,
    openTarget: 'sessionWorkFolder',
    customPath: '',
    memberId: '',
    memberName: '统一管理员',
    memberKey: 'unified_admin',
    prompt: '请【统一管理员】协助处理：',
    /** inherit | yes | no — 仅 shell 有效 */
    showScriptPopupMode: 'inherit',
    scriptPath: '',
    scriptWorkDir: '',
    scriptDir: '',
    anchorMemberId: '',
    hotkeyScript: false,
    desktopHotkey: false,
    hotkey: '',
  }
}

const SCRIPT_EXT_RE = /\.(mjs|cjs|js|ts|tsx|jsx|bat|cmd|ps1|py|sh)$/i

function shellHasScriptAnchor(f) {
  if (!f || f.kind !== 'shell') return false
  if (String(f.scriptPath || '').trim()) return true
  if (!f.hotkeyScript && !f.desktopHotkey && String(f.anchorMemberId || '').trim()) return true
  const cmd = String(f.command || '').trim()
  if (!cmd) return false
  const parts = cmd.match(/(?:[^\s"'`]+|"[^"]*"|'[^']*')+/g) || []
  return parts.some((p) => {
    const t = p.replace(/^["']|["']$/g, '').trim()
    return t && SCRIPT_EXT_RE.test(t)
  })
}

function dirnameOfFilePath(p) {
  if (!p) return ''
  const norm = String(p).replace(/[/\\]+$/, '')
  const i = Math.max(norm.lastIndexOf('\\'), norm.lastIndexOf('/'))
  if (i <= 0) return norm
  if (/^[a-zA-Z]:$/.test(norm.slice(0, i))) return norm.slice(0, i + 1)
  return norm.slice(0, i) || norm
}

function onSlashScriptPathChange(v) {
  if (form.value.hotkeyScript || form.value.desktopHotkey) return
  const raw = (v ?? '').trim()
  if (!raw) return
  if (/^[a-zA-Z]:[\\/]|^\\\\|^\//.test(raw)) {
    const d = dirnameOfFilePath(raw)
    form.value.scriptWorkDir = d
    form.value.scriptDir = d
  }
}

function kindLabel(k) {
  if (k === 'agent') return 'Agent'
  if (k === 'url') return '网址'
  return '本机命令'
}

function popupModeFromCmd(row = {}) {
  if (row.showScriptPopup === true) return 'yes'
  if (row.showScriptPopup === false) return 'no'
  return 'inherit'
}

function popupLabel(row) {
  const m = popupModeFromCmd(row)
  if (m === 'yes') return '是'
  if (m === 'no') return '否'
  return '跟随全局'
}

function applyPopupModeToCmd(f) {
  const mode = f.showScriptPopupMode || 'inherit'
  const out = { ...f }
  delete out.showScriptPopupMode
  if (out.kind !== 'shell') {
    delete out.showScriptPopup
    return out
  }
  if (mode === 'yes') out.showScriptPopup = true
  else if (mode === 'no') out.showScriptPopup = false
  else delete out.showScriptPopup
  return out
}

function onMemberPick(id) {
  const m = members.value.find((x) => x.id === id)
  if (m) {
    form.value.memberName = m.display_name
    form.value.memberKey = m.name
  }
}

async function load() {
  loading.value = true
  try {
    const [r, mem] = await Promise.all([api.slashCommands.list(), api.members.list()])
    commands.value = r.commands || []
    members.value = mem || []
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

async function persist() {
  try {
    const r = await api.slashCommands.save(commands.value)
    commands.value = r.commands || commands.value
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error(e.message)
    await load()
  }
}

function openCreate() {
  editIndex.value = -1
  form.value = emptyForm()
  form.value.id = `cmd_${Date.now().toString(36)}`
  drawerTitle.value = '添加指令'
  drawer.value = true
}

function openEdit(row, index) {
  editIndex.value = index
  form.value = {
    ...emptyForm(),
    ...row,
    scriptWorkDir: row.scriptWorkDir || row.scriptDir || '',
    scriptDir: row.scriptWorkDir || row.scriptDir || '',
    hotkeyScript: !!(row.hotkeyScript || row.desktopHotkey),
    desktopHotkey: !!(row.hotkeyScript || row.desktopHotkey),
    hotkey: row.hotkey || '',
    showScriptPopupMode: popupModeFromCmd(row),
  }
  drawerTitle.value = '编辑指令'
  drawer.value = true
}

function openClone(row) {
  editIndex.value = -1
  const baseSlash = String(row.slash || 'cmd').replace(/^\//, '')
  let slash = `${baseSlash}_copy`
  let n = 2
  const used = new Set(commands.value.map((c) => c.slash.toLowerCase()))
  while (used.has(slash.toLowerCase())) {
    slash = `${baseSlash}_copy${n++}`
  }
  form.value = {
    ...emptyForm(),
    ...row,
    id: `cmd_${Date.now().toString(36)}`,
    name: `${row.name || baseSlash} 副本`,
    slash,
    scriptWorkDir: row.scriptWorkDir || row.scriptDir || '',
    scriptDir: row.scriptWorkDir || row.scriptDir || '',
    hotkeyScript: !!(row.hotkeyScript || row.desktopHotkey),
    desktopHotkey: !!(row.hotkeyScript || row.desktopHotkey),
    hotkey: row.hotkey || '',
    showScriptPopupMode: popupModeFromCmd(row),
  }
  drawerTitle.value = '克隆指令'
  drawer.value = true
}

async function saveForm() {
  let f = { ...form.value }
  f.slash = String(f.slash || '')
    .replace(/^\//, '')
    .trim()
  if (!f.name.trim() || !f.slash) {
    ElMessage.warning('请填写名称与触发词')
    return
  }
  if (f.kind === 'shell' && (f.hotkeyScript || f.desktopHotkey) && shellHasScriptAnchor(f)) {
    const sw = String(f.scriptWorkDir || f.scriptDir || '').trim()
    if (!sw) {
      ElMessage.warning('快捷键跑脚本须手填脚本工作目录')
      return
    }
  }
  if (f.hotkeyScript || f.desktopHotkey) {
    f.hotkeyScript = true
    f.desktopHotkey = true
    f.anchorMemberId = ''
  } else {
    f.hotkeyScript = false
    f.desktopHotkey = false
  }
  f = applyPopupModeToCmd(f)
  const sw = String(f.scriptWorkDir || f.scriptDir || '').trim()
  if (sw) {
    f.scriptWorkDir = sw
    f.scriptDir = sw
  }
  if (editIndex.value >= 0) {
    commands.value[editIndex.value] = f
  } else {
    commands.value.push(f)
  }
  drawer.value = false
  await persist()
}

async function removeAt(index) {
  await ElMessageBox.confirm('删除该快捷指令？', '删除', { type: 'warning' })
  commands.value.splice(index, 1)
  await persist()
}

async function tryRun(row) {
  try {
    let url
    if (row.kind === 'url' && row.promptForUrl) {
      const { value } = await ElMessageBox.prompt('打开网址', '试运行', {
        inputValue: row.url || 'https://',
      })
      url = value
    }
    const r = await api.slashCommands.run(row.id, { url })
    if (r.kind === 'url' && r.url) {
      window.open(r.url, '_blank', 'noopener')
    }
    if (r.kind === 'agent') {
      ElMessage.success(r.message || `已唤起 ${r.memberName || 'Agent'}`)
      return
    }
    ElMessage.success(r.message || '已执行')
  } catch (e) {
    ElMessage.error(e.message)
  }
}

onMounted(load)
</script>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}
.page-title {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.03em;
}
.page-desc {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
.field-hint {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--el-text-color-secondary);
}
.page-desc code {
  background: var(--el-fill-color-light);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
}
.hint {
  margin-bottom: 16px;
  border-radius: 12px;
}
.slash {
  font-size: 12px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  padding: 2px 8px;
  border-radius: 6px;
}
</style>
