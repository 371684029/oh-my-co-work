# 6.2.0 计划：全局搜索、完成归档、熔炉炼化合一、文档可改产出

> **定位**：6.1.0 聚焦文档中心导航与终端历史定格；6.2.0 在已落地的**全局聊天搜索**与**会话完成归档**之外，再收三件事：**设置里「是否适配」与「熔炉炼化」并成一种能力**；**炼化目标一句话对齐产品**；**文档中心让用户直接改步骤产出里的输入/输出记录**（脚本自动收的不准时人工修）。
>
> **熔炉炼化（唯一概念）**：让 oh-my-co-work **向脚本注入本轮输入**，并从脚本侧拿到 **可进文档中心的稳定产出**（环境变量 / argv 进、stdout 标题或既有台账进）。用户只认这个名字，不再单独勾选「是否适配」。
>
> **约束**：本机优先；搜索仍走既有 `searchMessages`；归档仍走 `archiveSession`；**不新增面向用户的「适配 / 炼化 / JSONL」分支选项**——实现层可合并旧字段，读库兼容 `config.adapt`，但 UI 与文案只有「熔炉炼化」；手动改产出只动 Markdown 台账，不借机自动改成员源文件（除非用户明确点还原/炼化保存）。
>
> 标注：**P0** 本版核心；**P1** 重要；**P2** 后置。状态 `[ ]` / `[x]` 维护。

---

## 一、现状（读代码确认）

### 1.1 聊天搜索

| 环节 | 实现 | 缺口 |
| --- | --- | --- |
| API | `GET /api/messages/search?q=&sessionId=` 可选限定会话 | 已支持跨会话 |
| 前端入口 | `Workbench.vue` 会话头「搜索聊天」文字按钮 | 用户期望**右上角放大镜**、**全局**检索 |
| 查询条件 | `canRunChatSearch` 要求 `sessionId` | 未选会话或想跨会话时被挡 |
| 命中跳转 | `jumpToChatHit` 可切换 `sessionId` 并滚到 `data-msg-id` | 逻辑可复用到壳层顶栏 |

### 1.2 会话归档

| 环节 | 实现 | 缺口 |
| --- | --- | --- |
| 内核 | `archiveSession`：杀会话进程、清 pendingArchive、写 `archived`、WS `session.archived` | 完整 |
| 自动 | 流程终局 `advance` → `archiveSession(..., 'completed')` | 有 |
| 手动 API | `POST /sessions/:id/archive` | 前端**无**顶栏/会话头入口 |
| 用户心智 | 左侧「已归档」筛选 | 需要会话头上的 **Done/完成** 一键归档 |

### 1.3 熔炉炼化 vs 是否适配（设置）

| 环节 | 实现 | 缺口 |
| --- | --- | --- |
| 成员 UI | `Members.vue` / `Groups.vue` 两个复选框 + 两套 hint | 用户要**一个**「熔炉炼化」 |
| 炼化 | `config.refine`、保存改源、`ACW-REFINE`、`data/backups/refine` | 已覆盖「注入输入 + stdout 标题产出」 |
| 适配 | `config.adapt`、`prepareAdaptForMember`、`data/backups/adapt`、JSONL | 与炼化目标重叠，仅实现路径不同 |
| 文档 | `guide-script.md` §3.1 炼化契约 | 未写清「适配能力并入炼化」 |

### 1.4 文档中心改输入/输出

| 环节 | 实现 | 缺口 |
| --- | --- | --- |
| 编辑 | `useDocsHub.js`：`canEdit` **仅** `file.kind === 'announce'` | `nodes/step-*.md` 等台账只读，无法在中心改「输入/输出」段落 |
| 落盘 | 既有 journal / docs API 写 Markdown | 需对白名单节点台账开放同一套编辑保存 |

**结论**：搜索/归档为 IA 与接线；炼化为**产品合一 + 隐藏 adapt 勾选项**；产出修正为**扩大文档中心可编辑范围**。

---

## 二、产品目标

1. **全局搜索**（已交付）：顶栏放大镜搜全部会话聊天；命中跳转会话与消息。见 §3.1。
2. **完成归档**（已交付）：会话头「完成」= 手动 `archiveSession`，与自动归档同样释放资源。见 §3.2。
3. **熔炉炼化合一**：设置、群模板、成员表里**只保留「熔炉炼化」**；**删除「是否适配」及全部 adapt 逻辑**，不迁移旧数据。
4. **文档中心改产出**：打开节点台账（`nodes/step-*.md`）或群报告时，与公告一样可**编辑并保存** Markdown，用户自行改正文里的输入记录、输出摘要、标题等；保存写回 `data/journals/...`，聊天/搜索索引按现有刷新策略更新。

---

## 三、能力清单

### 3.1 全局聊天搜索（SRC）

- [x] **SRC-01 P0 顶栏入口**：`App.vue` `top-right` 放大镜（`AcwIcon search`）；文档中心顶栏保持现有文档搜索，不重复。
- [x] **SRC-02 P0 组件抽离**：`GlobalChatSearch.vue`（popover + 防抖 + 竞态防护）；从 `Workbench.vue` 移除会话头搜索按钮。
- [x] **SRC-03 P0 跨会话查询**：`canRunChatSearch` 仅校验 `query`；`api.messages.find(q)` 不传 `sessionId`。
- [x] **SRC-04 P0 跳转**：跨路由 `router.push(/workbench/:id)` + pending message id，在 `selectSession` 后滚到气泡。
- [x] **SRC-05 P1 i18n / a11y**：文案改为「全部会话」；E2E smoke 更新 aria 断言。
- [ ] **SRC-06 P2 快捷键**：`Ctrl/Cmd+Shift+F` 打开全局搜索（与终端查找区分）——本版不做。

### 3.2 会话完成归档（ARC）

- [x] **ARC-01 P0 会话头按钮**：`Workbench.vue` 在置顶与删除之间增加「完成」；`status === archived` 时隐藏。
- [x] **ARC-02 P0 动作层**：`sessionArchiveActions.js` + `lifecycle` 接线；确认框说明释放进程；`POST archive` 后 `loadDetail` + `loadLists` + `terminalBridge.resetTerminals`。
- [x] **ARC-03 P1 i18n**：中英「完成 / Done」与确认文案。
- [x] **ARC-04 P1 单测**：`sessionArchiveActions` 冒烟；`workbenchChatSearchUi` 更新 `canRunChatSearch` 断言。

### 3.3 熔炉炼化合一（REF）

**做什么（对用户）**

- 成员 / 群模板：**一个勾**「熔炉炼化」；帮助文字只解释：保存后（或节点跑前）让脚本能读协同台注入的环境变量/参数，产出会进文档中心。
- 成员列表「炼化」列保留，**不再出现「适配」列或第二勾**。
- 还原仍用「还原到炼化前」+ 还原中心；备份目录对外统称炼化备份（`refine` 为主，`adapt` 历史包可读可还，不在 UI 分栏）。

**做什么（对代码）**

- **唯一开关**：只保留 `config.refine`（熔炉炼化）；**删除** `config.adapt`、`step.adapt`、`prepareAdaptForMember`、适配备份 REST、`/members/adapt/*`、设置页「是否适配」与相关单测/自测。
- **不做迁移**：旧库里的 `adapt` 字段在读写时 **直接剥离**，引擎 **不再读取** `input.adapt` / 节点 adapt 标记；历史台账里已写的 adapt 字段可留盘，仅作只读遗留，不触发行为。
- **保留（非「是否适配」）**：成员高级里的 **JSONL 结构化 Adapter**（`script.adapter`）与 `adapterEvents` 终端协议——这是 TUI 事件通道，与已删除的「改源适配」无关，设置文案改名避免「适配」二字。
- 同步改 `settingsMembers.*` / `settingsGroups.*`、`guide-script.md`（删 adapt 专节对立叙述）。

- [x] **REF-01 P0 UI**：`Members.vue` / `Groups.vue` 移除「是否适配」；炼化 hint 写清「注入输入 + 稳定产出」（hint 文案待 REF-05 收紧）。
- [x] **REF-02 P0 引擎**：`advance.js` 去掉 `wantAdapt` 整段；`store.js` / `normalizeSteps` 不再写 adapt。
- [x] **REF-03 P0 API**：`adapt/plan` 与 `adapt/restore` 返回 410；`updateMember` / `memberRow` 剥离 `config.adapt`。
- [x] **REF-04 P1 流程轨**：去掉「适配」角标与 adapt 回落 toast。
- [x] **REF-05 P1 文档/测试**：删或改 `adaptPlan.test.js`、`adaptBackup.test.js` 中 adapt 专测；`guide-script.md` 与 REF 一致。

### 3.4 文档中心编辑输入/输出（DOC-IO）

- [x] **DOC-IO-01 P0**：扩展 `canEdit`：除 `announce` 外，允许 `nodes/step-*.md`、`README.md`（与会话导航文件一致的白名单）；只读熔炉归档等只读类不变。
- [x] **DOC-IO-02 P0**：复用 `DocsHubContentColumn` 编辑/预览/保存；保存走既有写 journal API；冲突与路径校验与公告相同。
- [x] **DOC-IO-03 P1**：编辑按钮文案区分「编辑群报告」/「编辑步骤台账」；保存成功 toast + 可选 `announcement.updated` 同类 WS 刷新工作台链接预览。
- [x] **DOC-IO-04 P1**：单测 `useDocsHub` / `docsHub` 白名单；冒烟：打开 step 台账 → 改输出段 → 保存 → 再读一致。

> **范围说明**：本版**不在文档中心编辑** `config.refine.format` JSON；格式仍以成员设置 + 炼化保存/熔炉为准。用户改的是**已落盘的 Markdown 产出**（输入输出实录），不是改脚本契约。

### 3.5 文档与发布

- [x] **REL-01 P0** 本文件 + `CODE_CHANGE.md` 台账（随迭代追加）。
- [x] **REL-02 P1** `package.json` 版本号与 CHANGELOG（发布时）。

---

## 四、技术方案要点

1. **搜索样式**：会话头 `.chat-search-*` 样式迁入 `GlobalChatSearch.vue`，保留 `popper-class="chat-search-popper"`。
2. **归档副作用**：依赖服务端 `archiveSession` 与 WS，前端不重复杀 PTY；归档后列表筛选项「已归档」立即可见。
3. **炼化-only**：用户只见炼化开关；adapt 代码路径已移除，备份仅炼化 `data/backups/refine`。
4. **文档编辑**：扩大 `canEdit` 白名单，不新做富文本；Markdown 即输入输出载体。
5. **成员单聊**：若产品日后禁止单聊归档，可在 `ARC-01` 加 `kind === adhoc` 禁用；本版与 API 一致，不额外限制。

---

## 五、里程碑

| 阶段 | 交付 |
| --- | --- |
| M1 | 规划文档（本文件）评审 |
| M2 | SRC-* + ARC-* 已合并 main 或 PR |
| M3 | REF-* + DOC-IO-* 代码与单测绿 |
| M4 | E2E smoke 通过，6.2.0 发布 |

---

## 六、验收清单

- [x] 顶栏放大镜可见；无选中会话亦可搜索并命中多会话结果。
- [x] 点击命中跳转正确会话并滚动到消息。
- [x] 会话头「完成」归档后状态为已归档，终端/进程释放（与流程走完一致）。
- [x] 设置里无「是否适配」；`adapt` API 返回 410；勾选炼化行为与现网一致。
- [x] 文档中心可编辑并保存至少一种 `nodes/step-*.md`，修改输入/输出段落后刷新仍可见。
- [x] `npm run test`（server + web）通过。