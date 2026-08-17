<template>
  <div class="prefs-page">
    <div class="page-head">
      <div>
        <h2 class="page-title">终端</h2>
        <p class="page-desc">仅本机浏览器生效。主题、粘贴保护、焦点与退出后是否回到对话。</p>
      </div>
    </div>

    <section class="prefs-card">
      <div class="prefs-title">外观</div>
      <el-form label-position="top" class="admin-form">
        <el-form-item label="主题">
          <el-select v-model="form.theme" style="width: 100%" @change="persist">
            <el-option label="项目深色" value="project-dark" />
            <el-option label="终端原色" value="terminal-default" />
            <el-option label="高对比度" value="high-contrast" />
          </el-select>
        </el-form-item>
        <el-form-item label="字体">
          <el-select v-model="form.fontFamily" style="width: 100%" @change="persist">
            <el-option label="编程等宽（优先 Cascadia / JetBrains）" value="default" />
            <el-option label="系统等宽" value="system" />
          </el-select>
        </el-form-item>
        <el-form-item :label="`字号 ${form.fontSize}px`">
          <el-slider v-model="form.fontSize" :min="11" :max="20" :step="1" @change="persistQuiet" />
        </el-form-item>
        <el-form-item :label="`行高 ${form.lineHeight}`">
          <el-slider
            v-model="form.lineHeight"
            :min="1.1"
            :max="1.8"
            :step="0.1"
            @change="persistQuiet"
          />
        </el-form-item>
        <el-form-item label="光标">
          <el-select v-model="form.cursorStyle" style="width: 100%" @change="persist">
            <el-option label="竖线" value="bar" />
            <el-option label="方块" value="block" />
            <el-option label="下划线" value="underline" />
          </el-select>
        </el-form-item>
        <el-form-item label="光标闪烁">
          <el-switch v-model="form.cursorBlink" @change="persist" />
        </el-form-item>
        <el-form-item :label="`回放缓冲 ${form.scrollback} 行`">
          <el-slider
            v-model="form.scrollback"
            :min="500"
            :max="20000"
            :step="500"
            @change="persistQuiet"
          />
        </el-form-item>
      </el-form>
    </section>

    <section class="prefs-card">
      <div class="prefs-title">输入与粘贴</div>
      <p class="prefs-hint">
        多行或过长粘贴可能被 TUI 立刻执行。默认二次确认；可信工具可改为允许。
        进入终端后标题显示「终端输入中」，Esc 退出焦点，避免把快捷键发给进程。
      </p>
      <el-form label-position="top" class="admin-form">
        <el-form-item label="多行粘贴">
          <el-select v-model="form.pastePolicy" style="width: 100%" @change="persist">
            <el-option label="二次确认（推荐）" value="confirm" />
            <el-option label="直接粘贴" value="allow" />
            <el-option label="拒绝多行/过长粘贴" value="reject" />
          </el-select>
        </el-form-item>
        <el-form-item label="进程结束后自动返回对话">
          <el-switch v-model="form.collapseOnExit" @change="persist" />
        </el-form-item>
      </el-form>
    </section>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { loadTerminalPrefs, saveTerminalPrefs } from '../../composables/terminalPrefs'

const form = reactive(loadTerminalPrefs())

function persistQuiet() {
  Object.assign(form, saveTerminalPrefs({ ...form }))
}

function persist() {
  persistQuiet()
  ElMessage.success('已保存本机终端偏好')
}
</script>

<style scoped>
.prefs-page {
  max-width: 640px;
}
.page-head {
  margin-bottom: 18px;
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
}
.prefs-card {
  padding: 18px 18px 16px;
  border-radius: 16px;
  border: 0.5px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.72);
  margin-bottom: 14px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}
.prefs-title {
  font-size: 14px;
  font-weight: 650;
  margin-bottom: 6px;
}
.prefs-hint {
  margin: 0 0 12px;
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
  line-height: 1.55;
}
.admin-form {
  margin-bottom: 8px;
}
</style>
