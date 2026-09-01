# 前端组件与 UI 约定

| 属性 | 内容 |
|------|------|
| 状态 | **已决并已接入代码** |
| 包名 | [`vue-element-plus-x`](https://www.npmjs.com/package/vue-element-plus-x) · [文档](https://v2.element-plus-x.com) |
| 主题 | Element Plus / Plus-X **默认色板**；业务氛围用 `web/src/styles.css` 的 `--ecw-*` 变量 |
| 代码入口 | `web/src/main.js`、`App.vue`、`styles.css`、`views/Workbench.vue` |
| 更新日期 | 2026-08-25（chatgpt-pets 桌宠图集） |

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

> **3.8.1 拆分说明**：`Workbench.vue` 保留三栏布局壳（≤800 行）；三栏各自成组件
> `views/workbench/components/{SessionRail, FlowRail, ComposerPanel}.vue`，
> 会话/终端/桌宠状态收敛进 `views/workbench/composables/{useSessionDetail,
> useTerminalSessions, useFurnaceSync}.js`（模块级 ref 单例，沿用 furnaceUi 模式，不引 Pinia）。
> 终端状态文案、满屏/全屏/Esc 折叠、本地上传已单一来源化：
> `composables/{terminalStatus, pagefill, localUploads}.js`。
> 下表组件名仍是用户可见面；拆分只动内部组织，不改视觉与交互。

| 区域 | 组件 | 说明 |
|------|------|------|
| 壳层顶栏 | `App.vue` + `AppLogo` | 品牌 Logo + 分段导航 |
| 熔炉桌宠 | `FurnaceSprite` | 贴右、距底约三分之一；chatgpt-pets v2 图集按单帧人物区裁掉左右透明留白，不能把 192px 整格直接缩小；李慕婉 idle / running / waiting + 戳一下 waving，悬停注视；收起后仍是整个人 |
| 熔炉干活面头像 | `FurnaceAvatar` | 仅 GUI 大头；开干活面时藏桌宠 |
| 熔炉干活面 | `FurnaceWorkspace` | GUI 对话框气泡 / TUI 可上翻；**返回群聊**只关皮；顶栏「进程」里**关闭熔炉 / 新开熔炉** |
| Logo | `components/AppLogo.vue` · `assets/logo.svg` | **左人 · 中文档 · 右机**（人机协同办公）；见 [brand-logo.md](./brand-logo.md) |
| 左栏会话 | `Conversations` + 开聊条 | 群模板 / 成员分组下拉 → 开聊；`items` + `v-model:active` |
| 中栏消息 | `BubbleList` | **`noStyle`** 去组件外壳；`#content` 内 `.bubble-rich` 单层气泡；`#header` 发送人、`#avatar` 首字 |
| 终端消息 | `TerminalSessionCard` | 深灰玻璃终端卡；有限输出预览、运行态、进入终端与停止 |
| 终端工作区 | `TerminalWorkspace` + `TerminalView` | 中栏占满；`xterm.js` 延迟加载，保留右侧流程轨；返回对话不停止进程 |
| 中栏输入 | `XSender` | **`ref` 取文** + `@submit`；`@paste-file` 粘贴上传；`submit-type="enter"`；工具栏 `/` `@` `#` · 附件 · **复制**；Enter/闸门说明收成圆形 **i**（贴闸门按钮左侧；同意/拒绝时只留闸门详情 i），悬停/点按看全文 |
| 附件 | 自研 chip + 气泡 file-card | 先 `POST /sessions/:id/files`，再随消息 `attachments[]` |
| Composer 面板 | 自研 slash / at / hash | `/` 指令；`@` 成员/节点；`#` → `#群聊`/`#文件夹`/`#1`…/`#出n` |
| 未选会话 | 自研欢迎主视觉 | 居中：工具 Logo、一行口号（含终端守护者 / 熔炉连接一切）、一句说明、开聊按钮 |
| 运行时闸门 | 说明卡 + 操作下沉 | 卡内只留说明；**通过/取消/提交…** 在输入区工具栏右侧大按钮 |
| 右栏流程 | 自研 `flow-step` | 当前 / 执行中呼吸 / **未执行** / 完成落定 / **场外**；适配步骤节点标题上打「适配」角标（2026-08-27 收回独立筛选 Tab，角标已经够用）|
| 右栏资源 | 自研 resources pane | 进程登记、目录占用提示、再杀一次、归档对方 |
| 右栏群报告 | 自研 announce 卡片 | **# 参数** + 各节点入出；刷新 / **打开 MD**（`ANNOUNCEMENT.md`） |
| 设置 | `el-form` / `el-table` / `el-drawer` | 成员、群模板、**Grok Build 教程**（未装/未登录时弹；已登录点精灵直接开 TUI） |
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
| **场外协助** | 按时序游标插入（开场第一位）；重开=本会话追加克隆；归档可无限、再发不新开群聊；全程可见；自动滚到当前节点；「当前段」高亮；折叠状态的 meta 行标出实际 `@成员`（读 `output.assists[].invoked`/`output.lastInvoked`，不猜 `input.text` 里的 `@xxx`），不用展开就知道用了哪个工具 |
| **归档** | 群聊最后一步同意后默认归档释资源；可无限次；再发仍在本会话；续跑追加克隆 |
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

### 5.1 终端视觉与交互

1. 项目负责终端外壳、标题栏、状态、按钮和 ANSI 调色板，不重绘 TUI 自身结构。
2. 终端默认深灰背景、等宽字体；与普通聊天气泡明确分层，但圆角、阴影和强调色保持一致。
3. `TerminalWorkspace` 使用异步组件加载，普通会话不必加载 `xterm.js`。
4. 终端获得焦点后键盘直接写入 PTY；多行粘贴需要确认。
5. 终端输出通过有限 replay 字符串进入 xterm；消息卡仅显示清理 ANSI 后的末尾摘要。
6. 顶栏可切换整个工作台全屏；终端工具栏可切换 **满屏**（铺满 HTML 页面）与 **全屏**（浏览器系统全屏）。满屏层 Teleport 到 `body`，避免中栏毛玻璃（`backdrop-filter`）把 `position: fixed` 锁在卡片内。**熔炉**默认 `FurnaceWorkspace`：铺满 GUI，可切 TUI、可「缩小」回三栏。

### Composer 三快捷（已实现）

| 触发 | 作用 | 行为 |
|------|------|------|
| `/` | 斜杠指令 | 整段以 `/` 开头；Enter 执行；shell 跑脚本时 **自动**补全 `scriptWorkDir`（与会话工作文件夹无关） |
| `@` | 提及 | 插入 `@成员`（流程外协助）；面板右上角 **×** 可关闭 |
| `#` | 文本快捷 | `#` 仅唤起；选中后**只插入正文**（不含 `#`）；面板右上角 **×** 可关闭 |

键盘：↑↓ 选择 · Enter/Tab 确认 · Esc 关闭；与 `/` `@` 面板互斥。

闸门操作：**不放在说明卡底部**，与 `/` `@` `#` 同一工具栏右侧（`composer-gate-actions`，约 36px 高）。

---

## 相关

- 运行与验收：[../README.md](../README.md)  
- MVP 范围：[mvp.md](./mvp.md)  
- 技术设计（含后置 @ 上下文等）：[technical-design.md](./technical-design.md)  
