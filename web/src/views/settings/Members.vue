<template>
  <div>
    <div class="page-head">
      <div>
        <h2 class="page-title">成员管理</h2>
        <p class="page-desc">
          脚本成员支持 bat / PowerShell / Python / Node / Shell 等。默认走<strong>内嵌终端</strong>。支持<strong>编辑</strong>与<strong>克隆</strong>。
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


        <template v-if="form.kind === 'script'">
          <el-tabs v-model="scriptTab" class="member-script-tabs">
            <el-tab-pane label="基础" name="basic">
              <el-form-item label="运行方式">
                <el-radio-group v-model="form.script.mode" @change="onScriptModeChange">
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

              <el-form-item label="脚本工作目录" required>
                <PathPicker
                  v-model="form.script.scriptWorkDir"
                  mode="folder"
                  placeholder="必填：脚本运行时的 cwd"
                  :hint="workDirHint"
                />
              </el-form-item>

              <el-form-item label="执行界面">
                <el-select v-model="form.script.executionMode" style="width: 100%">
                  <el-option label="内嵌终端（TUI / 交互式 CLI）" value="terminal" />
                  <el-option label="普通执行（兼容现有脚本）" value="pipe" />
                </el-select>
                <div class="field-hint">
                  默认内嵌终端：对话中出现终端卡，可进入中栏交互。仅非交互脚本才改回普通执行。
                </div>
              </el-form-item>

              <el-form-item v-if="form.script.executionMode !== 'terminal'" label="是否展示脚本弹窗">
                <el-select v-model="form.script.showScriptPopupMode" style="width: 100%">
                  <el-option label="跟随全局设置" value="inherit" />
                  <el-option label="是（始终弹窗）" value="yes" />
                  <el-option label="否（静默）" value="no" />
                </el-select>
                <span class="switch-hint"
                  >优先级：本成员 &gt; 全局「设置 → 是否展示脚本弹窗」。</span
                >
              </el-form-item>

              <el-form-item label="超时（毫秒）">
                <el-input-number
                  v-model="form.script.timeoutMs"
                  :min="1000"
                  :step="60000"
                  :max="3600000"
                  style="width: 100%"
                />
                <div class="field-hint">
                  默认 600000（10 分钟）。交互式脚本（需人在黑窗里输入）请酌情调大，避免未到「待确认」就被引擎杀掉。
                </div>
              </el-form-item>
            </el-tab-pane>

            <el-tab-pane label="高级" name="advanced">
              <el-form-item label="运行时 / 解释器">
                <el-select v-model="form.script.runtime" style="width: 100%" filterable allow-create>
                  <el-option label="cmd" value="cmd" />
                  <el-option label="自动（按扩展名 / 系统）" value="auto" />
                  <el-option label="PowerShell" value="powershell" />
                  <el-option label="pwsh" value="pwsh" />
                  <el-option label="bash" value="bash" />
                  <el-option label="python" value="python" />
                  <el-option label="node" value="node" />
                </el-select>
                <div class="field-hint">
                  也可直接填解释器路径，如 C:\Python311\python.exe。
                  <template v-if="form.script.mode === 'file'">
                    脚本文件建议用「自动」按扩展名分派（.py 走 python、.js 走 node）；
                    选 cmd 会用 cmd /c 调起该文件，仅适合 .bat / .cmd / .exe。
                  </template>
                  <template v-else>默认「自动」：Windows 一段命令走 cmd，其它系统走本机 shell。不要为了 bat 去选 bash。</template>
                </div>
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

              <el-form-item label="进程常驻（不等待退出）">
                <el-switch v-model="form.script.detach" />
                <span class="switch-hint">
                  <template v-if="form.script.executionMode === 'terminal'">
                    内嵌终端默认开启：启动成功即推进节点，grok / CLI 可继续输入，归档时回收。关掉则等进程退出（或超时）。
                  </template>
                  <template v-else>
                    适合 Cursor CLI 等：打开窗口后立刻回「已打开」，不把关窗当成失败；可能还需手动关窗。
                  </template>
                </span>
              </el-form-item>

              <el-form-item label="把输入写入 stdin">
                <el-switch v-model="form.script.useHumanAsStdin" />
              </el-form-item>
            </el-tab-pane>
          </el-tabs>
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
import { ref, computed, onMounted } from 'vue'
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
const scriptTab = ref('basic')
const installDir = ref('')

const workDirHint = computed(() => {
  if (form.value.script.scriptWorkDir === installDir.value && installDir.value) {
    return '已预填软件安装目录，可按需修改'
  }
  return '必填。选脚本文件可自动填写；命令如 node index.mjs 时保存也会尝试推断'
})

function isWindowsClient() {
  return typeof navigator !== 'undefined' && /windows/i.test(navigator.userAgent)
}

function defaultRuntime() {
  return isWindowsClient() ? 'cmd' : 'auto'
}

function scriptKeepAlive(s = {}) {
  if (s.waitForExit === true || s.detach === false) return false
  if (s.detach === true || s.waitForExit === false) return true
  return s.executionMode !== 'pipe'
}

/** 切换运行方式时若尚未选解释器，按本机补默认值 */
function onScriptModeChange() {
  const s = form.value.script
  if (!s.runtime) s.runtime = defaultRuntime()
}

function emptyForm() {
  return {
    displayName: '',
    description: '',
    kind: 'script',
    script: {
      mode: 'file',
      filePath: '',
      scriptWorkDir: '',
      scriptDir: '',
      command: 'echo ECW-OK',
      runtime: defaultRuntime(),
      argsText: '',
      envText: '',
      timeoutMs: DEFAULT_SCRIPT_TIMEOUT_MS,
      executionMode: 'terminal',
      /** inherit | yes | no */
      showScriptPopupMode: 'inherit',
      detach: true,
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
  const prefix = s.executionMode === 'pipe' ? '' : 'TUI · '
  if (s.mode === 'file' || s.filePath) {
    const p = s.filePath || s.path || ''
    const base = p.split(/[/\\]/).pop() || p
    return `${prefix}file · ${base}${s.runtime && s.runtime !== 'auto' ? ` (${s.runtime})` : ''}`
  }
  const cmd = (s.command || '').slice(0, 40)
  return `${prefix}cmd · ${cmd}${(s.command || '').length > 40 ? '…' : ''}`
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

/** 浏览选脚本后写入 scriptWorkDir（文件路径） */
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

async function loadInstallDir() {
  try {
    const roots = await api.fs.roots()
    const cwd = roots.find((r) => r.type === 'cwd')
    if (cwd) {
      installDir.value = cwd.path
    }
  } catch (e) {
    // ignore
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
    kind: row.kind,
    script: {
      mode: s.mode || (s.filePath ? 'file' : 'command'),
      filePath: s.filePath || '',
      scriptWorkDir: s.scriptWorkDir || s.scriptDir || '',
      scriptDir: s.scriptWorkDir || s.scriptDir || '',
      command: s.command || 'echo ECW-OK',
      runtime: s.runtime || defaultRuntime(),
      argsText: Array.isArray(s.args) ? s.args.join(' ') : '',
      envText: envTextFromObj(s.env),
      timeoutMs: s.timeoutMs || DEFAULT_SCRIPT_TIMEOUT_MS,
      executionMode: s.executionMode === 'pipe' ? 'pipe' : 'terminal',
      showScriptPopupMode: popupModeFromScript(s),
      detach: scriptKeepAlive(s),
      useHumanAsStdin: !!(s.useHumanAsStdin || s.passHumanInput || s.stdin),
    },
    _editId: asClone ? undefined : row.id,
    _cloneFrom: asClone ? row.id : undefined,
  }
}

function openCreate() {
  readonly.value = false
  const f = emptyForm()
  if (installDir.value) {
    f.script.scriptWorkDir = installDir.value
    f.script.scriptDir = installDir.value
  }
  form.value = f
  scriptTab.value = 'basic'
  drawerTitle.value = '新建成员'
  drawer.value = true
}

function openEdit(row) {
  readonly.value = false
  form.value = fillFromRow(row, { asClone: false })
  scriptTab.value = 'basic'
  drawerTitle.value = '编辑成员'
  drawer.value = true
}

function openClone(row) {
  readonly.value = false
  form.value = fillFromRow(row, { asClone: true })
  scriptTab.value = 'basic'
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
    if (form.value.kind === 'script') {
      const sw = String(s.scriptWorkDir || s.scriptDir || '').trim()
      if (!sw) {
        ElMessage.warning('请填写脚本工作目录')
        return
      }
      if (s.mode === 'file' && !String(s.filePath || '').trim()) {
        ElMessage.warning('请填写脚本文件路径')
        return
      }
      if (s.mode === 'command' && !String(s.command || '').trim()) {
        ElMessage.warning('请填写要执行的命令')
        return
      }
    }
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
      config:
        form.value.kind === 'script'
          ? {
              ...baseConfig,
              script: {
                mode: s.mode,
                filePath: s.mode === 'file' ? s.filePath : undefined,
                scriptWorkDir: s.scriptWorkDir || s.scriptDir || undefined,
                scriptDir: s.scriptWorkDir || s.scriptDir || undefined,
                command: s.mode === 'command' ? s.command : undefined,
                runtime: s.runtime || 'auto',
                args: s.mode === 'file' ? parseArgs(s.argsText) : undefined,
                ...(Object.keys(parseEnvText(s.envText)).length
                  ? { env: parseEnvText(s.envText) }
                  : {}),
                timeoutMs: s.timeoutMs || DEFAULT_SCRIPT_TIMEOUT_MS,
                executionMode: s.executionMode === 'pipe' ? 'pipe' : 'terminal',
                ...popupFieldsFromMode(s.showScriptPopupMode || 'inherit'),
                detach: !!s.detach,
                waitForExit: !s.detach,
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

onMounted(() => {
  load()
  loadInstallDir()
})
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
.member-script-tabs {
  margin: 12px 0 4px;
}
.member-script-tabs :deep(.el-tabs__content) {
  padding: 8px 4px 4px;
}
.member-script-tabs :deep(.el-form-item) {
  margin-bottom: 18px;
}
.member-script-tabs :deep(.el-form-item:last-child) {
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
