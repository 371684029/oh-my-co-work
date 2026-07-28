<template>
  <div>
    <div class="page-head">
      <div>
        <h2 class="page-title">成员管理</h2>
        <p class="page-desc">
          脚本成员支持 bat / PowerShell / Python / Node / Shell 等。支持<strong>编辑</strong>与<strong>克隆</strong>。
        </p>
      </div>
      <el-button type="primary" @click="openCreate()">新建成员</el-button>
    </div>

    <el-table :data="list" stripe>
      <el-table-column prop="display_name" label="显示名" min-width="120" />
      <el-table-column label="简介" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.config?.description || '—' }}
        </template>
      </el-table-column>
      <el-table-column prop="kind" label="类型" width="90" />
      <el-table-column label="运行" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          {{ runSummary(row) }}
        </template>
      </el-table-column>
      <el-table-column prop="work_folder" label="工作文件夹" show-overflow-tooltip />
      <el-table-column label="操作" width="260">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="primary" @click="openClone(row)">克隆</el-button>
          <el-button link type="info" @click="view(row)">查看</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-drawer
      v-model="drawer"
      :title="drawerTitle"
      size="480px"
      destroy-on-close
      class="member-settings-drawer"
    >
      <el-form v-if="!readonly" label-position="top">
        <el-form-item label="显示名称" required>
          <el-input v-model="form.displayName" placeholder="如：示例回声" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input
            v-model="form.description"
            placeholder="可选，一句话说明职责"
            maxlength="120"
            show-word-limit
            clearable
          />
        </el-form-item>
        <el-form-item label="工作文件夹（可选）">
          <PathPicker
            v-model="form.workFolder"
            mode="folder"
            placeholder="流程、#文件夹、开编辑器等"
            hint="与「脚本工作目录」无关；脚本相对路径只认脚本工作目录"
          />
        </el-form-item>
        <el-form-item label="类型" required>
          <el-select v-model="form.kind" style="width: 100%">
            <el-option label="echo 示例" value="echo" />
            <el-option label="script 脚本 / 命令" value="script" />
          </el-select>
        </el-form-item>

        <template v-if="form.kind === 'script'">
          <el-form-item label="运行方式">
            <el-radio-group v-model="form.script.mode">
              <el-radio value="file">脚本 / 程序文件</el-radio>
              <el-radio value="command">一段命令</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item v-if="form.script.mode === 'file'" label="文件路径" required>
            <PathPicker
              v-model="form.script.filePath"
              mode="file"
              placeholder="选择 .bat / .ps1 / .py / .js …"
              :extensions="scriptExts"
              hint="可手填，或点「浏览」选择本机脚本；相对路径以「脚本工作目录」为基准"
              @update:model-value="onScriptAnchorPathChange"
            />
          </el-form-item>

          <el-form-item v-else label="命令" required>
            <el-input
              v-model="form.script.command"
              type="textarea"
              :rows="3"
              placeholder="如 node index.mjs、python app.py（保存时会尝试从命令里识别 .mjs/.js 等并自动填脚本工作目录）"
            />
            <div class="field-hint">
              <strong>完全由你配置</strong>，产品不内置任何工具名。走 PATH；占位符
              <code>#a</code> / <code>{#a}</code>（调用时输入框参数）、{#1} #群聊 #文件夹 {input}
              {folder}（空占位自动去掉）。含 $env: 时 runtime 用 PowerShell 或 auto。
            </div>
          </el-form-item>

          <el-form-item
            v-if="form.script.mode === 'command'"
            label="锚点脚本（可选）"
          >
            <PathPicker
              v-model="form.script.scriptPath"
              mode="file"
              placeholder="选 index.mjs 等，自动写入脚本工作目录"
              :extensions="scriptExts"
              hint="浏览选中脚本即可；与命令里 node index.mjs 二选一或同时用"
              @update:model-value="onScriptAnchorPathChange"
            />
          </el-form-item>

          <el-form-item label="脚本工作目录">
            <PathPicker
              v-model="form.script.scriptWorkDir"
              mode="folder"
              placeholder="选脚本后一般会自动填写；命令如 node index.mjs 时保存也会推断"
              hint="运行脚本时的 cwd，与会话/成员工作文件夹无关"
            />
          </el-form-item>

          <el-form-item label="是否展示脚本弹窗">
            <el-select v-model="form.script.showScriptPopupMode" style="width: 100%">
              <el-option label="跟随全局设置" value="inherit" />
              <el-option label="是（始终弹窗）" value="yes" />
              <el-option label="否（静默）" value="no" />
            </el-select>
            <span class="switch-hint"
              >优先级：本成员 &gt; 全局「设置 → 是否展示脚本弹窗」。</span
            >
          </el-form-item>

          <el-collapse class="member-advanced">
            <el-collapse-item title="高级" name="adv">
              <el-form-item label="运行时 / 解释器">
                <el-select v-model="form.script.runtime" style="width: 100%" filterable allow-create>
                  <el-option label="自动（按扩展名 / 系统）" value="auto" />
                  <el-option label="cmd" value="cmd" />
                  <el-option label="PowerShell" value="powershell" />
                  <el-option label="pwsh" value="pwsh" />
                  <el-option label="bash" value="bash" />
                  <el-option label="python" value="python" />
                  <el-option label="node" value="node" />
                </el-select>
                <div class="field-hint">也可直接填解释器路径，如 C:\Python311\python.exe</div>
              </el-form-item>

              <el-form-item v-if="form.script.mode === 'file'" label="附加参数（空格分隔）">
                <el-input v-model="form.script.argsText" placeholder="--flag value" />
              </el-form-item>

              <el-form-item label="环境变量（可选）">
                <el-input
                  v-model="form.script.envText"
                  type="textarea"
                  :rows="2"
                  placeholder="KEY=value 每行一个；留空则继承本机环境（含系统代理）"
                />
                <div class="field-hint">勿写死机器路径；代理等请用本机环境或在此自行配置</div>
              </el-form-item>

              <el-form-item label="超时（毫秒）">
                <el-input-number
                  v-model="form.script.timeoutMs"
                  :min="1000"
                  :step="60000"
                  :max="3600000"
                />
                <div class="field-hint">默认 600000（10 分钟）；可按成员单独改</div>
              </el-form-item>

              <el-form-item label="打开后不等待结束">
                <el-switch v-model="form.script.detach" />
                <span class="switch-hint"
                  >适合 Cursor CLI 等：打开窗口后立刻回「已打开」，不把关窗当成失败；可能还需手动关窗。</span
                >
              </el-form-item>

              <el-form-item label="把输入写入 stdin">
                <el-switch v-model="form.script.useHumanAsStdin" />
              </el-form-item>
            </el-collapse-item>
          </el-collapse>
        </template>

        <el-button type="primary" @click="save">
          {{ form._editId ? '保存修改' : form._cloneFrom ? '克隆保存' : '创建' }}
        </el-button>
      </el-form>

      <div v-else>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="显示名">{{ viewRow.display_name }}</el-descriptions-item>
          <el-descriptions-item label="简介">
            {{ viewRow.config?.description || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="类型">{{ viewRow.kind }}</el-descriptions-item>
          <el-descriptions-item label="工作文件夹">{{ viewRow.work_folder || '—' }}</el-descriptions-item>
          <el-descriptions-item label="配置">
            <pre class="cfg-pre">{{ JSON.stringify(viewRow.config, null, 2) }}</pre>
          </el-descriptions-item>
        </el-descriptions>
        <div class="view-actions">
          <el-button type="primary" @click="openEdit(viewRow)">编辑</el-button>
          <el-button @click="openClone(viewRow)">克隆</el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../../api'
import PathPicker from '../../components/PathPicker.vue'
// 与 @acw/shared DEFAULT_SCRIPT_TIMEOUT_MS 一致：10 分钟
const DEFAULT_SCRIPT_TIMEOUT_MS = 600_000

const scriptExts = [
  '.bat',
  '.cmd',
  '.ps1',
  '.sh',
  '.py',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.rb',
  '.php',
  '.vbs',
  '.jar',
  '.exe',
]

const list = ref([])
const drawer = ref(false)
const drawerTitle = ref('')
const readonly = ref(false)
const viewRow = ref(null)
const form = ref(emptyForm())

function emptyForm() {
  return {
    displayName: '',
    description: '',
    workFolder: '',
    kind: 'script',
    script: {
      mode: 'file',
      filePath: '',
      scriptPath: '',
      scriptWorkDir: '',
      scriptDir: '',
      command: 'echo ECW-OK',
      runtime: 'auto',
      argsText: '',
      envText: '',
      timeoutMs: DEFAULT_SCRIPT_TIMEOUT_MS,
      /** inherit | yes | no */
      showScriptPopupMode: 'inherit',
      detach: false,
      useHumanAsStdin: false,
    },
  }
}

/** 解析 KEY=value 环境变量文本 */
function parseEnvText(text) {
  const env = {}
  if (!text || !String(text).trim()) return env
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i <= 0) continue
    const k = t.slice(0, i).trim()
    const v = t.slice(i + 1).trim()
    if (k) env[k] = v
  }
  return env
}

function envTextFromObj(obj) {
  if (!obj || typeof obj !== 'object') return ''
  return Object.entries(obj)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
}

/** 成员 script → 表单三态 */
function popupModeFromScript(s = {}) {
  if (s.showScriptPopup === true || s.showConsole === true) return 'yes'
  if (s.showScriptPopup === false || s.hideWindow === true || s.showConsole === false) return 'no'
  return 'inherit'
}

/** 表单三态 → 写入 script 字段 */
function popupFieldsFromMode(mode) {
  if (mode === 'yes') return { showScriptPopup: true, showConsole: true, hideWindow: false }
  if (mode === 'no') return { showScriptPopup: false, showConsole: false, hideWindow: true }
  // inherit：不写死，删除强制项
  return {}
}

function runSummary(row) {
  if (row.kind !== 'script') return row.kind
  const s = row.config?.script || row.config || {}
  if (s.mode === 'file' || s.filePath) {
    const p = s.filePath || s.path || ''
    const base = p.split(/[/\\]/).pop() || p
    return `file · ${base}${s.runtime && s.runtime !== 'auto' ? ` (${s.runtime})` : ''}`
  }
  const cmd = (s.command || '').slice(0, 40)
  return `cmd · ${cmd}${(s.command || '').length > 40 ? '…' : ''}`
}

function parseArgs(text) {
  if (!text || !String(text).trim()) return []
  // 简单按空格拆，支持引号
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  const out = []
  let m
  while ((m = re.exec(text))) {
    out.push(m[1] ?? m[2] ?? m[3])
  }
  return out
}

function dirnameOfFilePath(p) {
  if (!p) return ''
  const norm = String(p).replace(/[/\\]+$/, '')
  const i = Math.max(norm.lastIndexOf('\\'), norm.lastIndexOf('/'))
  if (i <= 0) return norm
  if (/^[a-zA-Z]:$/.test(norm.slice(0, i))) return norm.slice(0, i + 1)
  return norm.slice(0, i) || norm
}

/** 浏览选脚本后写入 scriptWorkDir（文件路径 / 命令锚点脚本共用） */
function onScriptAnchorPathChange(v) {
  const raw = (v ?? '').trim()
  if (!raw) {
    form.value.script.scriptWorkDir = ''
    form.value.script.scriptDir = ''
    return
  }
  if (/^[a-zA-Z]:[\\/]|^\\\\|^\//.test(raw)) {
    const d = dirnameOfFilePath(raw)
    form.value.script.scriptWorkDir = d
    form.value.script.scriptDir = d
  }
}

async function load() {
  list.value = await api.members.list()
}

function fillFromRow(row, { asClone = false } = {}) {
  const s = row.config?.script || {}
  return {
    displayName: asClone ? `${row.display_name} 副本` : row.display_name,
    description: row.config?.description || '',
    workFolder: row.work_folder || '',
    kind: row.kind,
    script: {
      mode: s.mode || (s.filePath ? 'file' : 'command'),
      filePath: s.filePath || '',
      scriptPath: s.scriptPath || '',
      scriptWorkDir: s.scriptWorkDir || s.scriptDir || '',
      scriptDir: s.scriptWorkDir || s.scriptDir || '',
      command: s.command || 'echo ECW-OK',
      runtime: s.runtime || 'auto',
      argsText: Array.isArray(s.args) ? s.args.join(' ') : '',
      envText: envTextFromObj(s.env),
      timeoutMs: s.timeoutMs || DEFAULT_SCRIPT_TIMEOUT_MS,
      showScriptPopupMode: popupModeFromScript(s),
      detach: !!(s.detach || s.waitForExit === false),
      useHumanAsStdin: !!(s.useHumanAsStdin || s.passHumanInput || s.stdin),
    },
    _editId: asClone ? undefined : row.id,
    _cloneFrom: asClone ? row.id : undefined,
  }
}

function openCreate() {
  readonly.value = false
  form.value = emptyForm()
  drawerTitle.value = '新建成员'
  drawer.value = true
}

function openEdit(row) {
  readonly.value = false
  form.value = fillFromRow(row, { asClone: false })
  drawerTitle.value = '编辑成员'
  drawer.value = true
}

function openClone(row) {
  readonly.value = false
  form.value = fillFromRow(row, { asClone: true })
  drawerTitle.value = '克隆成员'
  drawer.value = true
}

function view(row) {
  readonly.value = true
  viewRow.value = row
  drawerTitle.value = '查看成员'
  drawer.value = true
}

async function save() {
  try {
    if (!form.value.displayName?.trim()) {
      ElMessage.warning('请填写显示名称')
      return
    }
    const s = form.value.script
    const desc = (form.value.description || '').trim()
    const baseConfig = {}
    if (desc) baseConfig.description = desc
    // 编辑时保留 demo / defaultText 等原有字段
    const prev =
      form.value._editId && list.value.find((m) => m.id === form.value._editId)?.config
    if (prev?.demo) baseConfig.demo = true
    if (form.value.kind === 'echo' && prev?.defaultText) {
      baseConfig.defaultText = prev.defaultText
    }

    const body = {
      displayName: form.value.displayName.trim(),
      name: form.value.displayName.trim(),
      kind: form.value.kind,
      workFolder: form.value.workFolder || null,
      config:
        form.value.kind === 'script'
          ? {
              ...baseConfig,
              script: {
                mode: s.mode,
                filePath: s.mode === 'file' ? s.filePath : undefined,
                scriptPath: s.mode === 'command' ? s.scriptPath || undefined : undefined,
                scriptWorkDir: s.scriptWorkDir || s.scriptDir || undefined,
                scriptDir: s.scriptWorkDir || s.scriptDir || undefined,
                command: s.mode === 'command' ? s.command : undefined,
                runtime: s.runtime || 'auto',
                args: s.mode === 'file' ? parseArgs(s.argsText) : undefined,
                ...(Object.keys(parseEnvText(s.envText)).length
                  ? { env: parseEnvText(s.envText) }
                  : {}),
                timeoutMs: s.timeoutMs || DEFAULT_SCRIPT_TIMEOUT_MS,
                ...popupFieldsFromMode(s.showScriptPopupMode || 'inherit'),
                detach: !!s.detach,
                useHumanAsStdin: !!s.useHumanAsStdin,
                passHumanInput: !!s.useHumanAsStdin,
              },
            }
          : { ...baseConfig },
    }
    if (form.value._editId) {
      await api.members.update(form.value._editId, body)
    } else if (form.value._cloneFrom) {
      await api.members.clone(form.value._cloneFrom, body)
    } else {
      await api.members.create(body)
    }
    drawer.value = false
    await load()
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function remove(row) {
  await ElMessageBox.confirm(`删除成员「${row.display_name}」？`, '删除', { type: 'warning' })
  try {
    await api.members.remove(row.id)
    await load()
    ElMessage.success('已删除')
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
  margin-bottom: 20px;
  gap: 16px;
}
.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.page-desc {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin: 8px 0 0;
  line-height: 1.5;
  max-width: 520px;
}
.field-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.45;
}
.switch-hint {
  margin-left: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.member-advanced {
  margin: 8px 0 16px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
}
.member-advanced :deep(.el-collapse-item__header) {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  padding: 12px 16px;
  line-height: 1.4;
  border-bottom: none;
}
.member-advanced :deep(.el-collapse-item__wrap) {
  border-bottom: none;
}
.member-advanced :deep(.el-collapse-item__content) {
  padding: 4px 16px 16px;
}
.member-advanced :deep(.el-form-item) {
  margin-bottom: 18px;
}
.member-advanced :deep(.el-form-item:last-child) {
  margin-bottom: 4px;
}
.member-settings-drawer :deep(.el-drawer__body) {
  padding: 8px 20px 24px;
}
.cfg-pre {
  margin: 0;
  white-space: pre-wrap;
  font-size: 12px;
}
.view-actions {
  margin-top: 16px;
  display: flex;
  gap: 10px;
}
</style>
