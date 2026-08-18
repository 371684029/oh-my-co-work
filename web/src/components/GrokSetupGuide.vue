<template>
  <div class="grok-guide">
    <div class="grok-status">
      <el-tag :type="status.installed ? 'success' : 'warning'" size="small">
        {{ status.installed ? '已安装' : '未安装' }}
      </el-tag>
      <el-tag :type="status.loggedIn ? 'success' : 'warning'" size="small">
        {{ status.loggedIn ? '已登录或已有秘钥' : '未登录' }}
      </el-tag>
      <el-tag :type="status.configured ? 'success' : 'warning'" size="small">
        {{ status.configured ? '已配置模型' : '未配置' }}
      </el-tag>
    </div>
    <p class="grok-lead">
      熔炉跑本机 <strong>Grok Build</strong>。缺安装、没登录、或 <code>config.toml</code> 还没写好秘钥时，按下面三步补齐。官方说明：
      <a :href="install.docs" target="_blank" rel="noopener">docs.x.ai/build</a>
    </p>

    <section class="grok-step" :class="{ 'grok-step--todo': missing('install') }">
      <h3>1. 下载安装</h3>
      <p>macOS / Linux / Git Bash：</p>
      <pre class="grok-code">{{ install.unix }}</pre>
      <p>Windows PowerShell：</p>
      <pre class="grok-code">{{ install.windows }}</pre>
      <p>
        然后执行 <code>grok --version</code>。安装包也会放到
        <code>~/.grok/bin</code>。页面：
        <a :href="install.site" target="_blank" rel="noopener">{{ install.site }}</a>
      </p>
    </section>

    <section class="grok-step" :class="{ 'grok-step--todo': missing('login') }">
      <h3>2. 登录</h3>
      <p>在项目目录运行 <code>grok</code>，第一次会打开浏览器登录。凭证在 <code>~/.grok/auth.json</code>。</p>
      <p>无浏览器环境可用环境变量（把值换成你的秘钥）：</p>
      <pre class="grok-code">export XAI_API_KEY="秘钥"</pre>
      <p>若只用下方第三方模型、在 <code>config.toml</code> 里写了真实 <code>api_key</code>，也算已登录。</p>
    </section>

    <section class="grok-step" :class="{ 'grok-step--todo': missing('config') }">
      <h3>3. 配置模型</h3>
      <p>
        用户配置文件：<code>{{ install.configPathUnix }}</code>
        （Windows：<code>{{ install.configPathWindows }}</code>）。
        把所有 <code>api_key</code> 换成你自己的<strong>秘钥</strong>，不要提交到 git。
      </p>
      <div class="grok-copy-row">
        <el-button size="small" @click="copyToml">复制示例</el-button>
        <span class="grok-copy-hint">{{ configPathHint }}</span>
      </div>
      <pre class="grok-code grok-code--toml">{{ exampleToml }}</pre>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { GROK_BUILD_INSTALL } from '@acw/shared'

const props = defineProps({
  status: { type: Object, default: () => ({}) },
  exampleToml: { type: String, default: '' },
})

const install = computed(() => ({
  ...GROK_BUILD_INSTALL,
  ...(props.status.install || {}),
}))

const configPathHint = computed(() => props.status.configPath || GROK_BUILD_INSTALL.configPathUnix)

function missing(gap) {
  return (props.status.gaps || []).includes(gap)
}

async function copyToml() {
  const text = props.exampleToml || ''
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制示例（请把秘钥换成你自己的）')
  } catch {
    ElMessage.warning('复制失败，请手动选中文本')
  }
}
</script>

<style scoped>
.grok-status {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.grok-lead {
  color: var(--ecw-text-2, #5c5c66);
  line-height: 1.6;
  margin: 0 0 16px;
  font-size: 13px;
}
.grok-step {
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  padding: 12px 14px 8px;
  margin-bottom: 12px;
  background: rgba(255, 255, 255, 0.5);
}
.grok-step--todo {
  border-color: rgba(230, 162, 60, 0.45);
  background: rgba(230, 162, 60, 0.06);
}
.grok-step h3 {
  margin: 0 0 8px;
  font-size: 14px;
}
.grok-step p {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--ecw-text-2, #5c5c66);
}
.grok-code {
  margin: 0 0 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #1e1e24;
  color: #e8e8ee;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.grok-code--toml {
  max-height: 360px;
  overflow: auto;
  white-space: pre;
  word-break: normal;
}
.grok-copy-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.grok-copy-hint {
  font-size: 12px;
  color: #8e8ea0;
}
</style>
