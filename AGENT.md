# AGENT.md — oh-my-co-work 项目协作指引

> 最后更新: 2026-08-19 · 适用于 oh-my-co-work v3.3.0 最终封板

本文件面向所有在该仓库工作的贡献者和 AI Agent。阅读后再动手，能减少 80% 的格式和路径翻车。

---

## 1. 项目是什么

oh-my-co-work 是一个**本地优先的群聊式多智能体协同工作台**。

- 一个 Workflow = 一个群聊，一个 Agent / 脚本 = 一个成员
- 关键节点（启动、参数、审核）设人工闸门
- 执行端支持交互式 TUI（node-pty + xterm.js）和普通 pipe 两种模式
- 数据全部留在本机：SQLite + Markdown + 本地附件

版本现状：**3.3.0 最终封板**。熔炉是右侧桌宠：已装且已登录直接开 Grok TUI（默认满屏），否则弹教程。群聊同意最后一步即完成并归档；成员单聊不自动归档。服务端已上随机访问令牌与 Origin 校验；前端已支持终端卡、中栏 TUI 工作区、满屏与全屏。首页欢迎区左对齐，保留工具 Logo。桌面壳与更多 CLI Adapter 仍后置。

---

## 2. 目录结构

```text
.
├── web/                  # Vue 3 工作台（xterm 终端 / Element Plus UI）
│   ├── src/
│   │   ├── api.js        # 统一 API + WebSocket 入口
│   │   ├── components/   # 终端卡、终端视图、工作区
│   │   ├── views/        # 工作台、设置页
│   │   └── main.js
│   └── package.json
├── server/               # Node.js + Express + Workflow 引擎
│   ├── src/
│   │   ├── index.js      # Express / WebSocket 入口
│   │   ├── routes.js     # REST 路由
│   │   ├── engine.js     # 会话与节点状态机
│   │   ├── runners.js    # 执行体抽象（pipe / terminal）
│   │   ├── processRegistry.js  # PTY / 子进程生命周期
│   │   ├── terminal/terminalService.js  # node-pty 封装
│   │   ├── db.js         # better-sqlite3 初始化与迁移
│   │   ├── bus.js        # WebSocket 广播
│   │   ├── journal.js    # Markdown 台账
│   │   ├── slashCommands.js    # / 指令
│   │   └── ...
│   └── test/             # Node test runner（node --test）
├── shared/               # @acw/shared：DTO、状态枚举、工具函数
├── scripts/              # 维护脚本（backup / pack / selftest）
├── data/                 # 运行时数据（gitignore；见 docs/data-storage.md）
├── docs/                 # 产品、架构、数据与实施文档
├── packages/             # 三平台压缩包（darwin-arm64 / linux-x64 / win32-x64）
├── start.mjs             # 开发 / 压缩包通用入口
├── start.bat             # Windows 双击入口
├── start.sh              # macOS / Linux 双击入口
└── package.json          # npm workspaces：shared | server | web
```

---

## 3. 技术栈与运行时

| 层 | 技术 |
|----|------|
| 前端框架 | Vue 3 + Element Plus + Element-Plus-X |
| 前端构建 | Vite |
| 终端前端 | xterm.js |
| 后端运行时 | Node.js >= 18（ESM only） |
| 后端框架 | Express + ws（WebSocket） |
| 交互终端 | node-pty（ConPTY / PTY） |
| 数据存储 | better-sqlite3 + Markdown 台账 + 本地附件 |
| 测试 | Node.js 内置 test runner（`node --test`） |

**npm workspaces**：`shared`、`server`、`web` 三个包共用一个 lockfile。修改 `shared` 后需要重新安装或 `npm run build` 让 workspace link 生效。

---

## 4. 启动方式

### 开发模式（推荐两个终端）

```powershell
# 终端 1：API + Workflow 引擎（带 watch）
npm run dev:server

# 终端 2：Vue 工作台（热更新）
npm run dev:web
```

浏览器访问 <http://127.0.0.1:5173>。

### 一键启动

```powershell
# 会检查 Node、npm install、构建前端、启动服务并打开浏览器
node start.mjs

# Windows 双击入口（同上的 CMD 包装）
start.bat
```

关键环境变量：

| 变量 | 默认 | 说明 |
|------|------|------|
| `ACW_PORT` | `3780` | 服务端口 |
| `ACW_AUTO_EXIT` | `0` | 设为 `1` 时，关闭浏览器后服务退出 |
| `ACW_HEADLESS_BROWSER` | `0` | 设为 `1` 时用 Playwright 无头加载页面 |

---

## 5. 编码约定

### 5.1 语言与格式

- **语言**：JS / TS 源码使用英文注释；面向用户的文案（错误信息、Markdown 台账）使用中文
- **缩进**：2 空格；字符串单引号优先
- **模块**：全项目 ESM（`"type": "module"`）。动态导入 `import()` 仅在可选依赖（如 playwright）处使用
- **文件命名**：server 源码小写驼峰（`appSettings.js`）；Vue 组件大写下划线（`TerminalView.vue`）

### 5.2 数据库与状态

- 数据库：`data/oh-my-co-work.sqlite`（生产）；迁移在 `server/src/db.js` 的 `initDb`
- 会话状态：`SESSION_STATUS`（`active | paused | waiting_human | interrupted | archived | failed`）
- 节点状态：`NODE_STATUS`（`pending | running | waiting_human | succeeded | failed | skipped`）
- 所有状态枚举来自 `@acw/shared`，禁止在业务代码里硬编码字符串

### 5.3 进程与终端

- PTY 子进程通过 `processRegistry.js` 统一管理，按 `sessionId` 或 `memberId` 聚合
- 停止会话时走 `killSessionProcesses` / `killMemberProcesses`，不要直接 `process.kill`
- `node-pty` 仅封装在 `server/src/terminal/terminalService.js`，不扩散到 engine

### 5.4 前端到后端的契约

- REST：`/api/health`（公开）、其余 `/api/*` 需要 Bearer 令牌
- WebSocket：同域 Origin 校验 + 令牌握手
- 统一错误格式：`{ ok: false, error: string }`
- 前端 API 调用集中在 `web/src/api.js`，新增路由时同步更新

### 5.5 测试

- 单元测试放在 `server/test/*.test.js`
- 运行：`npm run test`（workspace 委托到 server）
- 自愈 / 冒烟测试放在 `scripts/selftest-*.mjs`，不走 test runner
- 测试用 Node 内置 `assert` + `node:test`，不引入第三方测试库

---

## 6. Git 工作流

- 主分支：`main`
- 提交信息使用 Conventional Commits（`feat:` / `fix:` / `docs:` / `refactor:` / `test:` / `chore:`）
- 行为变化必须同步更新 `docs/` 对应文档
- 新执行体 / Adapter 优先保持可插拔，不要把具体工具写死进 Workflow 内核
- **变更台账**：每个文件的增删改查记录在 `CODE_CHANGE.md`（见第 8 条）

---

## 7. AI Agent 特别规则

1. **不要假设环境**：启动前先检查 Node 版本、端口占用、依赖是否安装
2. **不要动运行时数据**：`data/`、`*.sqlite*`、`server/data/` 均为 gitignore，不要写入或提交
3. **不要泄露密钥**：`.env` 已 gitignore；代码里不要出现真实 token / 密码
4. **小步提交**：一个功能点一个 commit；一个 PR 不超过 400 行有效变更
5. **修改即文档**：改了路由、状态枚举、成员配置 schema，必须同步 README 或 docs
6. **先看 tests**：修改 engine / runners / routes 前，先读 `server/test/` 同名或相邻测试
7. **终端相关先看 terminalService.js**：不要直接在 engine 里拼 PTY 命令

---

## 8. CODE_CHANGE.md 使用规则

- 位置：仓库根目录 `CODE_CHANGE.md`
- 状态：**随仓库提交**（与 AGENT.md 一样不列入 .gitignore），作为团队可见的变更台账
- 记录时机：对任何文件执行新增 / 修改 / 删除 / 移动 / 重命名后，追加一条记录
- 记录内容：`日期 | 操作(A/M/D/R) | 路径 | 一句话说明`
- 示例格式见文件本身；保持按日期降序，最新在最上面

---

## 9. 常见任务速查

| 任务 | 命令 |
|------|------|
| 安装全部依赖 | `npm install` |
| 构建前端 | `npm run build` |
| 启动 API | `npm run dev:server` |
| 启动工作台 | `npm run dev:web` |
| 跑测试 | `npm run test` |
| 数据库迁移 | 修改 `server/src/db.js` 的 `initDb`，启动时自动执行 |
| 备份 | `npm run backup`（调用 `scripts/backup.mjs`） |
| 打包发布 | `npm run pack`（调用 `scripts/pack-release.mjs`） |
| 种子数据 | `npm run seed`（workspace 委托到 server） |

---

## 10. 参考文档

- `docs/technical-design.md` — Workflow、会话、节点、闸门设计
- `docs/data-storage.md` — SQLite 与 Markdown 台账结构
- `docs/tui-2x.md` — PTY 架构、协议与安全
- `docs/crucible-3x.md` — 3.x 熔炉：Grok Agent、提示词适配、加人/加节点两条路径
- `docs/script-guide.md` — 脚本成员接入（BAT / PowerShell / CLI）
- `docs/demo.md` — 演示流完整操作路径
