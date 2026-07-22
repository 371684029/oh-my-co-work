# apple-co-work

<p align="left">
  <img src="./docs/assets/logo-mark.jpg" alt="apple-co-work logo" width="88" height="88" />
</p>

## 项目核心（宗旨）

> **人机协同 · 万物归元 · 皆可 Workflow**  
> **节点是死的，人是活的** — 流动的 Workflow，人可随时绕行、插队、场外办事再回来。  
> 只做 MVP，不做花里胡哨。

| 主张 | 内涵 |
|------|------|
| **人机协同** | 人做决策与闸门，机做执行与回传；同台可见、可打断、可接力 |
| **万物归元** | 一个脚本、一个 Agent，都是**元节点**；Agent 与工作室**解耦**，渐进接入 |
| **皆可 Workflow** | Workflow 串起节点与人；**节点是锚点，人是活水**——可中途场外办事（如点外卖），再流回主线 |
| **简洁桥梁** | **聊天框 + 流程图**——最克制的信息界面，拒绝堆砌 |

**一句话**：人机交互的聚合可视化平台——用流动的工作流把人、脚本与 Agent 编在同一张台上。

Logo 与品牌细节见 [docs/brand-logo.md](./docs/brand-logo.md)。

| 项 | 内容 |
|----|------|
| 版本 | `1.2.0`（见 [mvp.md §2.13](./docs/mvp.md)；关于页 changelog） |
| 形态 | 三栏工作台 + 设置 · **完全本机** |
| UI | **优先 [Element-Plus-X](https://v2.element-plus-x.com)** + Element Plus 默认主题 |
| 仓库名 | `apple-co-work`（原 `element-co-work`） |

---

## 目录

- [项目核心（宗旨）](#项目核心宗旨)
- [功能现状](#功能现状)
- [快速开始](#快速开始)
- [怎么看演示效果](#怎么看演示效果)
- [使用说明](#使用说明)
- [项目结构](#项目结构)
- [API 摘要](#api-摘要)
- [配置与数据](#配置与数据)
- [文档索引](#文档索引)
- [路线图](#路线图)
- [支持与交流](#支持与交流)

---

## 产品原则（由核心推导）

| 原则 | 含义 |
|------|------|
| 闸门在人 | 关键步骤同意 / 拒绝 / 输入，不能 silently 滑过 |
| 元节点可插拔 | 成员（脚本 / Agent）与群模板解耦；配置**克隆**不改写 |
| 会话有边界 | **归档只释资源**；同一会话可无限归档/解档；再发仍在本会话；只有左栏「开聊」才新建会话 |
| 本机优先 | 无夹带后台；数据与进程都在本地 |

**Session** = 一局任务运行实例（可改名、删除、归档），不是群模板本身。

---

## 功能现状

### 已实现（MVP）

| 模块 | 说明 |
|------|------|
| 工作台三栏 | 左会话 · 中对话/闸门 · 右流程；**浮层圆角分栏** + 氛围光（Codex 气质） |
| 会话 UI | **Element-Plus-X**：`Conversations` / `BubbleList` / `XSender` / `Welcome` |
| 发送 | **Enter 发送** · Shift+Enter 换行（XSender ref 取文） |
| 等人强调 | 运行时闸门/等人 **标红**；设置里人工步骤保持中性 |
| 成员 | 新建 / **编辑** / **克隆** / 删除；`echo` / `script`（多语言脚本或命令） |
| 群模板 | 新建 / **编辑** / **克隆** / 删除；线性步骤 + 闸门 |
| 开聊 | 左栏选**群模板或成员** → 开聊；成员单聊走临时模板 |
| 会话名 | 默认 `#1 · 模板缩写`；hover 看群模板全称；可手改 |
| 快捷指令 | 新建 / **编辑** / **克隆** / 删除；`/` 唤起 |
| 工作文件夹 | 成员 / 群可选；script 执行 cwd 回落链 |
| 任务引擎 | 线性推进、人工输入节点、闸门、script 子进程 |
| 归档 | 只释放进程与目录；**同一会话可无限归档**；再发/解档仍在本会话，**不会新开群聊** |
| 场外协助 | `@` 成员插队：按**当前时序**插入（开场则第一位）；回主线点右侧正常节点「克隆并从此开始」；同会话 `@` 串行排队 |
| 续跑 | 本会话右侧「克隆并从此开始」→ **线性追加克隆节点**（场外节点不可作重开目标） |
| 本机资源 | 右侧 Tab「资源」：进程 PID / orphanRisk / 目录占用提示；再杀一次与归档对方 |
| 新会话 | **仅**左栏选模板/成员 →「开聊」 |
| 聊天 | **名称可编辑**、**可删除** |
| 支持与交流 | 侧栏浅灰「其它」分区；含蓄 **点赞支持** 文案 |
| 关于与更新 | 版本号、版本日志、更新地址；**完全本地、无后台夹带** 说明 |
| 设置 | 演示示例开关；**是否展示脚本弹窗**（全局）；归档超时；全局管理员；一键删演示数据 |
| 脚本弹窗 | 全局默认开；**成员 / 快捷指令可覆盖**（跟随/是/否）；执行**以脚本配置为准** |
| 群报告 | 右侧 Tab：**# 参数** + **各节点输入/输出**；刷新写 MD；流程轨仍可展开明细 |
| 会话附件 | 选择或 **Ctrl+V 粘贴** 上传；气泡内附件卡片；本机 `data/uploads` |
| 快捷指令 | 输入 `/` 唤起；设置里自配 N 条；本机 shell/url/agent；shell 可配是否弹窗 |
| 文本快捷 `#` | `#群聊` / `#文件夹` / `#1`…（输入空格换行分段）/ `#出n`（输出整段）；工具栏 `#` |
| 闸门操作 | 说明在卡片；**通过/取消/提交…** 在输入区右侧 |
| 数据 | SQLite + journals MD + 自动 seed「演示流」 |

### 未做 / 后置（见设计文档）

GUI 桌面壳 · 重启任务 · 掩码 · 完整进程守护 MD · 打开编辑器按钮 · LLM 推断工作目录 · 终检越界卡片 · 断点续跑 · 云端多用户  

完整清单：[docs/mvp.md](./docs/mvp.md) · [docs/data-and-ops.md](./docs/data-and-ops.md)

---

## 快速开始

### 环境

- **Node.js ≥ 18**
- Windows / macOS / Linux（script 默认按 Windows 演示 seed）

### 安装与启动

```bash
cd apple-co-work
npm install

# 终端 1 — API（默认端口 3780，空库自动 seed）
npm run dev:server

# 终端 2 — 前端（5173，显式绑 127.0.0.1；代理 /api 与 /ws）
npm run dev:web
```

浏览器打开：**http://127.0.0.1:5173**（勿只用 `localhost` 若本机优先解析到 IPv6 而服务只绑 IPv4）

更细的点选路径与排障见 **[怎么看演示效果](./docs/demo.md)**。

健康检查：

```bash
curl http://127.0.0.1:3780/api/health
# 或 PowerShell: Invoke-RestMethod http://127.0.0.1:3780/api/health
```

### 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev:server` | 启动 API（`--watch`） |
| `npm run dev:web` | 启动 Vite 前端 |
| `npm run seed` | 仅在空库时写入演示数据（已有数据会跳过） |
| `npm run start` | 生产方式启动 API（无 watch） |
| `npm run backup` | **备份** sqlite+journals+uploads → `data/backups/*.tar.gz` |
| `npm run pack` | **打运行包 zip** → `packages/apple-co-work-v{N}-{平台}-{架构}.zip`（进 git；含 bundle+依赖，用户无需 npm install） |
| `npm start` / `start.bat` | **一键启动**（起服务、开浏览器；关启动窗口或 Ctrl+C 结束服务） |
| `npm run build -w web` | 构建前端到 `web/dist`（可由 server 静态托管） |

### 重置数据

删除数据目录后重启 server 即可重新 seed：

```bash
# 请先停掉 server
rm -rf ./data                 # Linux / macOS
# Windows: Remove-Item -Recurse -Force .\data
npm run dev:server
```

---

## 怎么看演示效果

### 方式 A：下载运行包（推荐给使用者）

1. 打开仓库 **[`packages/`](./packages/)**，下载与本机系统匹配的 zip（如 Windows 用 `*-win32-x64.zip`）  
2. 解压后双击 **`start.bat`**（Windows）或运行 **`./start.sh`** / `node start.mjs`  
3. **通常不需要**再 `npm install`（若本机 Node 版本与打包不一致，启动会自动适配原生模块）；浏览器会自动打开；**关掉浏览器不会停服务**（启动窗口 Ctrl+C 结束）  
4. 工作台 → 开聊 **「演示流」**  

> 包内是打包产物（前端 dist + 后端 bundle + 内置依赖），**不是源码**。  
> 同大版本同平台覆盖；大版本/其它平台增量保留。说明见 [docs/RELEASE-USER.md](./docs/RELEASE-USER.md)。

### 方式 B：开发模式（两个终端）

1. 按上文启动 **server + web**，浏览器打开 **http://127.0.0.1:5173**  
2. 顶栏 **工作台** → 开聊下拉选 **「演示流」** → **开聊**  
3. 若看不到「演示流」：进 **设置 → 设置（偏好）**，打开 **显示演示示例**  
4. 按闸门点：**通过**（开始）→ **提交**（项目参数，如 `demo 需求一`）→ **同意**（回声）→ **同意**（命令）→ **同意归档**  
5. 右栏看流程轨与群报告；归档只释放资源，可解档或从节点重开  

逐步说明与排障：**[docs/demo.md](./docs/demo.md)**。

---

## 使用说明

### 第一次演示（推荐路径）

1. 打开 **工作台**  
2. 上方选择群模板 **「演示流」**（或某个**成员**）→ **开聊**  
3. 中栏按闸门提示：**通过**启动 → **提交**项目参数 → **同意**回声 → **同意**命令  
4. 右栏观察节点状态；全部完成后进入 **确认归档**（默认 3 小时超时也会自动归档）  
5. 归档后再发 → **仍在本会话**（解档）；续跑点「克隆并从此开始」追加节点；可再归档  

### 设置

| 菜单 | 说明 |
|------|------|
| **设置（偏好）** | 演示数据；**是否展示脚本弹窗**；归档超时小时；全局管理员与默认流转 |
| **成员管理** | 新建 / **编辑** / 克隆 / 删除。`script` 文件或命令；**是否展示脚本弹窗**（跟随/是/否）；工作文件夹 |
| **群聊模板** | 新建 / **编辑** / 克隆；线性步骤 + 闸门；工作文件夹 |
| **快捷指令** | `/` 唤起；shell/url/agent；shell 可配是否弹窗 |
| **文本快捷 `#`** | `#群聊` / `#文件夹` / `#1`… 插入会话参数正文 |
| **支持与交流** | 技术交流；点赞支持（自愿） |

> 聊天（Session）：**可改名、可删除、可置顶**（不删群模板）。

### 工作文件夹（cwd）

优先级（从高到低）：

1. 成员 script 上显式 `cwd`（可选）  
2. **脚本文件所在目录**（file 模式：与双击 bat 一致，`node index.mjs` 才能找到）  
3. 成员 · 工作文件夹  
4. 本局 Session 约定目录（增强项）  
5. 群 · 工作文件夹  
6. 进程默认目录  

群/成员「工作文件夹」仍写入会话 `#文件夹` 等参数；**跑 bat 时默认 cwd 以脚本路径为基准**。

---

## 项目结构

```
apple-co-work/
├── README.md                 # 本文件
├── package.json              # npm workspaces 根
├── packages/                 # 运行包 zip（打包产物+内置依赖，非源码；按平台）
├── start.bat / start.sh / start.mjs  # 源码树一键启动（开发用）
├── docs/                     # 设计与约定（以文档为准演进）
│   ├── mvp.md / technical-design.md
│   ├── data-storage.md       # SQLite / MD / 脚本约定 / 群报告（实现说明）
│   ├── data-and-ops.md       # P0–P4 + §9 待改进 backlog
│   └── …
├── shared/                   # @acw/shared
├── server/                   # Node API + 引擎
│   ├── config/               # app-settings / slash-commands / about / support
│   └── src/
│       ├── engine.js / runners.js / journal.js
│       ├── appSettings.js    # 含 resolveShowScriptPopup
│       ├── consoleEncoding.js
│       └── …
├── web/                      # Vue3 + Element Plus / Plus-X
└── data/                     # 运行时（gitignore）
    ├── apple-co-work.sqlite
    ├── logs/ · journals/ · uploads/ · console/
```

---

## API 摘要

Base：`http://127.0.0.1:3780/api`  
WebSocket：`ws://127.0.0.1:3780/ws?sessionId=<id>`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET/POST | `/members` | 列表 / 新建 |
| POST | `/members/:id/clone` | 克隆成员 |
| DELETE | `/members/:id` | 删除成员 |
| GET/POST | `/groups` | 列表 / 新建群模板 |
| POST | `/groups/:id/clone` | 克隆群模板 |
| DELETE | `/groups/:id` | 删除群模板 |
| POST | `/groups/:id/sessions` | 用群模板开聊 |
| POST | `/members/:id/sessions` | 与成员单聊开聊（临时单聊模板） |
| GET | `/sessions` | 会话列表（`?status=`） |
| GET | `/sessions/:id` | 详情（session + nodes + messages） |
| PATCH | `/sessions/:id` | 重命名 `{ "title" }` |
| DELETE | `/sessions/:id` | 删除聊天 |
| POST | `/sessions/:id/archive` | 归档（释放资源） |
| POST | `/sessions/:id/unarchive` | 解档（仍同一会话） |
| GET | `/sessions/:id/resources` | 进程登记 + 工作目录占用提示 |
| POST | `/sessions/:id/kill-processes` | 再杀本会话进程（尽力） |
| POST | `/sessions/:id/restart-from-node` | 从节点线性追加克隆并开跑 |
| POST | `/sessions/:id/gate` | 闸门 `{ action, nodeInstanceId, text? }` |
| GET | `/support` | 支持与交流配置 |

更细的领域模型与分期见 [docs/technical-design.md](./docs/technical-design.md)。

---

## 配置与数据

| 路径 | 说明 |
|------|------|
| `data/apple-co-work.sqlite` | 主库（成员/群/会话/消息） |
| `data/logs/` | script 运行日志 |
| `data/journals/` | 进程台账目录（预留） |
| `server/config/support.json` | 支持与交流文案、收款码路径 |
| `server/config/about.json` | 版本、更新日志、更新地址、本地说明 |
| 环境变量 `ACW_PORT` | API 端口，默认 `3780` |
| 环境变量 `ACW_DATA_ROOT` | 数据根目录，默认 `./data` |

---

## 文档索引

| 文档 | 说明 |
|------|------|
| [docs/mvp.md](./docs/mvp.md) | 宗旨、MVP 范围与验收、配置交互约定 |
| [docs/demo.md](./docs/demo.md) | **怎么看演示效果**（启动与点选路径） |
| [docs/technical-design.md](./docs/technical-design.md) | 完整架构、Session/归档/克隆/文件夹/快捷键等 |
| [docs/data-storage.md](./docs/data-storage.md) | **当前实现**：SQLite/MD、参数、**脚本约定**、**群报告**、弹窗优先级 |
| [docs/data-and-ops.md](./docs/data-and-ops.md) | 数据分层、P0–P4、**§9 待改进 backlog** |
| [docs/script-guide.md](./docs/script-guide.md) | **写脚本指南**（占位符 / env / 缺参） |
| [docs/frontend-components.md](./docs/frontend-components.md) | **优先 Element-Plus-X** 组件映射 |
| [docs/directory-structure.md](./docs/directory-structure.md) | 目录与模块边界 |
| [docs/author-contact.example.json](./docs/author-contact.example.json) | 支持与交流配置示例 |

**文档维护约定**：改行为时**同步改文档**（至少 README + `data-storage` / `mvp` 对照）。MVP 范围以 `mvp.md` 为准；愿景与后置以 `technical-design.md` 为准；**现状以 `data-storage.md` 为准**。

---

## 路线图

```
✅ MVP 0.1～0.4 已封板
   → 1.0.0-dev：CI01/03/04 · X07 · R02/R03/R04 · M01/M07（已落地）
   → 其余 P2（R06/M03…）与 CI02
   → LLM 工作目录推断 + 终检越界暴露
   → GUI 桌面壳（复用 web）
```

---

## 支持与交流

产品内：**设置 → 支持与交流**（技术交流 / 反馈；点赞支持自愿，不挡功能）。

| 方式 | 内容 |
|------|------|
| 手机 | 17312678391 |
| 微信 | 默认同手机号（可在 `server/config/support.json` 修改） |

---

## License

私有项目 / 以仓库所有者约定为准。
