# oh-my-co-work 2.x · 内嵌 TUI 技术与产品设计

| 属性 | 内容 |
|------|------|
| 目标版本 | `2.x` |
| 状态 | **`2.3.0` 最终封板**（设置释放资源与终端守护）；结构化 Adapter 与多终端治理仍待办 |
| 更新日期 | 2026-08-13 |
| 实施计划 | [tui-2x-plan.md](./tui-2x-plan.md) |

## 1. 决策摘要

2.x 使用**真实终端作为交互底座，结构化事件用于业务融合**：

- 服务端以 PTY 运行交互式 BAT、PowerShell、CLI 和 TUI。
- 前端使用成熟终端渲染器，不自行模拟 ANSI、光标和键盘协议。
- 对话流中展示“终端会话卡”；点击后在中栏展开完整终端工作区。
- 普通日志仍可显示为消息；完整 TUI 不转换成普通聊天气泡。
- 子工具如需与工作流深度融合，应提供结构化适配器，不能依靠解析终端画面猜测语义。

首选技术：

| 层 | 方案 |
|----|------|
| PTY | `node-pty`；Windows 使用 ConPTY，Linux/macOS 使用 pseudo-terminal |
| 前端终端 | `xterm.js`，配合 Fit、Web Links 等按需插件 |
| 实时通信 | 基于现有 WebSocket 扩展终端协议；终端数据与普通会话事件逻辑隔离 |
| 进程治理 | 复用并增强 `processRegistry`，终端、会话、节点和 PID 一一关联 |
| 持久化 | SQLite 保存终端元数据；原始输出追加写入 `data/logs/` |

## 2. 产品目标

### 2.1 要解决的问题

当前很多工具通过 BAT 或 PowerShell 打开独立控制台：

- 用户需要在项目和系统终端之间切换。
- 主项目只能在进程结束后拿到汇总输出，无法呈现实时交互。
- TUI 中的提问、进度和错误与群聊、节点、闸门彼此割裂。
- 独立窗口的 PID、关闭时机和归档回收较难统一管理。

2.x 需要让终端成为工作流的一等执行载体，同时保留原生 TUI 能力。

### 2.2 成功标准

- 常见 BAT、PowerShell 和交互式 CLI 可以在工作台内运行。
- ANSI 色彩、光标定位、全屏重绘、窗口缩放和常用键盘操作正确。
- 用户能从对话定位终端，并可在预览、展开、收起之间切换。
- 终端退出后，流程节点获得退出码、摘要和日志引用。
- 归档、停止、切换执行体及服务退出时可可靠回收进程树。
- 未适配的工具至少能以真实终端运行；已适配工具可将消息、提问和结果融合进工作流。

### 2.3 非目标

- 不自行实现终端模拟器。
- 不把任意终端字符流强行解析为可靠的聊天消息。
- 不在 2.0 首版支持浏览器任意打开系统 Shell。
- 不保证所有会主动 `Start-Process` 打开新窗口的旧脚本无需修改即可内嵌。
- 不在第一阶段实现多人同时控制同一个终端。

## 3. 交互设计

### 3.1 对话中的终端会话卡

终端启动时，在对话时序中插入特殊消息卡：

```text
┌ 工具 · Claude CLI                  运行中 ● ┐
│ > 正在分析项目…                              │
│   23 files scanned                           │
│                                              │
│ [进入终端] [停止] [更多]                     │
└──────────────────────────────────────────────┘
```

卡片职责：

- 显示工具名、所属成员、状态、运行时长和退出码。
- 默认只读预览最近 40 行、高度 `clamp(260px, 46vh, 620px)`，限制刷新频率避免拖慢消息列表。
  预览是用户判断「要不要进终端」的主要依据，太小会逼着用户每次都进全屏，故按实测体感放大；
  尚无输出时预览收成一行提示，不占版面。
- 提供“进入终端”“停止”“查看日志”等操作。
- 运行结束后保留同一张卡片（状态、退出码、时长就地更新），预览内容不清空，便于回看结果。
- 卡片记录在聊天时序中，但原始大输出不写进普通消息正文。

### 3.2 完整终端工作区

点击“进入终端”后，将**中间对话区切换为终端工作区**：

- 顶部：返回对话、工具名、成员、cwd、连接状态、运行时长。
- 主体：完整 `xterm.js` 终端。
- 底部或标题栏：停止、重连、清屏、复制、下载日志。
- 支持中栏占满；后续可增加全屏，不以右侧窄栏作为主要交互区域。
- 返回聊天不会结束进程，终端卡继续显示状态。

右侧流程轨保持可见，以便用户知道当前终端属于哪个节点。

### 3.3 视觉基线

可以统一项目视觉，但不破坏终端语义：

- 外壳使用项目现有圆角、阴影、状态标签和按钮。
- 内容区默认深灰而非纯黑，使用等宽字体。
- 支持“项目深色”“终端原色”“高对比度”主题。
- 可配置字体、字号、行高、光标、选区、ANSI 调色板和内边距。
- 不把 TUI 自绘菜单重排成 Element Plus 组件。
- 只读预览与可交互终端必须有明显焦点和状态区别。

### 3.4 输入与焦点

- 用户进入终端后才发送键盘事件，普通聊天输入框不得截获。
- 标题栏明确显示“终端输入中”，按 `Esc` 可退出终端焦点。
- 多行粘贴默认二次确认，可在设置中按可信工具放行。
- `Ctrl+C`、方向键、Tab、功能键等传给 PTY。
- 浏览器保留快捷键与终端快捷键冲突时，采用明确白名单。

## 4. 系统架构

```text
Workbench.vue
  ├─ 普通消息 / 闸门 / 流程
  ├─ TerminalSessionCard
  └─ TerminalWorkspace
          │ WebSocket terminal.*
          ▼
TerminalSessionService
  ├─ PTY 生命周期
  ├─ 输入 / 输出 / resize
  ├─ 日志与快照
  ├─ Adapter 结构化事件
  └─ processRegistry
          │
          ▼
BAT / PowerShell / CLI / TUI
```

### 4.1 服务端模块建议

新增：

```text
server/src/terminal/
├── terminalService.js       # 创建、查询、输入、resize、停止、回收
├── terminalProtocol.js      # WebSocket 消息校验与序列化
├── terminalLog.js           # 限流、追加日志、大小上限
├── terminalSecurity.js      # 命令、cwd、环境变量和权限校验
└── adapters/
    ├── base.js
    └── jsonl.js             # 通用结构化事件适配器
```

现有模块调整：

- `runners.js`：增加 `executionMode: "pipe" | "terminal" | "detached"`；终端模式不再走普通 stdout 缓冲。
- `processRegistry.js`：登记 PTY shell PID、真实子进程和 terminalId，统一结束进程树。
- `index.js`：扩展 WebSocket 路由和连接鉴权。
- `engine.js`：节点可进入“终端运行中/等待终端输入”，退出后按结果推进。
- `routes.js`：提供终端元数据、日志下载和恢复查询 API。

### 4.2 前端模块建议

```text
web/src/components/terminal/
├── TerminalSessionCard.vue
├── TerminalWorkspace.vue
├── TerminalView.vue
├── TerminalToolbar.vue
└── useTerminalSession.js
```

`Workbench.vue` 只负责编排显示模式，不直接承载全部终端协议。

### 4.3 运行模式

| 模式 | 用途 | 行为 |
|------|------|------|
| `pipe` | 非交互脚本 | 沿用当前 stdout/stderr 捕获和摘要 |
| `terminal` | TUI、REPL、交互 CLI | PTY + 实时终端卡 + 工作区 |
| `detached` | 必须打开系统窗口的旧工具 | 保留当前兼容能力，并提示不在项目内交互 |

成员脚本配置建议增加：

```json
{
  "executionMode": "terminal",
  "terminal": {
    "shell": "powershell",
    "cols": 100,
    "rows": 30,
    "adapter": "jsonl",
    "allowPaste": "confirm"
  }
}
```

## 5. 实时协议

终端字节流与结构化事件分开。

### 5.1 客户端到服务端

```json
{"type":"terminal.attach","terminalId":"term_123"}
{"type":"terminal.input","terminalId":"term_123","data":"ls\r"}
{"type":"terminal.resize","terminalId":"term_123","cols":120,"rows":36}
{"type":"terminal.kill","terminalId":"term_123","reason":"user"}
```

### 5.2 服务端到客户端

```json
{"type":"terminal.opened","terminalId":"term_123","status":"running"}
{"type":"terminal.output","terminalId":"term_123","seq":42,"data":"..."}
{"type":"terminal.exited","terminalId":"term_123","exitCode":0,"signal":null}
{"type":"terminal.error","terminalId":"term_123","code":"PTY_START_FAILED","message":"..."}
```

要求：

- 每段输出带递增 `seq`，重连时可发现缺口。
- 输出使用 UTF-8 字符串或明确编码的二进制帧，不能隐式猜编码。
- 高频输出批量发送，避免每个字符触发一次 Vue 更新。
- 服务端实施背压和日志上限；慢客户端不能阻塞子进程。
- `terminal.input`、`resize`、`kill` 必须校验 terminalId 与当前会话绑定。

## 6. 结构化适配器

真实 PTY 只能说明“屏幕发生了什么”，不能稳定说明“子工具表达了什么”。深度融合采用第二条结构化事件通道。

### 6.1 能力等级

| 等级 | 能力 |
|------|------|
| L0 通用终端 | 任意工具可显示、输入、停止、记录退出码 |
| L1 可观测 | 适配器提取错误、文件、阶段和结果摘要 |
| L2 对话融合 | 提取 user/assistant 消息、工具调用、提问和结果 |
| L3 工作流协同 | 主项目可审批、注入上下文、暂停、恢复和转交成员 |

### 6.2 通用 JSONL 事件

```json
{"type":"message","role":"assistant","text":"准备修改配置"}
{"type":"tool.start","id":"tool_1","name":"edit_file","path":"package.json"}
{"type":"tool.end","id":"tool_1","ok":true}
{"type":"question","id":"q1","text":"是否继续部署？","choices":["继续","取消"]}
{"type":"result","summary":"修改完成","files":["package.json"]}
```

事件可以来自：

- 子工具原生 API/SDK。
- 专用文件描述符或命名管道。
- 本地 WebSocket。
- 独立 JSONL 日志文件。
- 针对特定 CLI 的适配器。

不应把普通终端 stdout 中所有类似 JSON 的文本自动当作可信控制事件。

## 7. 数据模型

建议新增 `terminal_sessions`：

| 字段 | 含义 |
|------|------|
| `id` | terminalId |
| `session_id` | 所属会话 |
| `node_instance_id` | 所属流程节点 |
| `member_id` | 所属成员 |
| `run_id` | runner 执行标识 |
| `status` | starting/running/exited/failed/killed/interrupted |
| `execution_mode` | terminal |
| `cwd` | 工作目录 |
| `command_label` | 脱敏后的命令说明 |
| `pid` | PTY shell PID |
| `cols/rows` | 最近终端尺寸 |
| `log_path` | 原始日志路径 |
| `exit_code/signal` | 退出结果 |
| `started_at/finished_at` | 生命周期时间 |

原则：

- SQLite 保存可查询元数据，不保存无限增长的完整终端流。
- 原始日志追加写文件，设置单文件大小和滚动策略。
- 普通聊天只保存卡片引用、状态摘要和必要的结构化消息。
- 敏感环境变量、Token 和完整命令参数默认不落库。

## 8. 生命周期与恢复

### 8.1 状态机

```text
starting → running → exited
                   ↘ failed
                   ↘ killed
                   ↘ interrupted
```

- 页面刷新：重新 attach，先获取有限回放，再接实时输出。
- WebSocket 断开：PTY 默认继续运行，前端标记“连接中断”。
- 服务进程重启：首版将遗留终端标记为 `interrupted`，不承诺重新接管已有 PTY。
- 会话归档：结束其所有非保留终端及进程树。
- 从节点继续：按现有成员进程策略关闭被替代的终端。
- 终端正常退出：写结果、更新卡片，并由引擎决定是否推进节点。

### 8.2 输出回放

- 内存维护每终端有限环形缓冲，例如最近 256 KB。
- 磁盘保留完整受限日志。
- attach 时先发快照或缓冲，再发实时序列。
- 不把完整历史逐次重放给 xterm，以免大日志导致页面卡顿。

## 9. 安全边界

- 启动时生成随机本地访问令牌；前端通过同源 bootstrap 获取，REST 与 WebSocket 均强制验证。
- 浏览器 Origin 仅允许 `127.0.0.1`、`localhost` 和 `::1`，拒绝外部网页跨站调用本机服务。
- 浏览器不能提交任意可执行文件和任意 Shell 命令。
- 仅允许运行成员配置或管理员批准的执行体。
- cwd 必须解析为绝对路径并通过允许目录校验。
- 环境变量采用白名单注入；敏感值不通过终端元数据返回。
- WebSocket 仅绑定 `127.0.0.1` 的现有本地服务边界仍需保留会话校验。
- 多行粘贴默认确认，超大输入拒绝。
- 对输入、resize 和输出帧设置大小及频率限制。
- Adapter 控制事件必须来自可信侧通道并校验 schema。
- 停止操作结束整个进程树，不只杀 PTY 外层进程。
- 日志支持脱敏、大小上限、清理和手工删除。

## 10. 平台兼容

### Windows

- 优先 ConPTY；明确最低受支持 Windows 版本。
- BAT 在 PTY 中通过 `cmd.exe /d /s /c` 或配置的 PowerShell 启动。
- PowerShell 编码、代码页和 Unicode 输入需单独回归。
- 调用 `Start-Process`、`start` 或强制新窗口的脚本仍可能脱离 PTY，需改为前台运行。

### Linux/macOS

- 使用系统 PTY，默认 Shell 必须显式决定，不能依赖部署用户的未知配置。
- 处理 `TERM`、locale、信号和进程组。

### 打包

- `node-pty` 含原生模块，三平台运行包必须分别构建和验证。
- CI 不应跨平台复用原生二进制。
- Node ABI 不匹配时需要与当前 `better-sqlite3` 类似的兼容/重建策略。

## 11. 设置项

建议增加“终端”设置页：

- 默认主题、字体、字号、行高和光标样式。
- 默认终端尺寸与回放行数。
- 多行粘贴策略。
- 终端退出后自动收起开关。
- 日志保留天数和单文件上限。
- 默认 Shell（按平台）。
- 可信执行体列表。

工具自身配置可覆盖外观以外的运行参数，但不能降低全局安全策略。

## 12. 验收场景

1. 普通命令仍按原有 pipe 模式运行。
2. BAT/PowerShell TUI 在项目内正确显示颜色、菜单和进度刷新。
3. 用户可输入方向键、Tab、Enter、Ctrl+C，并可安全粘贴。
4. 调整中栏尺寸后 TUI 收到正确 cols/rows。
5. 返回聊天后进程继续，卡片状态实时变化；再次进入可恢复显示。
6. 终端结束后显示退出码、耗时、摘要和日志入口。
7. 页面刷新后可重新附着到仍在运行的终端。
8. 断开 WebSocket 不阻塞或杀死工具。
9. 归档和停止能清理 Windows/Linux/macOS 进程树。
10. 大量输出不会撑爆内存或拖死消息列表。
11. 未授权命令、非法 cwd、伪造 terminalId 和超大输入被拒绝。
12. JSONL adapter 可将提问转成闸门，将结果写入节点输出。

## 13. 开放问题

实施前仍需通过原型验证：

- 首版终端工作区是否需要全屏，还是中栏占满已足够。
- 同一会话是否允许多个后台终端，前台可交互终端建议先限制为一个。
- 服务重启后的 PTY 是否需要真正恢复，还是标记中断后重跑。
- 首批提供原生适配器的工具名单。
- Windows 支持范围及 ConPTY 在目标机器上的实际表现。
- 终端日志默认保留策略和脱敏规则。

