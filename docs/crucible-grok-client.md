# 熔炉里的「Grok 客户端」是怎么实现的

| 属性 | 内容 |
|------|------|
| 状态 | **当前实现说明**（对照代码，不是愿景） |
| 日期 | 2026-08-20 |
| 版本 | `3.5.x` |
| 相关 | [crucible-3x.md](./crucible-3x.md) · [crucible-3.3.md](./crucible-3.3.md) · [crucible-3.5.md](./crucible-3.5.md) · [tui-2x.md](./tui-2x.md) |

一句话：**oh-my-co-work 没有自研一套 Grok HTTP / Chat API 客户端。**  
熔炉把本机官方 **Grok Build CLI**（命令一般是 `grok`）当成普通交互脚本，塞进已经存在的 **node-pty 内嵌终端**。画面皮只是同一条 PTY 的去颜色视图。和 xAI 通话、登录、选模型，全是 `grok` 自己的事。

---

## 1. 不是什么

| 容易误会 | 实际 |
|----------|------|
| 工作台直连 `api.x.ai` / 自写 SSE 聊天 | **没有**。仓库里没有 xAI SDK、没有把秘钥当请求头发给云端的熔炉通道 |
| 解析 Grok TUI 画面当 Adapter | **明确不做**。Adapter 仍是 JSONL 侧通道，3.x 不改门 |
| 「画面」是多轮聊天气泡 | **不是**。去 ANSI 后的 **PTY 回放尾部**，和终端是同一份字符流 |
| 第二套会话库 / 第二套成员类型 | **没有**。熔炉成员内部 key 仍是 `unified_admin`，配好后 `kind=script` |

Grok 进程用的凭证在本机 `~/.grok/`（可用 `GROK_HOME` 改）。工作台只 **探测文件是否存在**，不替你登录、不代发 token。

---

## 2. 原理（数据怎么走）

```text
桌宠 / ?furnace=1
        │
        ▼
GET /api/grok/status          不 spawn grok（避免弹浏览器）
        │
        ├─ 未装或未登录 ──► Grok Build 教程弹层
        │
        └─ canRun ──► 熔炉成员 script.command = grok
                      cwd = data/furnace
                      executionMode = terminal
                      waitForExit = false（常驻）
        │
        ▼
引擎按脚本成员开跑 ──► terminalService
        │
        ▼
node-pty spawn(grok, [], { cwd, TERM: xterm-256color })
        │
        ├─ PTY 输出 ──► WebSocket terminal.data ──► 前端
        │                 ├─ 「终端」皮：xterm.js 原样画
        │                 └─ 「画面」皮：stripAnsiTail(replay) + 底部输入
        │
        └─ 画面里 Enter ──► emit input ──► pty.write("…\r")
                              仍是同一进程，不是另开 HTTP 对话
```

Grok CLI 出了 PTY 之后，自己去读 `~/.grok/auth.json`、`config.toml` 或环境变量 `XAI_API_KEY`，再跟 xAI 通信。工作台看不到也管不了那一层协议。

---

## 3. 各层做什么

### 3.1 探测：本机有没有客户端

`server/src/grokStatus.js` · `GET /api/grok/status`

**不启动** `grok`（官方 CLI 第一次跑可能弹浏览器登录）。

| 缺口 | 怎么判 |
|------|--------|
| 未安装 | `which`/`where` 找不到设置里的命令，且没有 `~/.grok/bin/grok` |
| 未登录 | 没有非空 `auth.json`，没有 `XAI_API_KEY`，配置里也没有真实 `api_key` |
| 未配置 | `config.toml` 没有 `[models]` + 非占位秘钥（占位词：`秘钥` / `changeme` 等） |

字段：`canRun` = 已装且已登录（够开熔炉）；`ready` = 再加上第三方配置写满。  
未装或未登录才弹教程；`canRun` 时点桌宠直接开干活面。

入口：`web/src/App.vue`、`GrokSetupGuide.vue`、设置 → Grok Build 教程。

### 3.2 把 CLI 接到「熔炉成员」

`server/src/slashCommands.js` 的 `furnaceGrokScript` + `ensureAdminMember`。

设置项（`server/config/app-settings.json` → `grok`）：

| 字段 | 作用 |
|------|------|
| `command` | 默认 `grok`，可改成绝对路径 |
| `configured` | 开：成员变成脚本并执行该命令；关：只留 echo 聊天回声 |
| `surface` | 开熔炉默认 `chat`（画面皮）或 `tui` |

勾上 `configured` 之后，熔炉成员配置等价于：

```json
{
  "kind": "script",
  "script": {
    "mode": "command",
    "command": "grok",
    "scriptWorkDir": "<DATA_ROOT>/furnace",
    "executionMode": "terminal",
    "detach": true,
    "waitForExit": false
  }
}
```

也就是 **2.x 终端守护者** 那条路：不是 pipe 跑完就杀，是常驻 PTY。

点桌宠且本机 `canRun` 时，`App.vue` 会把 `configured` 写成 true，避免「能跑却还是 echo」。

### 3.3 进程：真实 PTY

`server/src/terminal/terminalService.js`：`pty.spawn`，Windows 用 ConPTY。  
输出进 replay / 日志，经 WebSocket 推到工作台。  
停止、归档、配额、脱敏与其它内嵌终端 **同一套治理**。

工作目录固定在 `data/furnace`（`ensureFurnaceWorkspace()`），这样 Grok 的「当前项目」就是熔炉本机上下文，而不是随便一个业务仓库根。

### 3.4 两张皮，一条进程

`web/src/components/terminal/FurnaceWorkspace.vue`

| 皮 | 实现 |
|----|------|
| **终端** | 现成 `TerminalView` + xterm.js，完整 TUI（菜单、快捷键） |
| **画面** | `stripAnsi` / `stripAnsiTail`（`shared/index.js`）只渲染回放尾部；底部 textarea 把文本 `pty.write` 进同一进程 |

判断要不要用熔炉皮：`Workbench.vue` 的 `isFurnaceTuiContext`（熔炉成员、或命令行里像 `grok`）。普通脚本仍走 `TerminalWorkspace`。

铺满页面是 CSS/`Teleport`，不是再 spawn 一次 grok。

### 3.5 上下文：写文件，不调 Chat Completions

`server/src/furnaceContext.js` + `furnaceSituation.js`

开聊 / 适配 / 审核时，引擎只装 **一套** 角色壳，拼上节点地图，写成：

- `data/furnace/ACTIVE.md` — 本轮 prompt + 记忆 + 情境  
- `data/furnace/SITUATION.md` — 情境副本  
- `data/furnace/memory/*.md` — 本机记忆（种子只复制一次）

系统气泡只报「熔炉本轮：xxx」，**不把全文灌进群聊**。

这是给 **坐在该 cwd 里的 Grok CLI** 读的 Markdown，不是工作台用秘钥去调模型。Grok Build 自己认哪些项目文件（例如它习惯的 `AGENTS.md`）由官方 CLI 决定；当前实现 **保证写的是 `ACTIVE.md`**，没有再包一层「代 Grok 调 API」。

---

## 4. 画面和终端是不是 Tab？能不能传文件？

**不是浏览器 Tab，也不是两套客户端。** 熔炉顶栏两个按钮「画面 / 终端」，切的是**同一条 `grok` PTY 的两张皮**（`FurnaceWorkspace` 里的 `surface`）。进程、cwd、replay 都一份。切走再切回来，Grok 还在原来的会话里。

### 用户怎么选？两张皮共存吗？

**进程上共存，屏幕上不同时铺开。** 同一时刻只显示一张皮；另一张随时可点回来，不必重开 grok。

怎么选：

| 时机 | 在哪选 | 作用范围 |
|------|--------|----------|
| 下次点桌宠默认进哪张皮 | 设置 → Grok Build → **开熔炉默认**：「铺满对话」或「铺满终端」 | 写入 `grok.surface`，下次开熔炉用 |
| 这一轮已经开着 | 干活面顶栏 **画面 / 终端** | 只改当前这次显示，**不写回**设置 |

默认出厂是「铺满对话」（画面皮）。菜单、快捷键、传文件之类仍要切到终端皮。缩小到三栏时，中栏显示的也是当前这张皮，不是突然变成两套窗口。

| | 画面皮 | 终端皮（TUI） |
|--|--------|----------------|
| 交互 | 顶栏按钮，不是多标签页 | 同上 |
| 输入 | 底部文本框 → `pty.write` | xterm 键盘 / 粘贴（可确认） |
| 菜单、快捷键、Grok 自己的文件/图片能力 | **没有包一层** | 有的话走 **Grok TUI 自己的操作**（我们只是把键鼠送到 PTY） |

**画面皮不能上传文件。** 没有附件按钮、没有 `POST /sessions/:id/files`。那套附件属于**群聊气泡**（工作台消息），不会进 grok 进程。

要把文件给 Grok 看，目前只能：

1. 切到 **终端**，用 Grok CLI 自己的方式（若它支持拖路径、粘贴图、`@file` 等）；或  
2. 把文件放到 `data/furnace`（它的 cwd），在 TUI 里让它读路径。

工作台群聊里的粘贴上传、附件芯片，和熔炉 Grok **不是同一条通道**。

---

## 5. 和群聊账本怎么接

```text
群聊 Session（SQLite）     熔炉 Grok（PTY）
  成员 / 节点 / 闸门    ←→   只是其中一个 script 成员
  终端卡、进程登记      ←→   同一条 terminal 记录
  适配 / 审核 prompt    →    文件落到 cwd
  JSONL Adapter         →    仍给「会写侧通道的工具」；不解析 grok 屏幕
```

关掉熔炉（`grok.configured=false` 或不当熔炉成员跑），其它脚本、闸门、内嵌 TUI 仍按 2.x 工作。这是 3.x 的跑偏判定。

---

## 6. 关键代码

| 文件 | 职责 |
|------|------|
| `server/src/grokStatus.js` | 安装 / 登录 / 配置探测 |
| `server/src/slashCommands.js` | 熔炉成员接到 `grok` 命令 |
| `server/src/appSettings.js` | `grok.command` / `configured` / `surface` |
| `server/src/terminal/terminalService.js` | PTY 生命周期 |
| `server/src/furnaceContext.js` | `ACTIVE.md` 角色壳 |
| `web/src/App.vue` | 桌宠、教程弹层、开熔炉 |
| `web/src/components/terminal/FurnaceWorkspace.vue` | 画面皮 / 终端皮 |
| `web/src/views/Workbench.vue` | 熔炉终端用熔炉皮，其它用普通终端工作区 |
| `shared/index.js` | `grokCanRun`、`stripAnsiTail`、`FURNACE_*` |

---

## 7. 当前边界（写进文档以免下次再问）

- **没有** 工作台侧的模型列表、流式 token、tool calling。那些若存在，在 `grok` TUI 里。  
- **没有** 把群聊每条气泡自动 `write` 进 grok；要说话：画面皮输入框，或切「终端」用 Grok 自己的键位。  
- **画面皮没有传文件**；群聊附件进 SQLite，不进 grok。文件相关能力（若有）只在 TUI 里交给官方 CLI。  
- 3.4 若另有「往项目里写 `AGENTS.md`」类注入，以合入 `main` 的代码为准；**本文描述的是 PTY 宿主模型**，不依赖那一层。  
- 独立托盘窗 / 真·Grok 桌面客户端：后置 4.x，不是现在这条路径。
