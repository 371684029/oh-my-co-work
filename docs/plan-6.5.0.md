# 6.5.0 计划：炼化改源可审计（文档中心 Git 式 diff）与体验收口

> **定位**：6.4.0 已将熔炉定制迁入 Skills、DOC-IO 与成员炼化契约闭环；6.5.0 聚焦**「成员炼化到底改了什么源码」**——在文档中心以 **接近 git diff 的可读对比** 呈现，并与台账、流程轨、设置保存动线打通。本版不新开「适配/炼化」产品分支，只加强审计与还原 UX。
>
> **约束**：仍本机优先；diff 数据来源以现有 `data/backups/refine` manifest + zip 为准，不依赖用户仓库必须已 `git init`；大文件/二进制仍只展示路径与大小。

标注：**P0** 本版核心；**P1** 重要；**P2** 后置。状态 `[ ]` / `[x]` 维护。

---

## 一、现状（读代码确认）

### 1.1 成员炼化「保存」会改哪些代码

入口：`applyRefineOnMemberSave`（`server/src/refineSource.js`），在成员设置勾选炼化并**点保存**时执行（非群聊节点跑完后的台账整理）。

| 动作 | 说明 |
| --- | --- |
| 收集路径 | `collectAdaptSourcePaths(member)`：脚本 `filePath`、命令工作目录下关联源等 |
| 评估可写 | `assessAdaptFiles`：可读可写、非符号链接 |
| 打 zip 备份 | `createAdaptBackup({ kind: 'refine' })` → `data/backups/refine/<memberId>/` |
| 插入契约 | 无 `ACW-REFINE` 标记时 `computeRefineContractContent`：按扩展名插入 bat/ps1/sh/py/node 片段 |
| 升级 argv | 已有契约的 `.mjs/.js` 补 `acwSyncArgvFromEnv`（`refineArgvSync.js`） |
| bat 修复 | 含全角括号/「缺则用」等坏文案的 bat 契约修复 |
| 写入规格 | `member.config.refine.format`（标题、输入 env、stdout 标题） |
| 试跑 | 可选 `verifyMemberSync`（保存后或 preview） |

**不在此路径**：群聊一步跑完后写 `nodes/step-*.md`（journal）、熔炉会话里 Grok 用 `acw-ctl` 改源（另一套备份/manifest，部分复用同一还原中心）。

### 1.2 今天在哪里能看「改了什么」

| 场景 | 位置 | 格式 |
| --- | --- | --- |
| **保存前** | 设置 → 成员抽屉 | `POST /members/refine/plan`：文件列表 + **契约 snippet 前 520 字**，非完整 diff；确认框内同样为 snippet |
| **保存后** | 设置 → **还原中心**；文档中心「**节点炼化与还原**」侧栏；工作台流程轨文档区 | `DocsRefineChangesPane` + `GET /api/restore-center` |
| 对比算法 | `listMemberSourceHistory` → `buildLineDiff`（`refineRestore.js`） | 简化 **行级 `-` / `+`**（非 unified diff，无 `@@` hunk、无文件头） |
| 数据来源 | manifest 内 zip = **改前**；磁盘当前文件 = **改后** | 点「查看修改对比」展开 `<pre class="rl-diff">` |
| **节点工作区 git** | 流程轨节点卡片 / 时间线 | `stepSnapshot` 的 **git patch**（与成员炼化改源**不是同一份 diff**） |

结论：**能在文档中心相关区域看到近似 diff，但入口偏「还原中心」子页，不是读群报告/step 台账的主阅读流；保存前也看不到完整 git 式 diff。**

### 1.3 与产品预期的差距

1. 用户保存炼化后，**不会自动**在 `nodes/step-*.md` 或 `ANNOUNCEMENT.md` 里留下「本次改源摘要 + diff 链接」。
2. **plan 预览**与**事后 diff** 算法不一致（snippet vs zip 对比）。
3. 无 **unified diff** / 无高亮 / 无「复制 patch」/ 无按文件折叠。
4. 偏好里「炼化改源前备份」开关（`settings.adapt.backup`）**未接入** `applyRefineOnMemberSave`（UI 有，引擎未读）。
5. 熔炉 Grok 改源与成员保存炼化的记录**同列表不同叙事**，缺「事件类型」筛选。

---

## 二、6.5.0 目标

1. **文档中心主路径可发现**：任意会话打开文档中心即可看到「本群/全局最近炼化改源」入口，深链到成员级 diff。
2. **Git 式 diff 可读**：统一 unified diff（或带 hunk 的侧-by-side 可选），保存前 plan 与保存后历史**同一引擎**。
3. **台账留痕（轻量）**：可选在成员保存或还原后写一条 **journal 审计 md**（`journals/refine-audit/<memberId>-<ts>.md`）或会话内系统消息链到还原中心（二选一，见任务）。
4. **设置与引擎一致**：备份开关、bat 包装警告与 `furnace` 设置真正生效。

---

## 三、工程任务（RFD — Refine Diff）

### 3.1 Diff 引擎与 API（RFD-ENG）

- [x] **RFD-01 P0** 抽出 `buildUnifiedDiff(before, after, { path, context })`（可包装 `diff` 库或自研 minimal unified）；`buildLineDiff` 标记 deprecated，还原中心与 plan 共用。
- [x] **RFD-02 P0** `planRefineOnMemberSave` 返回每文件 `diffPreview`（dry-run：内存算 next 文本，不写盘）+ `willPatch`。
- [ ] **RFD-03 P1** `GET /members/:id/refine/history` 或扩展现有 `GET /members/:id/refine/history`（catalog 已有 history 片段）返回 unified diff + 截断策略（>200 行折叠）。
- [x] **RFD-04 P1** `settings.adapt.backup` 改名为 `settings.refine.backup`（读库兼容 alias），`applyRefineOnMemberSave` 尊重关闭时跳过 zip（仍允许改源或改为强制只读预览，产品默认保持「开备份才能改源」）。

### 3.2 文档中心 UX（RFD-DOC）

- [x] **RFD-10 P0** `DocsRefineChangesPane`：diff 区使用 **等宽 + 行号 + `-`/`+` 色**（复用 `flow-io-pre--diff` 样式）；标题注明「备份时刻 → 当前磁盘」。
- [x] **RFD-11 P0** 文档中心欢迎区 / 侧栏常驻入口「炼化改源记录」（不仅 `showRefineLedger` 会话模式）；支持按成员名过滤。
- [x] **RFD-12 P1** 成员保存成功 toast 增加「在文档中心查看 diff」链（`/docs?pane=refine&memberId=`）。
- [ ] **RFD-13 P2** 导出单次 diff 为 `.patch` 或附进 `journals/sessions/<id>/assets/`（仅当用户显式导出）。

### 3.3 设置与流程轨（RFD-UX）

- [x] **RFD-20 P1** 成员抽屉 plan 区：由 snippet `<pre>` 升级为 **折叠 diff 块**（与 RFD-02 同源）。
- [ ] **RFD-21 P1** 流程轨失败节点（已有 docs / 成员深链）追加「查看该成员最近炼化 diff」。
- [ ] **RFD-22 P2** 时间线事件类型 `refine.source_patched`（保存炼化时 `engineEmit`），工作台时间线可筛。

### 3.4 文档与测试（RFD-REL）

- [x] **RFD-30 P0** 更新 `guide-script.md` §3：保存炼化改源 vs 跑一步写台账；diff 去哪看。
- [x] **RFD-31 P0** 单测：`planRefine` dry-run diff 与 `listMemberSourceHistory` 事后 diff 对同一 fixture 一致。
- [x] **RFD-32 P1** `scripts/selftest-refine-diff.mjs`：保存 → 读 history → 断言含 `@@` 或约定前缀。

---

## 四、同版本可顺带收口（非 RFD 核心）

| ID | 优先级 | 项 | 说明 |
| --- | --- | --- | --- |
| FSK-B | P2 | 6.4 阶段 B | prompts 仅由 Skill 生成，设置页弱化 `prompts/*.md` |
| CUR-F | P2 | Cursor 熔炉 | `furnaceAgent=cursor` 时 `.cursor/rules` 镜像（6.4 待决 #3） |
| RFN-F | P1 | `refine.format.title` 可编辑 | 6.3 只读摘要 → 表单字段，保存仍走 refine/plan |
| NTF-R | P2 | 终端炼化完成 toast | 长任务炼化在 TUI 有轻提示 |
| DEBT | P1 | 死文案/ API | 已完成大部分；6.5 再扫 `restore-center` 与 i18n「适配」遗留 |

---

## 五、里程碑与验收

| 阶段 | 交付 |
| --- | --- |
| M1 | 本计划评审 + RFD-01/02 API 草案 |
| M2 | 文档中心 diff UX（RFD-10/11）+ 单测绿 |
| M3 | 保存 plan 与事后 diff 一致 + guide-script |

**验收**

- [x] 勾选炼化保存前后，成员抽屉与还原中心展示**同一格式**的 unified diff（至少一个 `.mjs` 样例）。
- [x] 未开备份开关时行为符合文档（默认：无备份则不改源，或明确二次确认）。
- [x] 文档中心无需先选会话即可打开炼化改源列表并展开 diff（`/docs?pane=refine`）。
- [x] `npm run test` 通过。

---

## 六、与相邻版本关系

| 版本 | 关系 |
| --- | --- |
| **6.4.0** | Skills 同步、DOC-IO、还原中心 diff **已有简化版** → 6.5 **升级呈现与 plan 对齐** |
| **6.3.0** | 炼化契约、`refine/plan` API → 6.5 补 **dry-run diff** |
| **5.9.0 RAR-09** | 还原中心 diff 起点；6.5 产品化到文档主路径 |

---

## 七、摘要（答复产品讨论）

- **改了哪些代码**：主要是成员脚本源文件插入/升级 `ACW-REFINE` 契约与 argv 同步；元数据写入 `config.refine.format`；备份在 `data/backups/refine`。
- **文档中心能不能看到**：**能**，在「节点炼化与还原」/ 还原中心，**git 式 unified diff**（6.5.0）；不会自动嵌进群报告/step 正文。
- **6.5 要不要做**：核心 diff 已交付；余量见 **§十** 与 [`plan-backlog.md`](./plan-backlog.md)。

---

## 十、待办栏

> **单一汇总表**：[`docs/plan-backlog.md`](./plan-backlog.md)（含 6.5 余量、6.4 待决、设置债、工程杂项、历史计划索引）。

**本文件内未勾任务（复制跟踪）**

- [ ] RFD-03 history API + diff 截断  
- [ ] RFD-13 导出 `.patch`  
- [ ] RFD-21 流程轨 → 炼化 diff  
- [ ] RFD-22 时间线 `refine.source_patched`  
- [ ] 文档中心炼化列表按成员过滤  
- [ ] `settings.refine.backup` 键名迁移  
- [ ] `refine.format.title` 可编辑  
- [ ] 终端炼化完成 toast  
- [ ] 6.4 阶段 B（prompts → Skill 单写）  
- [ ] Cursor 熔炉 Skills 镜像  
- [ ] 6.2 SRC-06 全局搜索快捷键（后置）  
- [ ] PR #173 关闭 / superseded  