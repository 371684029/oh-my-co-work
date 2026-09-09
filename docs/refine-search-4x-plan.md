# oh-my-co-work 4.5/4.6 · 熔炉炼化 与 全局模糊搜索 实施计划

| 属性 | 内容 |
|------|------|
| 目标版本 | `4.5.0`（熔炉炼化）+ `4.6.0`（全局模糊搜索） |
| 状态 | **已实施核心**（server 185 pass / web 26 pass / ESLint 干净；运行包未重打） |
| 更新日期 | 2026-09-09 |
| 当前基线 | `4.2.0`（文档中心 + 检索导出 + 更新/备份恢复）；4.3.0 评审修复已落 |
| 关联文档 | [crucible-3x.md](./crucible-3x.md)（熔炉设计）、[crucible-3.2.md](./crucible-3.2.md)、[docs-4x-plan.md](./docs-4x-plan.md)、[data-storage.md](./data-storage.md) |
| 前置 | 4.3.0（评审修复）已合；4.4.0（若有）不阻塞本计划 |

> 两个功能独立、可分期交付，但都触及 `server/` 与 `web/` 双侧，且都靠**熔炉**/**文档**两套已存在骨架，故共用一份计划。

## 0. 实施状态（2026-09-09 已落地核心）

### 4.6 全局模糊搜索（完成）
- `shared/fuzzy.js`：统一匹配器（大小写不敏感 + 拼音全拼/首字母 + 子序列容错 + 打分），server/web 复用；依赖 `pinyin-pro`（<20KB）。
- `docsHub.searchDocs`：匹配器升级为 `fuzzyMatch`（阈值 50），新增会话/群标题命中；既有断言不破。
- `services.searchMessages` + `GET /api/messages/search` + `web api.messages.find`：跨会话搜索消息（`content.text`/`content.choices`）。
- `Members.vue` / `Groups.vue`：设置页模糊搜索框（本地 fuzzySearch 过滤，支持拼音/首字母）。
- 测试：`fuzzy.test.js`(8)、`docsHub.test.js`(12)、`search.test.js`(5)。

### 4.5 熔炉炼化（核心完成；部分后置）
- 新增 `FURNACE_ROLE.REFINE` + `refine.md` 角色壳 + `furnaceContext` 注册。
- `server/src/refine.js`：`extractMessageText`/`applyRefineFormat`/`defaultRefineFormat`/`refineOutputForNode`（可注入 formatter）。
- `advance.js` 节点**完成后**钩子：步骤勾炼化或成员已炼化 → `input.refine{refined,fallback,source}` + `refineFormatted` + 系统消息。
- 成员 `config.refine` 透传 + `Members.vue`「熔炉炼化」复选框；群模板批量绑成员（`Groups.vue`）+ 逐步炼化 + `normalizeSteps` 透传 `step.refine`。
- 测试：`refine.test.js`(7)、`refineField.test.js`(4，含 advance 集成)。

> **偏差/后置**（见 §8 开放问题）：① 熔炉 REFINE 角色**自动产出成员格式规格**已接入——`advance.js` 在首次遇到已炼化成员且无 `config.refine.format` 时，调用 `produceRefineSpec`/`persistRefineSpec` 产出并回写规格（默认从成员名派生 `{title}`，`opts.author` 可注入熔炉/测试替身），此后该成员走 `source:'spec'`；② 流程轨「炼化」角标已接（`useSessionDetail.nodeHasRefine` + `FlowRail.vue` 绿色角标）；③ **web 聊天搜索 UI 已接**（Workbench 头部「搜索聊天」弹层，调 `/messages/search`，点击命中跳转会话）；④ **炼化正文已真正渲染进文档中心**——`journal.js` 的 `refinedDocText()` 让 `refineFormatted` 优先写入 `step-*.md` 输出段与群报告 `ANNOUNCEMENT.md` 出参（回归测试锁定）；⑤ 炼化不改成员源文件，故**无需**适配那样的 zip 备份（本设计仅格式化输出文本）。**唯一留待真实熔炉**的是：把 `defaultRefineSpecAuthor` 换成真正的 REFINE 角色推理（当前为确定性兜底，`opts.author` 注入口已留好）。

---

## 1. 背景与目标

### 1.1 4.5 熔炉炼化（独立新语义）

**痛点**：成员/群模板里的成员产出五花八门（echo 默认文本、script 的终端输出），要进文档中心（`ANNOUNCEMENT.md` / `step-*.md`）前，格式不统一，文档难维护。

**目标**：新增一个与现有「适配(adapt)」解耦的**「炼化(refine)」**语义——由熔炉把成员的**输入/输出统一格式化成便于文档维护的形态**，并持久化该格式规格。

**与「适配」的差异（关键，已确认独立）**：

| 维度 | 适配(adapt，已存在) | 炼化(refine，4.5 新增) |
|------|---------------------|------------------------|
| 目的 | 把成员/步骤**接到工作台**（改代码、开 JSONL 侧通道、zip 备份），让工具能跑起来进台账 | 把成员的**输入/输出格式化成文档友好形态**，方便文档中心维护 |
| 时机 | **执行前**（成员跑之前做准备，advance.js:307-351） | **执行后**（成员产出后格式化输出进文档）+ 成员级一次性格式化规格 |
| 字段 | `member.config.adapt` / `step.adapt` | 新增（见 §3.1） |
| 熔炉角色 | `member-adapt` / `node-adapt` | 新增 `refine/format` 角色（或复用壳换语义，见 §3.2） |
| 兜底 | 改不了代码 → 打「适配标记」 | 成员未炼化 → 走「格式化节点」 |

### 1.2 4.6 全局模糊搜索

**痛点**：信息散落——聊天记录、文档、成员、群模板四处，用户找不到想要的。

**目标**：给**聊天、文档、成员、群模板**四个维度统一加**模糊搜索**（大小写不敏感 + 拼音首字母/全拼 + 容错子序列），用户在一处输入即可命中。

**现状盘点（探索结论）**：

| 维度 | 现状 | 搜索能力 | 4.6 动作 |
|------|------|---------|----------|
| 文档 | `searchDocs`（docsHub.js:307-346）内存子串扫描 | 有（小写 includes，无拼音/无容错） | **升级**匹配器为模糊/拼音 |
| 聊天 | `messages` 表（db.js:272-282），无搜索接口 | 无 | **从零建** |
| 成员 | `listMembers`（services.js:99-107）全量列表 | 无 | **从零建**（客户端过滤即可） |
| 群模板 | `listGroups`（services.js:215-225）全量列表 | 无 | **从零建**（客户端过滤即可） |

全仓**无任何模糊/拼音库**（fuse.js/fuzzysort/pinyin 等均未引入）；现有匹配全是内联 `toLowerCase()+includes()`。

---

## 2. 实施原则

1. **炼化与适配解耦**：不改动现有 `adapt` 的触发/语义/字段；炼化走独立字段、独立熔炉角色、独立 hook。避免破坏已验证的适配链路。
2. **复用熔炉骨架**：炼化复用 `syncFurnaceSessionContext`（写 ACTIVE.md/SITUATION.md）+ `activateFurnaceRole` + `furnaceGrokInject`（AGENTS.md/rules）+ 备份机制，**只换角色语义与触发时机**。
3. **执行后格式化是核心新增**：现有 advance 链只有执行前 `prepareAdaptForMember`；炼化的"输出格式化"需在节点**完成后**挂一个后处理 hook（新增）。
4. **单一事实源**：炼化产出的格式规格落成员 `config_json`（JSON，免 schema 迁移）；搜索**不建 FTS/不建第二索引库**。
5. **搜索统一匹配工具**：抽到 `shared/` 侧一个纯函数（server + web 复用），关键词拆分、大小写、拼音首字母/全拼、子序列容错打分。不继续散落内联 includes。
6. **客户端优先，量大再下沉**：成员/群模板全量本地过滤（数据本就全量返回）；聊天/文档视消息量决定内存扫描 vs SQLite 查询（见 §3.4）。
7. 小步提交、行为不变优先；无破坏性重构。

---

## 3. 设计要点

### 3.1 4.5 数据模型（炼化）

**成员（members）**——在 `config_json` 内新增炼化相关键（config 为 JSON，免迁移）：

```jsonc
{
  "refine": {
    "enabled": true,          // 是否开启炼化（添加成员时可勾）
    "status": "pending|done|failed",  // 炼化执行状态（一次性任务）
    "format": { ... },        // 炼化产出的输入/输出格式规格（文档友好），done 后写入
    "refinedAt": "2026-09-09T...",   // 炼化完成时间
    "refineBackup": "data/backups/refine/<memberId>/refine-<ts>.zip"  // 炼化前备份
  }
}
```

- 依据：成员唯一事实来源是 `config_json`（services.js `memberRow` 解析），加键即可，无需 ALTER。
- `enabled` 由「添加成员」时的「是否炼化」开关控制；`status`/`format` 由熔炉执行后回填。

**群模板（groups）**——「末班 = 批量绑成员」需要新增批量绑定能力。现状 `steps_json[]` 每步仅 `{ id, title, type, memberId, gate, flow, captureParams, adapt }`（services.js `normalizeSteps`，每步绑一个成员）。

- **新增「末班/批量绑成员」操作**：在 `Groups.vue` 表单新增"批量添加成员步骤"，用户多选成员 → 每个成员生成一个绑定的 step（沿用现有 step 结构），每步可勾选「炼化」。
- step 上新增 `refine`（可选）键，标记该步的绑定成员接入时是否炼化；未炼化成员 → 走「格式化节点」。

### 3.2 4.5 熔炉角色与兜底

**新增炼化角色**：在 `furnaceContext.js:11-16 ROLE_FILES` 增加一个炼化角色（建议 `prompts/refine.md`，语义=「把当前成员的输入/输出格式化成文档友好形态」，只格式化不强改运行逻辑）。

- 角色文件：`server/config/furnace/prompts/refine.md`（新）。与 `member-adapt`/`node-adapt` 的区别：后者"接工作台"，前者"格式化输入输出"。
- 若用户希望炼化**也服务适配过的成员**，则该角色可以叠加在 `member-adapt` 壳之后（分阶段：先接入、再格式化），但角色壳一次只装一套（crucible-3x.md §3.2），故 4.5 视为**独立角色**，不与适配同台。

**格式化节点（formatter node）兜底**——对应「成员没有被炼化的情况」：

- 当批量绑成员（或会话运行时）遇到**未炼化**成员，走一个「格式化节点」：在节点执行后，用炼化角色把该成员本次输出格式化一遍，写入文档 / 节点日志，不持久化成成员级规格（一次性）。
- 标记方式：仿照适配的 `node.input_json.adapt` 遗传（store.js `inheritNodeInputMeta`），新增 `node.input_json.formatted`/`refineFallback` 标记，流程轨节点标题打「炼化」角标（复用适配角标样式，不单开 Tab）。

### 3.3 4.5 触发挂载点

| 场景 | 挂载点 |
|------|--------|
| 添加成员时可选炼化 | 前端 `web/src/views/settings/Members.vue:476 save()` 的 body.config 加 `refine.enabled`；服务端 `services.js:119 createMember` / `:164 updateMember` 透传摄入。保存后触发一次后端炼化任务（写 `status:pending`，异步由熔炉执行 → 回填 `format`） |
| 群模板批量绑成员（末班）时可选炼化 | 前端 `web/src/views/settings/Groups.vue:468 addStep` 附近新增「批量添加成员步骤」；每步带 `refine`。服务端 `services.js:260 createGroup` / `:300 updateGroup` 的 `normalizeSteps` 透传 `step.refine` |
| 执行后格式化（成员已炼化） | `server/src/engine/advance.js:410 touchFurnaceWorkflow` 附近的**节点完成回调**新增：若成员已炼化 → 用其 `format` 规格格式化本次输出（写入文档/日志） |
| 执行后格式化（成员未炼化 → 格式化节点） | 节点完成回调+`node.input_json` 带 `refineFallback` 时，触发炼化角色一次性格式化并写文档/日志，流程轨打「炼化」角标 |

> 关键缺口：现有 advance 链**没有**执行后 hook（advance.js:410 只刷新地图）。需确认节点完成的确切回调位置（`runners.js` / `advance.js` 完成后段），再在此插入格式化后处理。此点在 §8 开放问题中标记需实现期定点。

### 3.4 4.6 模糊搜索设计

**统一匹配工具**（新增 `shared/` 侧纯函数，server + web 复用）：

```ts
// shared/fuzzy.js
export function fuzzyMatch(query, fields, opts?): { score, matched, ... }
// query 分词；大小写不敏感；支持拼音首字母/全拼（用可选 pinyin 依赖）
// 子序列容错打分：完全前缀 > 子序列 > 中缀；阈值过滤
export function fuzzySearch(items, query, fieldSelector, opts?): items[]
```

- 依赖：引入一个轻量拼音库（`pinyin-pro` 或 `pinyin`，运行时<20KB），仅用于匹配，不做全文索引。
- server 与 web 都可 import（项目已有 `@acw/shared` 共享包，放 `shared/`）。

**四个维度挂载**：

| 维度 | 数据源 | 位置 | 4.6 改动 |
|------|--------|------|---------|
| 成员 | `listMembers` 全量 | `Members.vue` 表格 + `services.js` | 前端 `el-input` 过滤（`display_name/name/description/role`）；量大再下沉 `?q=` |
| 群模板 | `listGroups` 全量 | `Groups.vue` 表格 | 前端 `el-input` 过滤（`title/description/work_folder`） |
| 文档 | `searchDocs` | `useDocsHub.js` / `DocsHub.vue` | 升级匹配器为 `fuzzyMatch`；增加按会话标题命中 |
| 聊天 | `messages` 表 | 新建 `searchMessages` + `GET /messages/search` | **从零建**：`content_json`→`content.text`（用户）/`content.choices`（AI），内存扫描或 SQLite `instr/LIKE` |

**聊天搜索策略（决策点）**：消息量大时用 SQLite `instr(content_json, ?)` + 普通索引；量小沿用内存扫描。4.6 首版建议：按会话维度内存扫描（复用 `getSessionDetail` 的 messages 加载），匹配 `content.text`/`content.choices`，返回命中会话/节点/行摘要。若消息量成为问题，迭代下沉 SQLite。

**全局搜索入口**：顶栏/工作台新增一个全局搜索框（或命令面板），一次输入跨四维度模糊命中，点击跳转对应位置（成员→设置页、群模板→设置页、文档→文档中心、聊天→对应会话）。首版可先做**各维度各自搜索框**（成员/群模板在设置页、文档在文档中心、聊天在会话内），全局入口后置（§4 版本切分）。

---

## 4. 版本切分

| 版本 | 主题 | 交付边界 | 说明 |
|------|------|----------|------|
| `4.5.0` | 熔炉炼化 | 成员炼化字段+触发；群模板批量绑成员+逐步炼化；执行后格式化；格式化节点兜底；流程轨角标 | 独立于适配 |
| `4.6.0` | 全局模糊搜索 | 统一 `shared/fuzzy` 匹配工具；四维度搜索框；聊天搜索接口；拼音依赖引入 | 各维度各自搜索框，全局入口后置 |

---

## 5. 任务（粗纲，checkbox）

### 5.1 4.5 熔炉炼化

#### 服务端

- [ ] `server/config/furnace/prompts/refine.md`：新炼化角色（格式化输入/输出供文档维护）
- [ ] `server/src/furnaceContext.js`：`ROLE_FILES` 增加 refine 角色；`resolveRefineFurnaceRole`（与 `resolveAdaptFurnaceRole` 对称）
- [ ] `server/src/services.js`：`createMember/updateMember` 透传 `config.refine`；`normalizeSteps` 透传 `step.refine`
- [ ] 炼化执行任务：成员级一次性炼化（写 `status:pending` → 熔炉执行 → 回填 `format` + `refinedAt` + 备份）；可放 `server/src/` 新模块 `refine.js` 或并入 furnace 模块
- [ ] `server/src/engine/advance.js`：节点完成后插入格式化后处理 hook（已炼化用规格、未炼化走格式化节点）
- [ ] `server/src/engine/store.js`：`node.input_json` 遗传 `formatted/refineFallback`
- [ ] 备份：改源/规格前压缩包（复用 `adaptBackup.js` 的 `data/backups/adapt` 基建，新增 `data/backups/refine` 目录）

#### 前端

- [ ] `web/src/views/settings/Members.vue`：新建/编辑成员加「是否炼化」开关；保存后触发一次性炼化
- [ ] `web/src/views/settings/Groups.vue`：新增「批量添加成员步骤」（多选成员→每步一个 step），每步「是否炼化」；流程轨节点「炼化」角标
- [ ] `web/src/views/workbench/composables/useSessionDetail.js` / `FlowRail.vue`：显示炼化角标与状态

#### 测试与安全

- [ ] `server/test/refine.test.js`：成员炼化字段持久化、任务状态流转、批量绑成员逐步炼化、未炼化走格式化节点
- [ ] advance 后处理 hook 单测：已炼化用规格格式化、未炼化一次性格式化、流程轨角标
- [ ] 备份完整性：炼化前备份生成/恢复；不改坏成员其它用例
- [ ] 安全：炼化角色不越权（不扫描整盘、不写密钥，仿 `member-adapt` 的「不做」清单）

### 5.2 4.6 全局模糊搜索

#### 服务端

- [ ] `shared/fuzzy.js`：统一匹配工具（分词/大小写/拼音/子序列打分）
- [ ] `web/package.json` / `shared`：引入拼音依赖（pinyin-pro 或 pinyin，<20KB）
- [ ] `server/src/docsHub.js`：`searchDocs` 匹配器升级为 `fuzzyMatch`；增加按会话标题命中
- [ ] `server/src/services.js`：新增 `searchMessages(query)`；`listMembers/listGroups` 可选 `?q=`
- [ ] `server/src/routes.js`：新增 `GET /api/messages/search`；成员/群列表接口支持 `?q=`

#### 前端

- [ ] `web/src/views/settings/Members.vue`：表格加 `el-input` 模糊搜索框
- [ ] `web/src/views/settings/Groups.vue`：表格加 `el-input` 模糊搜索框
- [ ] `web/src/views/docs/DocsHub.vue` / `useDocsHub.js`：搜索升级为模糊匹配
- [ ] 聊天搜索：会话详情内加搜索框（或全局入口，见 §5.2 后置）
- [ ] `web/src/api.js`：新增 `messages.search`、`members.list({q})`、`groups.list({q})`

#### 测试与安全

- [ ] `shared/fuzzy` 单测：中文全拼/首字母、英文大小写、子序列容错、阈值
- [ ] `server/test/docsHub.test.js`：搜索升级回归（原有命中断言不破）
- [ ] `server/test/search.test.js`：消息搜索命中用户文本/AI choices、按会话/节点摘要
- [ ] 搜索输入防注入：SQLite 用参数化，不做字符串拼接

---

## 6. 测试与安全（合并）

- 炼化：范围收敛，不破坏现有 `adapt` 测试（backupRestore/docsHub 17 例全绿基线）。
- 搜索：统一匹配工具的拼音/容错用例为回归锁。
- 安全：炼化角色复用熔炉 deps 注入（不开新端口、不改 [requireLocalAccess](./../README.md) 模型）；搜索参数化查询防注入。

---

## 7. 风险与对策

| 风险 | 对策 |
|------|------|
| 执行后格式化 hook 位置不确定（现有 advance 无后处理） | §8 开放问题；实现期在 `runners.js`/`advance.js` 完成后段定点，用 min 侵入回调 |
| 炼化与适配语义重叠致混淆 | 字段/角色/触发点全部独立；文档与 hover 文案区分「炼化=格式化文档」 vs「适配=接入工作台」 |
| 「末班=批量绑成员」现无批量接口，实现量大 | 4.5 只做「批量生成步骤」最小集（多选→每成员一步），不引入多成员同一 step |
| 批量绑成员触发越多熔炉任务系统越重 | 任务队列/并发限制；失败降级为「未炼化→格式化节点」而非阻塞 |
| 拼音库体积与打包 | 依赖控制在 <20KB，verify-pack 体积基线对比 |
| 聊天消息量大搜索慢 | 首版按会话内存扫描；量大下沉 SQLite instr + 索引（§3.4） |

---

## 8. 开放问题 / 待决策

1. **炼化角色与适配角色的关系**：是否允许「先适配再炼化」两阶段？首版按独立角色（不同台）处理。
2. **炼化产出的格式规格 `format` 放到哪**：成员 `config_json` 内（推荐，免迁移）vs 独立 JSON 文件。
3. **「末班批量绑成员」交互形态**：多选成员→每步一个 step 是否满足？还是需要"多成员共享一步"（复杂度高，后置）。
4. **执行后格式化 hook 的确切挂点**：需实现期在 advance/runners 完成后段定点，建议给 4.5 预留小步尝试验证。
5. **炼化是同步还是异步任务**：成员级一次性炼化建议异步（熔炉跑，`status:pending→done`），避免阻塞添加成员交互。
6. **全局搜索入口**：首版各维度各自搜索框；全局跨维度命令面板后置（4.6.x）。
7. **聊天搜索数据量**：首版按会话内存扫描，观察量级再决定是否下沉 SQLite。

---

## 9. 完成定义（封板口径）

### 9.1 4.5.0 熔炉炼化

- 添加成员可选「炼化」，保存后触发一次性炼化，后端回填格式化规格；成员列表可见炼化状态。
- 群模板可「批量添加成员步骤」，每步可选「炼化」；已炼化成员用其规格、未炼化走「格式化节点」。
- 会话运行中，炼化成员的输入/输出能被统一格式化成文档友好形态并落入文档中心（`step-*.md`/公告），流程轨有「炼化」角标。
- 不改动/不破坏现有「适配」链路与测试（backupRestore/docsHub 17 例全绿）。
- 炼化备份可恢复；炼化角色严格「不做」清单（不写密钥、不扫盘）。
- 三平台打包冒烟通过；README/data-storage/directory-structure 同步。

### 9.2 4.6.0 全局模糊搜索

- 成员/群模板设置页有模糊搜索框，大小写不敏感、支持下中文拼音首字母/全拼、子序列容错。
- 文档中心搜索升级为模糊匹配（原有命中断言不破）。
- 聊天消息可按关键词模糊搜索，命中会话/节点/行摘要，点击跳转。
- `shared/fuzzy.js` 为统一匹配工具，server 与 web 复用；拼音依赖 <20KB。
- 搜索参数化查询，防注入；匹配/拼音/容错用例全绿。
- 三平台打包冒烟通过；README/frontend-components 同步。

---

## 10. 不动项

- 不改 SQLite schema（成员/群用 `config_json`/`steps_json` 承载新字段，免迁移）；不改 journal 写入格式。
- 不改 `requireLocalAccess` 安全模型；不引第二端口。
- 不破坏现有「适配」链路与 `announcementManual` 语义。
- 聊天搜索不建 FTS、不建第二索引库。
