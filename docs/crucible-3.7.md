# oh-my-co-work 3.7 · 熔炉 3.x 最终封板

| 属性 | 内容 |
|------|------|
| 目标版本 | `3.7.0` |
| 状态 | **3.x 最终封板** |
| 日期 | 2026-08-20 |
| 前置 | 3.3 教程 · 3.5 铺满 GUI/TUI |
| 相关 | [crucible-3x.md](./crucible-3x.md) · [crucible-3.5.md](./crucible-3.5.md) · [crucible-grok-client.md](./crucible-grok-client.md) |

`3.6` 未单独发版。3.5 之后的桌宠 GIF、干活面头像、GUI 附件与 Grok 原理说明，一并收进 **3.7.0**。托盘独立窗仍后置 4.x。

## 1. 相对 3.5 多了什么

| 项 | 口径 |
|----|------|
| 桌宠 | 三态两帧慢循环 **GIF**（多停少动）+ 戳一下；减少动效时回退 PNG |
| 干活面头像 | 只留 GUI 大头；开干活面时不重复桌宠 |
| 两张皮叫法 | 用户侧 **GUI / TUI**（存盘仍是 `grok.surface`：`chat` \| `tui`） |
| GUI 附件 | 文件落到 `data/furnace/inbox/<会话>/`；发送写成一行相对路径再回车。**不是** Grok 原生传文件 |
| TUI | 首次进入再挂 xterm，之后切皮不拆终端 |
| 原理 | 本机官方 `grok` CLI + node-pty；**没有**自研 xAI HTTP / Chat 客户端 |

## 2. 验收

- README 能按现状讲清：点桌宠 → 教程或铺满干活面 → GUI/TUI → 缩小回三栏。
- GUI 附件路径单行写入同一 PTY；接口不回本机绝对路径。
- 归档 / 删会话清理该会话 inbox。
- 关掉熔炉后，普通脚本成员仍走原来的终端工作区。

## 3. 不做（3.x 也不做）

- 自研 Grok Chat API 客户端
- 独立托盘窗 / 第二套 SQLite
- 解析 TUI 画面当 Adapter
