# 熔炉 GUI 可读正文（方案）

| 属性 | 内容 |
|------|------|
| 状态 | **已落地** |
| 日期 | 2026-08-20 |
| 版本 | `3.7.x` |
| 相关 | [crucible-3.5.md](./crucible-3.5.md) · [crucible-grok-client.md](./crucible-grok-client.md) · [crucible-3.7.md](./crucible-3.7.md) |

GUI 必须**能读、能发**。它不是缩小版 TUI，也不再把 Grok 的框线、底栏、状态条摊在聊天区里。

---

## 1. 现在为什么还乱

上一轮已把 PTY **画成屏幕再取字**（`renderPtyPlainText`），不再把录像去色硬拼。用户仍看到：

- 断开的 `─` `│` `- | -` 小框
- 「DeepSeek V4 Pro / Logged in / Enter:send」整块底栏漂在正文里
- 单个 `6`、`:2 P` 之类碎片
- `Waiting for response` 和回答叠在一起

根因有三条，**只修屏幕仿真不够**：

| # | 原因 | 表现 |
|---|------|------|
| 1 | Grok CLI 是 **全屏 TUI**：顶栏、侧栏、底栏快捷键、thinking 条都是画面的一部分 | 屏幕导出 = 连壳一起导出 |
| 2 | GUI 的 `<pre>` 用了 `pre-wrap` + `word-break` | 按 CSS 宽度折行，120 列的框线从中间断开，竖线掉到字中间 |
| 3 | 状态行用 `\r` 刷新，仿真后仍可能留一行残字 | 短碎片、半截秒数 |

TUI 皮（xterm）已经能画对。GUI 若继续「整屏抄过来」，用户会以为产品坏了。

---

## 2. 已决口径

**GUI = 对话框（可上翻的历史气泡）+ 底部输入。**  
菜单、快捷键、模型条、登录态 **只在 TUI**。TUI 同样保留滚动历史（吞备用屏，清屏前把当前画面推进 scrollback）。

| 层 | 做什么 |
|----|--------|
| 1. 屏幕 | 继续 `renderPtyPlainText`（光标、擦行、中文宽度） |
| 2. 去壳 | 去掉框线字符、纯装饰行、Grok 底栏/状态条惯用句 |
| 3. 历史 | 清屏 / 进备用屏之前把可读帧并进累积正文，不再只留当前一屏 |
| 4. 排版 | 用户右气泡、Grok 左气泡；普通换行，不按终端列宽画表格 |

不做：

- 不在 GUI 里复刻 Grok 的盒子 UI
- 不解析 TUI 当 Adapter
- 不另开 Chat API

用户要调模型、看快捷键：点 **TUI**。

---

## 3. 去壳规则（实现按此表）

对屏幕文本逐行：

1. 删 Unicode 框线（U+2500–257F 等）和连续 `---+` 装饰。
2. 删「去掉框线后为空」的行。
3. 删匹配 TUI 壳的行（大小写不敏感）：
   - `Enter:send` / `Alt+Enter` / `Shift+Tab` / `Ctrl+x` 快捷键条
   - `Logged in with` / `always-approve` / `Grok Build Beta`
   - 单独的 `Waiting for response` / `Thinking...` 状态条
   - 模型条形态：`· always-approve`、`API key | Beta`
4. 删去掉壳后长度 ≤ 2 且不含中文的碎片（避免误删「好」「ok」里的中文；`ok` 三字符保留）。
5. 连续空行压成一行。

正文（Grok 真正打出来的回答）原样保留。

---

## 4. 排版

- 对话气泡：用户右对齐蓝泡，Grok 左对齐白泡；空态仍为欢迎卡。
- 消息区 `overflow-y: scroll` 且滚动条常显，避免历史被裁成一屏却看不出能滚。

---

## 5. 验收

- 发两轮「你好」之后，GUI **两轮都在**，能上翻，不是只剩当前屏一块 `<pre>`。
- **不应**再出现底栏 `Enter:send` 整行、断开的 ASCII 盒子。
- 切 TUI，原 Grok 菜单和快捷键仍在；右侧滚动条可上翻更早画面。
- 附件路径仍是一行写入同一进程。

---

## 6. 代码落点

| 文件 | 职责 |
|------|------|
| `shared/ptyPlain.js` | `furnaceGuiTranscript` 累积清屏前可读帧；`takeFurnaceAssistantDelta` / `buildFurnaceChatTurns` |
| `FurnaceWorkspace.vue` | GUI 对话框气泡 + 常显滚动条 |
| `TerminalView.vue` | 熔炉 `preserveHistory`：备用屏不进 alt buffer，清屏前推入 scrollback |
| `server/test/ptyPlain.test.js` | 去壳、跨屏历史、对话轮次 |
