# 数据怎么存（当前实现）

| 属性 | 内容 |
|------|------|
| 状态 | 与代码一致（MVP） |
| 关联 | [data-and-ops.md](./data-and-ops.md)（原则与演进清单）、[technical-design.md](./technical-design.md) |
| 更新日期 | 2026-08-13 |

一句话：**业务调度真相在 SQLite；节点 I/O 另有一份 Markdown 给人读；附件/日志/部分配置是文件。**  
不是「只存 MD」，也不是「只存 SQL」——**双轨，职责分开**。

---

## 1. 总览

```
oh-my-co-work/
├── data/                              ← 运行时数据根（可用 ACW_DATA_ROOT 改）
│   ├── oh-my-co-work.sqlite         ← 主库（WAL 模式，可能还有 -wal/-shm）
│   ├── journals/sessions/.../*.md     ← 节点台账 + 会话索引（给人读）
│   ├── uploads/                       ← 聊天附件
│   └── logs/                          ← 脚本及 terminal_{id}.log 终端日志
└── server/config/*.json               ← 应用级配置（快捷指令、关于、支持、偏好）
```

| 层 | 载体 | 谁读 | 职责 |
|----|------|------|------|
| **A. 调度真相** | `data/oh-my-co-work.sqlite` | 引擎 / API / 前端 | 会话、节点状态、消息、成员、群模板、节点 input/output JSON |
| **B. 可读台账** | `data/journals/**/*.md` | 人 / Git | 每节点输入输出的 Markdown 副本；归档时会话 README 索引 |
| **C. 大文件** | `data/uploads/`、`data/logs/` | 人 / 进程 | 附件、stdout 日志；库里只记路径或摘要 |
| **D. 配置文件** | `server/config/*.json` | 服务启动时读 | 快捷指令、关于页、支持信息、是否显示演示数据等 |

### 1.1 内嵌终端（2.0 / 2.0.1）

- 运行中的终端会话由 `server/src/terminal/terminalService.js` 在内存管理，并绑定会话、节点、成员、runId 与 PID。
- 有限回放缓冲（约 256 KB）用于页面刷新后重新附着；前端按 `seq` 写入 xterm，避免缓冲封顶后停更。
- attach 先 flush 尚未发出的 pending 输出，再发 snapshot，避免重复字符。
- 完整原始输出异步追加写入 `data/logs/terminal_{terminalId}.log`，单文件上限可在设置配额里改（默认约 10 MiB）。
- 落盘日志可按设置脱敏常见 Token（实时回放与 TUI 保持原文）；元数据写入 `terminal_sessions` 表。
- JSONL Adapter 事件文件在脚本工作目录，不进 SQLite 大字段。
- 节点结束后，`output_json` 保存 terminalId、退出码、runtime、cwd 与日志文件名，不复制完整终端输出。
- 用户停止或超时：`ok` 仅在进程真正退出且退出码属于成功码时为真；同时清理进程树与 PID 登记。
- 服务重启后旧 PTY 不承诺恢复；现有中断恢复机制负责把运行中节点转为待处理。
- 会话归档、手工释放、从节点续跑及同成员重新执行均通过 `processRegistry` 回收终端进程树。

### 1.2 本机访问令牌（2.0.1）

本机 API 默认只服务本机页面，避免任意网页跨站驱动 `/api` 或终端：

- 启动时生成随机 `ACW_API_TOKEN`（也可用环境变量固定）。
- `GET /api/bootstrap` 在可信 Origin 下下发令牌；前端 `web/src/api.js` 缓存后用于 REST 与 WebSocket。
- CORS / Origin 仅允许 `127.0.0.1`、`localhost`、`::1`。
- `/api/health` 免令牌；其余 `/api` 需要 `X-ACW-Token`、`Authorization: Bearer` 或 query `token`。
- WebSocket `verifyClient` 同样校验 Origin 与 URL 中的 `token`。

**原则（写死）：**

1. **列表、闸门、流程推进、展开看节点 I/O → 以 SQLite 为准。**  
2. **Markdown 是镜像给人读的**，程序会写；不要当唯一真相改完指望引擎自动同步。  
3. **路径尽量相对 `data/`**，方便整目录备份、换机器。

---

## 2. SQLite（主库）

- **路径**：`data/oh-my-co-work.sqlite`（`server/src/db.js`）  
- **迁移**：若仅有旧库 `element-co-work.sqlite`，启动时自动改名为新文件名  
- **模式**：`journal_mode = WAL`，`foreign_keys = ON`  
- **驱动**：`better-sqlite3`（同步、本地单机）

### 2.1 主要表

| 表 | 存什么 |
|----|--------|
| `members` | 成员 Agent / 脚本配置（`config_json`、`kind`、`display_name`…） |
| `groups` | 群模板（`steps_json` 为步骤数组） |
| `sessions` | 一次开聊任务（状态、当前步骤、`context_json`、归档信息） |
| `node_instances` | 该会话下每个步骤的运行实例 |
| `messages` | 聊天气泡 / 闸门消息（`content_json`） |
| `app_settings` | 键值偏好（部分也会落到 config JSON，见下） |
| `schema_version` | 轻量 schema 版本 |

### 2.2 节点输入 / 输出（SQL 侧）

表 `node_instances` 关键字段：

| 字段 | 含义 |
|------|------|
| `input_json` | 节点输入（JSON 文本） |
| `output_json` | 节点输出（JSON 文本） |
| `journal_path` | 对应 Markdown 台账相对路径，如 `journals/sessions/{sid}/nodes/step-00-xxx.md` |
| `status` / `started_at` / `finished_at` | 运行态 |

引擎在推进节点时（`server/src/engine.js`）会：

1. 更新 `input_json` / `output_json` / 状态；  
2. 调用 `writeNodeJournal` 写 MD，并把相对路径写回 `journal_path`。

前端右侧流程轨「展开」看 I/O：**读 SQL 解析结果**，但展示用 **业务摘要**（`formatBusinessIo`）：用户输入 / 项目参数 / 完成概况；**不展示** memberId、命令行、cwd、pid 等非业务字段。完整技术日志仍在 `data/logs/`。

### 2.3 项目参数（#1 #2…）

初始化/人工步（步骤 `captureParams: true`，**首步人工默认开启**）**用户输入**多段信息：

- **空格或换行**均可分隔 → 依次为 `#1`、`#2`、…，**最多 `#99`**  
- **新开聊**（新会话）各自独立一套参数，互不串号  
- **节点/成员输出**不走切分：整段使用；工作台 `#` 面板以 `#出1`、`#出2`… 插入全文  
- **群聊普通发送**（`POST /sessions/:id/messages`，含进行中 / 临时协助期间）：正文按同规则 **追加** `#1…`（`appendProjectParams`），写入 `userNotes` 并刷新群报告；纯 `@` 协助、人工闸门「提交」、开聊「通过」等路径不重复写入  

| 落点 | 字段 |
|------|------|
| 会话上下文 | `context_json.params`（`{"#1":"…","1":"…"}`）、`paramsList`、`projectInfoRaw` |
| 节点 I/O | 该人工步 `output_json.params` / `paramsList`；后续成员步 `input_json.params` |
| 脚本 | 命令/参数里写 `#1` 或 `{#1}`；进程环境 `ACW_PARAM_1`、`ACW_PARAMS_JSON` |
| **#群聊** | 整份群模板名片（开聊即生成，不依赖用户输入） |
| **#文件夹** | 群聊工作文件夹绝对/配置路径（开聊即写入） |
| **群报告 ANNOUNCEMENT.md** | **# 参数全集**（`#群聊` / `#文件夹` / `#1`…）+ **各子节点输入/输出**；人工可 PUT 编辑；手改后 `announcementManual=true`，自动汇总不覆盖除非 force；路径仍为 `journals/sessions/{sessionId}/ANNOUNCEMENT.md`（文件名兼容） |
| **归档确认** | 完成/失败/拒绝后进入 `pendingArchive`（**不立刻归档**）；待确认时只杀非 `detach` 进程（Cursor CLI 等仅唤起窗口保留）；手工「归档」/闸门同意，或超时（默认 **3h**，`autoArchiveHours`）→ `archiveSession`：**必杀本会话全部进程**（含 detach）；`archive_reason` 区分结果（`failed`/`rejected`→失败，其余→成功） |
| **审核三态** | 节点 `output.humanAction`：`pending` / `approve` / `reject`；脚本产出或输入框消息保持 `pending`；仅闸门「同意/拒绝」改态并推进 |
| **归档 / 解档 / 再发** | **已决**：归档只释资源；再发仍在本会话、不新开群聊；可无限归档；续跑=本会话追加克隆节点。详见 [mvp.md §1.0](./mvp.md) 与 `SESSION_ARCHIVE_RULES`。 |
| **从节点重开** | `POST /sessions/:id/restart-from-node`：本会话线性追加克隆并开跑（场外无此操作）；已归档则先解档 |
| **脚本弹窗** | 全局 `app-settings.json` → `showScriptPopup`（默认 true）；成员 `script.showScriptPopup` / 快捷指令同字段可覆盖。解析：`resolveShowScriptPopup`（局部显式 > 遗留 showConsole/hideWindow > 全局） |
| **仅唤起 detach** | 成员 `script.detach=true`（或 `waitForExit=false`）：弹窗 `Start-Process` 后**不等待**结束，适合 Cursor CLI；cwd：外部工具优先成员/会话工作目录，不落在 CLI 安装目录 |

**调度仍以 SQL 为准**；参数随 context 持久化，归档后可在流程轨「会话参数」区与节点展开中查看。

### 2.4 消息

聊天区内容在 **`messages` 表**，不按整段会话塞进一个大 JSON。  
类型包括普通文本、系统提示、闸门（`type = gate`）等，正文在 `content_json`。  
普通用户消息除气泡外，会同步进会话 **`#` 参数** 与群报告 **用户参与**（见 §2.3）；实现见 `server/src/engine.js` 的 `recordUserChatInput` / `postUserMessage`。

### 2.4 备份 SQLite 时注意

WAL 下可能存在：

- `oh-my-co-work.sqlite`  
- `oh-my-co-work.sqlite-wal`  
- `oh-my-co-work.sqlite-shm`  

**完整备份建议停服后拷贝三件，或使用 SQLite backup API。** 只拷贝主文件可能丢未 checkpoint 的数据。

---

## 3. Markdown 台账

实现：`server/src/journal.js`。

### 3.1 单节点文件

```
data/journals/sessions/{sessionId}/nodes/step-{序号两位}-{nodeId}.md
```

结构示例：

```markdown
---
session_id: "ses_xxx"
session_title: "演示流 · …"
node_id: "node_xxx"
step_index: 0
title: "输入任务说明"
status: "waiting_human"
...
---

# 1. 输入任务说明

## 输入

```json
{ "kind": "human", "prompt": "输入任务说明" }
```

## 输出

```json
{ "waiting": true }
```
```

- 前面 YAML：元数据  
- 正文「输入 / 输出」：给人扫读，JSON 用代码块包一层  

### 3.2 群报告（# 参数 + 节点入出）

```
data/journals/sessions/{sessionId}/ANNOUNCEMENT.md
```

由 `writeSessionAnnouncement`（`journal.js`）生成，**默认 io**：

```markdown
# 任务标题

群报告 · 状态 · 时间 · 管理员

## # 参数
### #群聊
…
- `#文件夹` …
- `#1` …
- `#2` …

## 节点输入 / 输出
### 1. 步骤名 · 完成
**# 参数**（节点上若有）
**入** …
**出** …
```

| 原则 | 说明 |
|------|------|
| **# 优先** | 会话全部 `#` 类参数置顶；节点上的 params 也列出 |
| **入出齐全** | 各子节点实质输入 / 输出（过滤开始结束空话） |
| 手改优先 | `context.announcementManual`；自动刷新跳过，除非 force |
| 文件名 | 仍用 `ANNOUNCEMENT.md`，产品名「群报告」 |

### 3.3 会话索引（归档时）

```
data/journals/sessions/{sessionId}/README.md
```

表格列出各步骤状态 + 链到对应节点 MD。由 `writeSessionJournalIndex` 在归档等时机生成。

### 3.4 MD 与 SQL 的关系

| 场景 | 用谁 |
|------|------|
| 引擎推进、闸门判定、API 详情 | **SQL** |
| 人在资源管理器 / IDE / Git 里看历史 | **MD** |
| 手工改 MD | **不会**自动回写 SQLite（当前未做对账回灌） |

---

## 4. 其它文件

| 路径 | 说明 |
|------|------|
| `data/uploads/` | 会话附件上传目录（multer）；消息里引用 URL/相对路径 |
| `data/logs/` | 脚本类成员运行日志等 |
| `data/console/` | 可选：Windows 弹窗相关临时文件（HTA 控制窗等） |
| `server/config/slash-commands.json` | 斜杠 `/` 与快捷键脚本（`hotkeyScript`；shell 可选 **`scriptPath` / `scriptWorkDir` / `anchorMemberId`**） |
| `server/config/app-settings.json` | `showDemo`、`admin`、`autoArchiveHours`、**`showScriptPopup`** 等 |
| `server/config/about.json` | 关于页文案 |
| `server/config/support.json` | 支持与交流 / 点赞文案 |

配置 JSON **不是**会话运行态；删 `data/` 不会自动清掉 `server/config/`（除非你一并删）。

---

## 5. 按功能对照：落在哪

| 你在 UI 里做的事 | 主要落点 |
|------------------|----------|
| 新建成员 / 群模板 | SQLite `members` / `groups` |
| 开聊 | SQLite `sessions` + `node_instances` + 首批 `messages`；群模板或**成员单聊**（临时 `config.adhoc` 群） |
| **会话默认名** | `context.titleAuto`：采集 `#1` 后自动 `formatSessionAutoTitle`（`#1 · 群模板缩写`）；`groupTitle` / `groupTitleAbbr` 供列表 hover；手改标题则 `titleAuto=false` |
| 发消息 / 附件 | `messages`；文件 → `uploads/`；**普通群聊**另追加 `context.paramsList` / `userNotes` 并刷新群报告 |
| **项目参数 #1 #2…** | **用户输入**人工步提交：空格/换行切分 → `sessions.context_json.params` / `paramsList`；**新开聊另起一套**。节点输出整段不切分；`#` 面板可用 `#出n` 插入 |
| **#群聊（群聊名片）** | 开聊时写入 `context_json.groupCard` / `params['#群聊']`：名称、简介、工作目录、步骤列表；脚本/回声可用 `#群聊` 或 `{#群聊}` |
| **#文件夹** | 群聊工作目录路径：`context_json.groupFolder` / `params['#文件夹']`（会话 primary → 群模板 work_folder）；脚本可用 `#文件夹` 或 `{#文件夹}` |
| **工作台 `#` 文本快捷** | 输入框 `#` 仅唤起面板；选中后**只插入正文**（不含 `#` 键名）；与 `/` `@` 互斥 |
| 闸门同意 / 人工输入 | 更新节点状态 + `messages`；刷新 input/output + MD |
| 流程轨展开看 I/O | API 读 SQL 的 `input_json` / `output_json` |
| **群报告** | 自动/手动刷新 → `ANNOUNCEMENT.md`（# 参数 + 节点入出）；PUT 手改 |
| 归档 | 会话状态；写会话 `README.md` 索引；可杀进程等 |
| 删除会话 | 删 SQL 中 session 及级联消息/节点；**MD 文件当前未必自动删**（磁盘可能残留） |
| 快捷指令设置 | `server/config/slash-commands.json`；shell 执行 cwd 优先 **脚本基准目录**（见 [script-guide.md](./script-guide.md) §4） |
| 是否展示脚本弹窗 | 设置页全局；成员 / 快捷指令可覆盖 |

---

## 6. 脚本执行约定（当前实现）

实现：`server/src/runners.js`、`appSettings.js`、`consoleEncoding.js`。

### 6.1 原则：**一切以脚本配置为准**

| 项 | 行为 |
|----|------|
| 命令 / 文件 | 按成员 `script` 配置启动；**不写死机器路径**（命令走 PATH；文件可手填绝对路径）；**不包 ECW 壳** |
| 环境变量 | 可选 `script.env`；未配则**完整继承本机 `process.env`**（代理、TOKEN 等由系统/用户自管） |
| cwd | **`script.cwd`（显式）→ 脚本文件所在目录（file 模式基准）→ 成员/会话/群工作目录 → process.cwd**。`node index.mjs` 等相对路径以脚本目录为准 |
| 弹窗开 | Windows：`Start-Process` 启动；**`.bat` 先 `chcp 65001` 再 `call`**。脚本退出后**默认不关黑窗**，直至你手动关、流程进入**下一成员步**，或进入**待确认归档**时统一释放 |
| 弹窗关 | `spawn` + `windowsHide`，静默跑 |
| 打开 Cursor 等 GUI | **不模拟**；真开应用，聊天短状态即可 |
| 输出解码 | 日志/摘要尽量 UTF-8/GBK 择优（`decodeConsoleBytes`），减少气泡乱码 |

### 6.2 弹窗优先级

```
成员 script.showScriptPopup / 快捷指令 showScriptPopup（显式 true/false）
  → 遗留 showConsole / hideWindow
  → 全局 app-settings.showScriptPopup（默认 true）
```

设置 UI：全局「是否展示脚本弹窗」；成员与快捷指令为 **跟随全局 / 是 / 否**。

### 6.3 环境注入（供脚本选用，不改脚本逻辑）

| 变量 / 占位 | 说明 |
|-------------|------|
| `#1` / `{#1}`、`#群聊`、`#文件夹` | 会话/群参数占位 |
| **`#a` / `{#a}` / `{a}`** | **调用参数**：`@成员` 或 `/指令` 时，输入框去掉触发词后的正文；成员单聊启动输入亦写入 `#a` |
| `{input}` / `{human}` | 与调用参数同义（humanInput / `#a`） |
| `{folder}` / `{cwd}` / `{sessionId}` | 工作目录与会话 id |
| `ACW_PARAM_1`、`ACW_PARAMS_JSON` | 环境变量 |
| `ACW_SESSION_ID`、`ACW_MEMBER_ID`、`ACW_HUMAN_INPUT` | 会话与本轮人话 |

---

## 7. 环境变量

| 变量 | 含义 | 默认 |
|------|------|------|
| `ACW_DATA_ROOT` | 数据根目录（兼容旧名 `ECW_DATA_ROOT`） | 仓库下 `data/` |
| `ACW_PORT` | API 端口（兼容旧名 `ECW_PORT`） | `3780` |
| `ACW_API_TOKEN` | 固定本机访问令牌；不设则每次启动随机生成 | 随机 |
| `ACW_AUTO_EXIT` | `1` 时尝试在浏览器全部离开后退出服务（实验性，易误杀） | 关 |
| `ACW_HEADLESS_BROWSER` | `1` 时 `start.mjs` 用 Playwright **无头**加载首页；**结束 start（Ctrl+C）会 `browser.close()` 并停 API**（仅源码树 + dev 依赖 `playwright`） | 关 |

健康检查接口会回 `dataRoot` 实际路径，便于确认写到哪。

---

## 8. 常见问题

**Q：数据到底是 MD 还是 SQLite？**  
A：调度与聊天是 **SQLite**；节点 I/O **同时**写 SQL JSON + MD 台账。MD 方便人看，不是唯一库。

**Q：能不能只靠 Git 管理 journals，不提交 sqlite？**  
A：可以。业务代码仓通常 **gitignore 掉 `data/*.sqlite*`**，需要可读历史时只提交 `journals/`（见 `data-and-ops` 里 Git 边界）。但没有 sqlite 时，本地重新打开旧会话列表会丢——MD 不能单独驱动引擎。

**Q：演示流 / 会话标题在哪？**  
A：标题在 `sessions.title`；模板名在 `groups.title`。MD 里的 `session_title` 是写入时的快照。

**Q：怎么整包备份？**  
A：停服后打包整个 `data/`（含 sqlite + wal/shm + journals + uploads + logs），需要时再加 `server/config/`。

---

## 9. 相关代码入口

| 文件 | 作用 |
|------|------|
| `server/src/db.js` | 打开库、建表、迁移字段 |
| `server/src/engine.js` | 推进节点时写 SQL + 调 journal / 群报告 |
| `server/src/journal.js` | 写节点 MD、**群报告**、会话 README |
| `server/src/runners.js` | 脚本执行（配置为准、弹窗 Start-Process） |
| `server/src/consoleEncoding.js` | 控制台输出多编码解码 |
| `server/src/services.js` | 成员/群/会话 CRUD、详情组装 input/output |
| `server/src/uploads.js` | 附件目录 |
| `server/src/slashCommands.js` / `appSettings.js` | 快捷指令；全局设置与 `resolveShowScriptPopup` |

更长的演进清单与 backlog 见 [data-and-ops.md](./data-and-ops.md)。

---

## 10. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-07-20 | **0.4.0 封板**：`#a`；成员单聊；会话历史群/成员分区；气泡单层；下版 **1.0.0** |
| 2026-07-20 | **0.4**：`#a` 调用参数；成员单聊无「说明/参数」步 |
| 2026-07-20 | **0.3**：归档待确认 + `autoArchiveHours`；审核三态 `humanAction`；detach 保留；开聊下拉标签 |
| 2026-07-17 | 群公告改为简洁进度；脚本弹窗优先级与「以脚本为准」；输出解码入口 |
| 2026-07-17 | `#` 文本快捷与参数切分规则；`#出n` 输出整段；成员开聊 adhoc 群 |
| 2026-07-20 | **群公告 → 群报告**：突出全部 `#` 参数 + 各节点输入/输出（0.2） |
| 2026-07-17 | 初版：SQLite / MD / 参数 / 归档等实现说明 |
