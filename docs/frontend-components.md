# 前端组件与 UI 约定

| 属性 | 内容 |
|------|------|
| 状态 | **已决并已接入代码** |
| 包名 | [`vue-element-plus-x`](https://www.npmjs.com/package/vue-element-plus-x) · [文档](https://v2.element-plus-x.com) |
| 主题 | Element Plus / Plus-X **默认色板**；业务氛围用 `web/src/styles.css` 的 `--ecw-*` 变量 |
| 代码入口 | `web/src/main.js`、`App.vue`、`styles.css`、`views/Workbench.vue` |
| 更新日期 | 2026-07-20（0.4 封板：气泡 `noStyle` 单层） |

---

## 1. 组件优先级

| 优先级 | 库 | 用途 |
|--------|-----|------|
| **1** | **vue-element-plus-x** | 会话、气泡消息、发送框、欢迎页等 AI 对话场景 |
| **2** | **element-plus** | 表单、表格、抽屉、菜单、按钮、Tag、MessageBox、Segmented |
| **3** | 自研 | 壳层布局、右侧流程轨、运行时闸门卡、设置侧栏分区 |

### 全局注册

```js
// web/src/main.js
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import ElementPlusX from 'vue-element-plus-x'
import 'vue-element-plus-x/styles/index.css'

app.use(ElementPlus, { locale: zhCn })
app.use(ElementPlusX)
```

---

## 2. 工作台映射（已实现）

| 区域 | 组件 | 说明 |
|------|------|------|
| 壳层顶栏 | `App.vue` + `AppLogo` | 矢量品牌 Logo + 分段导航 |
| Logo | `components/AppLogo.vue` · `assets/logo.svg` | **左人 · 中文档 · 右机**（人机协同办公）；见 [brand-logo.md](./brand-logo.md) |
| 左栏会话 | `Conversations` + 开聊条 | 群模板 / 成员分组下拉 → 开聊；`items` + `v-model:active` |
| 中栏消息 | `BubbleList` | **`noStyle`** 去组件外壳；`#content` 内 `.bubble-rich` 单层气泡；`#header` 发送人、`#avatar` 首字 |
| 中栏输入 | `XSender` | **`ref` 取文** + `@submit`；`@paste-file` 粘贴上传；`submit-type="enter"`；工具栏 `/` `@` `#` · 附件 · **复制** |
| 附件 | 自研 chip + 气泡 file-card | 先 `POST /sessions/:id/files`，再随消息 `attachments[]` |
| Composer 面板 | 自研 slash / at / hash | `/` 指令；`@` 成员/节点；`#` → `#群聊`/`#文件夹`/`#1`…/`#出n` |
| 未选会话 | 自研欢迎主视觉 | 居中口号 + Logo + 三步引导（项目核心文案） |
| 运行时闸门 | 说明卡 + 操作下沉 | 卡内只留说明；**通过/取消/提交…** 在输入区工具栏右侧大按钮 |
| 右栏流程 | 自研 `flow-step` | 当前 / 执行中呼吸 / **未执行** / 完成落定 / **场外**；克制动效 |
| 右栏资源 | 自研 resources pane | 进程登记、目录软锁占用、再杀一次、归档解占 |
| 右栏群报告 | 自研 announce 卡片 | **# 参数** + 各节点入出；刷新 / **打开 MD**（`ANNOUNCEMENT.md`） |
| 设置 | `el-form` / `el-table` / `el-drawer` | 成员、群模板 |
| 支持与交流 | `Support.vue` | 侧栏浅灰「其它」分区，非项目功能 |

### XSender 注意（必读）

`vue-element-plus-x@2` 的 `XSender` **无可靠 v-model 回写**。

| 正确做法 | 错误做法 |
|----------|----------|
| `ref` + `getModelValue()` / `getText()` 读内容 | 依赖 `v-model` 的 `text` 字段发消息 |
| 发送后 `clear()` | 只清空本地空对象 |

Enter 发送：`submit-type="enter"`（Shift+Enter 换行）。自测脚本：`scripts/test-enter-send.mjs`。

---

## 3. 视觉布局原则（Codex 气质 · 更大气）

参考 Codex / ChatGPT：**安静 chrome、居中主舞台、悬浮输入、少边框多层次**。

| 原则 | 落地 |
|------|------|
| **画布氛围** | 全页径向浅色光晕（`--ecw-canvas` + radial gradients） |
| **浮层分栏** | 左 / 中 / 右 **圆角卡片** + 间隙，非贴边硬分割 |
| **主舞台抬升** | 中间栏阴影最强；顶区淡蓝光晕 |
| **输入吸睛** | Composer 大圆角 + 深阴影；`focus-within` 上浮与蓝光 |
| **品牌** | 顶栏 `ec` 色块 + 双行标题；导航胶囊 |
| **运行时未执行** | **标红**（顶栏胶囊、闸门卡、流程轨）— 仅待处理时（原「等人」文案已统一为「未执行」） |
| **场外协助** | 线性可扩展；重开=本会话追加克隆；归档可无限、再发不新开群聊；全程可见；自动滚到当前节点；「当前段」高亮 |
| **归档** | 只释资源；可无限次；再发仍在本会话；续跑追加克隆节点；外部窗口或需手关 |
| **本机资源** | 右侧「资源」：PID、仅唤起风险、目录软锁占用方；可再杀 / 归档解占 |
| **配置态人工** | 设置里人工/闸门 **中性灰**，不抢色 |
| **非项目菜单** | 「支持与交流」浅灰 + 分隔到「其它」 |

### 设计令牌

见 `web/src/styles.css` 的 `:root`：

- 布局：`--ecw-sidebar-w` / `--ecw-rail-w` / `--ecw-stage-max` / `--ecw-topbar-h`
- 表面：`--ecw-canvas` / `--ecw-surface` / `--ecw-surface-muted`
- 深度：`--ecw-shadow*` / `--ecw-shadow-composer`
- 圆角：`--ecw-radius` / `--ecw-radius-lg`

业务色优先 `var(--el-color-*)` 与 `type`；氛围色用 `--ecw-*`，**不覆盖** `--el-color-primary`。

### 滚动条

工作台与设置内容区 **隐藏滚动条、保留滚动**（`.hide-scrollbar` 及相关容器）。

---

## 4. 人机视觉分层

| 场景 | 强调程度 | 样式关键词 |
|------|----------|------------|
| 工作台 · 当前等人 / 待处理闸门 | **强 · 红** | `needsHuman`、`gate-card--attention`、`human-wait` |
| 工作台 · 未轮到的人工/闸门步骤 | 弱 · 中性 | `human-config` |
| 设置 · 人工步骤 / 闸门开关 | 弱 · 灰 info | `step-card--human`、plain tag |

原则：**配置看结构，运行看行动。**

---

## 5. 原则清单

1. 对话/会话能力 **优先 Plus-X**，避免再手写气泡列表。  
2. 颜色：组件 `type` + `var(--el-color-*)` + 布局 `--ecw-*`。  
3. 新增 AI 交互前先查 [Plus-X 组件文档](https://v2.element-plus-x.com)。  
4. 改布局/氛围时同步更新本文与 [mvp.md](./mvp.md) 修订记录。  
5. 构建产物较大属正常（全量注册）；后续可按需引入优化。

### Composer 三快捷（已实现）

| 触发 | 作用 | 行为 |
|------|------|------|
| `/` | 快捷指令 | 整段以 `/` 开头；Enter 执行选中项（打开编辑器/文件夹/URL 等） |
| `@` | 提及 | 插入 `@成员`（流程外协助）；续跑流程用右侧「克隆并从此开始」 |
| `#` | 文本快捷 | `#` 仅唤起；选中后**只插入正文**（不含 `#`）；候选：群聊/文件夹/第 n 段输入/输出整段 |

键盘：↑↓ 选择 · Enter/Tab 确认 · Esc 关闭；与 `/` `@` 面板互斥。

闸门操作：**不放在说明卡底部**，与 `/` `@` `#` 同一工具栏右侧（`composer-gate-actions`，约 36px 高）。

---

## 相关

- 运行与验收：[../README.md](../README.md)  
- MVP 范围：[mvp.md](./mvp.md)  
- 技术设计（含后置 @ 上下文等）：[technical-design.md](./technical-design.md)  
