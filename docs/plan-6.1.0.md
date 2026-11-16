# 6.1.0 计划：文档中心「一会话一文件」与终端历史定格

> **定位**：5.9.0 聚焦炼化验证闭环；6.1.0 收两件**高频体验债**——文档中心侧栏把「群聊」当文件夹展开（节点台账占满树），以及工作台终端卡在**服务重启后消失**（其实日志在盘里、元数据在 `terminal_sessions`，但列表只读内存 Map）。
>
> **约束**：本机优先；节点台账仍落盘、仍可搜可链可导出；终端历史首版用**日志 tail 文本定格**（非位图截图），避免引入 canvas 截图依赖与可访问性倒退。
>
> 标注：**P0** 本版核心；**P1** 重要；**P2** 后置。状态 `[ ]` / `[x]` 维护。

---

## 一、现状（读代码确认）

### 1.1 文档中心侧栏

| 环节 | 实现 | 缺口 |
| --- | --- | --- |
| 数据源 | `docsHub.scanSessionDir` → 每会话 `ANNOUNCEMENT.md` + `README.md` + `nodes/step-*.md` + 熔炉归档 | API 把**全部白名单文件**挂在 `session.files` 下 |
| 侧栏 UI | `DocsHubSidebar.vue`：群模板 ▸ 会话 ▸ 文件三级树 | 用户心智：**一个群聊 = 一份协同文档**（群报告），节点是过程审计，不应与「文件」同级 |
| 按时间 | `flat` 含每个 step 的 mtime 行 | 同一会话在列表里出现 N 次（每个节点一条） |
| 深链 / 搜索 / 导出 | `?file=nodes/step-*.md`、全文搜索、zip 导出走磁盘全量 | 不受侧栏简化影响 |

### 1.2 工作台终端卡

| 环节 | 实现 | 缺口 |
| --- | --- | --- |
| 气泡内展示 | `TerminalSessionCard.vue`：`previewReplay` 去 ANSI 后末尾 ≤40 行 | **不是截图**，是实时/内存 replay 的文本预览 |
| 运行中 | WS `terminal.output` + `terminalOutputBridge` 环形缓冲 | 正常 |
| 进程结束 | `persistTerminal` 写 `terminal_sessions` + `data/logs/terminal_*.log` | 内存 entry 经 `pruneFinished` 淘汰后，**刷新页面仍有**（同进程内 `loadTerminals`） |
| **服务重启** | `markInterruptedTerminalsOnBoot` 改 DB 状态 | `listSessionTerminals` **仅** `[...terminals.values()]`，**不**从 DB+log 回填 → 聊天流终端卡消失 |
| 满屏 xterm | 需点击「进入终端」附着 WS | 用户希望结束后**默认看到历史输出**，不必为「翻旧账」再点进 PTY |

**结论**：侧栏是信息架构问题；终端是 **API 缺历史回填** + 产品语义（定格 vs  live PTY）未写清。

---

## 二、产品目标

1. **文档中心**：左侧资源管理器在「按群模板 / 按时间」下，**一会话一行、一点即开群报告**（无会话下展开文件列表）；节点台账**不出现在侧栏**，仍可通过搜索、正文互链、流程轨、URL `file=` 打开。
2. **终端历史**：进程结束或服务重启后，聊天时间线仍展示**同一张终端预览卡**（文本定格）；「进入终端」仅对仍可附着的 live 终端；已结束/已中断条目只读预览 + 下载日志（沿用现有 log API）。

---

## 三、能力清单

### 3.1 文档中心（DOC）

- [x] **DOC-01 P0 `docsHub` 导航模型**：每会话导出 `navFile`（优先 `ANNOUNCEMENT.md`，其次 `README.md`）；`listDocs` 的 `flat`（按时间）**仅**导航文件；`session.files` 保留全量供互链/元数据（或拆 `allFiles` 文档化）。
- [x] **DOC-02 P0 侧栏 UI**：`DocsHubSidebar.vue` 会话行改为**叶节点**（文件图标/无 chevron），点击 `select-file(sessionId, navFile.name)`；删除 `toggle-session` 与 indent-2 文件列表。
- [x] **DOC-03 P0 选中态**：会话行在 `current.sessionId === sid` 时高亮（含从正文链到 step 台账的场景）。
- [x] **DOC-04 P1 展开逻辑**：`docsExpandSessionInTree` 只展开群模板层，不再假展开会话。
- [x] **DOC-05 P1 测试**：`docsHub.test.js` 断言 `navFile`；`docsHubLayout.test.mjs` 无三级文件树；必要时 E2E 点会话直达公告。

### 3.2 终端历史定格（TRM）

- [x] **TRM-01 P0 DB 回填**：`listSessionTerminals` = 内存 live ∪ DB 中该会话且不在 Map 的行；按 `started_at` 排序。
- [x] **TRM-02 P0 日志预览**：回填行用 `readTerminalLogPreview` tail（与 API `?format=json` 同上限）；映射 `command_label`→`label`；`log_path` 仅文件名时解析为 `DATA_ROOT/logs/`。
- [x] **TRM-03 P0 前端加载**：`loadTerminals` 为每条回填终端设置 `previewReplay`；`terminal.exited` 时同步刷新 preview。
- [x] **TRM-04 P1 卡片 UX**：`TerminalSessionCard` 对 `exited`/`failed`/`interrupted`/`killed`：**主按钮**「查看输出」（可仍开只读回放/日志）或弱化为次要；运行中保持「进入终端」。
- [x] **TRM-05 P1 单测**：`terminalRehydrate.test.js` 或扩 `terminalService.test.js`——空 Map + DB 行 + 临时 log → list 含 preview。
- [ ] **TRM-06 P2 位图截图**：xterm canvas `toDataURL` 落盘附件——**非 6.1.0**；文本定格不满足再开 ADR。

### 3.3 文档与发布

- [ ] **DOC-06 P0** 更新 `plan-docs-4x.md` §3.2 菜单口径脚注「6.1.0 侧栏仅导航文件」。
- [x] **TRM-07 P0** 更新 `spec-frontend-components.md` §5.1：区分 live 终端与历史定格卡。
- [ ] **REL-01 P1** `about.json` / CHANGELOG 条目（对外说明：非截图，是日志 tail 定格）。

---

## 四、技术方案要点

1. **侧栏 ≠ 数据裁剪**：磁盘与导出仍含 `nodes/`；仅 API `navFile` + 前端树过滤，避免破坏 4.x 审计约定。
2. **回填性能**：每会话终端数 ≤ `RETAIN_FINISHED_PER_SESSION`（20）；tail 默认 48KiB，与现有 preview API 一致；禁止在 list 路径读全量 log。
3. **安全**：回填只读；`interrupted` 不提供假「运行中」；附着 WS 对无进程条目返回明确错误（既有行为）。
4. **兼容**：`autoCollapseOnExit` 仍生效；定格卡留在气泡流，不强制展开 xterm 层。

---

## 五、里程碑

| 阶段 | 内容 | 产出 |
| --- | --- | --- |
| M1 | DOC-01～03、侧栏 Vue | 一会话一叶，节点不出侧栏 |
| M2 | TRM-01～03、log_path 解析修复 | 重启后会话内终端卡回归 |
| M3 | TRM-04、单测、文档、about | 可发布 6.1.0 |

---

## 六、验收（手工）

1. 文档中心「按群模板」：展开模板 → 点会话标题 → 右侧为群报告；侧栏无 `step-xx` 行。
2. 全文搜索仍能命中节点台账；点击结果可打开 step 文档。
3. 跑完脚本成员终端节点 → 聊天有预览卡 → **重启 `npm run dev:server`** → 重新进入同会话 → 预览卡仍在，内容与下载日志一致。
4. 运行中终端仍可进入 PTY；结束后主操作以查看输出为主。

---

## 七、开放问题

| ID | 问题 | 默认 |
| --- | --- | --- |
| Q1 | 无 `ANNOUNCEMENT.md` 仅有 step 的会话是否在侧栏展示？ | 展示会话行，打开 `README.md` 或隐藏（无 nav 则不显示） |
| Q2 | 按时间列表是否显示「群模板 · 会话」副标题？ | 保持现有 `docsFileLabel` + meta |
| Q3 | 是否要把定格 preview 写入 `node_instances.output_json`？ | 6.1.0 否，日志为单一事实源 |